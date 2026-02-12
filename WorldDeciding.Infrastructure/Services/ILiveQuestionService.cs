using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
using WorldDeciding.Application.Common.Abuse;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;
using WorldDeciding.Infrastructure.Persistence;

namespace WorldDeciding.Infrastructure.Services;

public interface ILiveQuestionService
{
    Task<LiveQuestionDto?> GetLiveQuestionAsync(CancellationToken ct);
}

public class LiveQuestionService : ILiveQuestionService
{
    private readonly WorldDecidingDbContext _db;
    private readonly IDistributedCache _cache;

    private readonly IAbuseDetector _abuse;
    private readonly IClientContext _client;
    private readonly IIpHasher _ipHasher;

    public LiveQuestionService(
        WorldDecidingDbContext db,
        IDistributedCache cache,
        IAbuseDetector abuse,
        IClientContext client,
        IIpHasher ipHasher)
    {
        _db = db;
        _cache = cache;
        _abuse = abuse;
        _client = client;
        _ipHasher = ipHasher;
    }

    public async Task<LiveQuestionDto?> GetLiveQuestionAsync(CancellationToken ct)
    {
        // === VIEW ABUSE CHECK (silent drop) ===
        var ip = _client.ClientIp?.ToString();
        string? ipHash = null;

        if (!string.IsNullOrWhiteSpace(ip))
            ipHash = _ipHasher.Hash(ip);

        var allowViewWrite = true;

        if (ipHash is not null)
        {
            var decision = await _abuse.CheckAsync(
                AbuseAction.ViewAttempt,
                userId: null,
                ipHash: ipHash,
                ct: ct);

            if (decision.Mode == AbuseMode.SilentDrop)
                allowViewWrite = false; // response ver, view yazma
        }

        // === Cache ===
        var now = DateTime.UtcNow;
        var bucket = GetBucket(now);
        var rotatesAt = GetBucketEndUtc(now);

        var cacheKey = $"live:question:{bucket}";
        var cached = await _cache.GetStringAsync(cacheKey, ct);

        if (!string.IsNullOrWhiteSpace(cached))
        {
            var cachedDto = JsonSerializer.Deserialize<LiveQuestionDto>(cached);
            if (cachedDto is not null)
            {
                // Cache hit olsa da view say (abuse değilse)
                if (allowViewWrite)
                    await TryRecordViewAsync(cachedDto.QuestionId, ipHash, ct);

                return cachedDto;
            }
        }

        // Seed: bucket'a göre deterministik
        var seed = bucket.ToString();

        // 1) Sadece Binary sorulardan 1 tane seç (deterministik random)
        var q = await _db.Questions
            .FromSqlInterpolated($@"
                SELECT *
                FROM ""Questions""
                WHERE ""Type"" = {(short)QuestionType.Binary}
                ORDER BY md5(""Id""::text || {seed})
                LIMIT 1
            ")
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        if (q is null) return null;

        // Category & Options çek
        var category = await _db.Categories.AsNoTracking()
            .FirstAsync(c => c.Id == q.CategoryId, ct);

        var options = await _db.Options.AsNoTracking()
            .Where(o => o.QuestionId == q.Id)
            .Select(o => new LiveOptionDto(o.Id, o.Text))
            .ToListAsync(ct);

        var dto = new LiveQuestionDto(
            q.Id,
            q.Title,
            category.Slug,
            category.Name,
            q.Type.ToString(),
            rotatesAt,
            options
        );

        // View yaz (abuse değilse)
        if (allowViewWrite)
            await TryRecordViewAsync(q.Id, ipHash, ct);

        // Cache set
        var ttl = rotatesAt - now;
        if (ttl < TimeSpan.FromSeconds(5)) ttl = TimeSpan.FromSeconds(5);

        await _cache.SetStringAsync(
            cacheKey,
            JsonSerializer.Serialize(dto),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl },
            ct
        );

        return dto;
    }

    /// <summary>
    /// Daily unique view: (QuestionId, IpHash, ViewDate) unique index varsa duplicate'leri DB engeller.
    /// Abuse'da allowViewWrite=false ise buraya hiç girmez.
    /// </summary>
    private async Task TryRecordViewAsync(Guid questionId, string? ipHash, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(ipHash))
            return;

        var view = new QuestionView
        {
            // ⚠️ Entity alanların sende farklıysa uyarlayacaksın:
            QuestionId = questionId,
            ViewDate = DateOnly.FromDateTime(DateTime.UtcNow),
            IpHash = ipHash
        };

        _db.QuestionViews.Add(view);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Büyük ihtimalle unique constraint (aynı gün aynı IP) — bu beklenen bir durum.
            // İstersen burada provider'a göre (Postgres) daha spesifik unique-violation kontrolü yaparız.
        }
    }

    private static long GetBucket(DateTime utcNow)
    {
        var epoch = new DateTimeOffset(utcNow).ToUnixTimeSeconds();
        return epoch / 300; // 5 dk
    }

    private static DateTime GetBucketEndUtc(DateTime utcNow)
    {
        var epoch = new DateTimeOffset(utcNow).ToUnixTimeSeconds();
        var bucketEnd = ((epoch / 300) + 1) * 300;
        return DateTimeOffset.FromUnixTimeSeconds(bucketEnd).UtcDateTime;
    }
}
