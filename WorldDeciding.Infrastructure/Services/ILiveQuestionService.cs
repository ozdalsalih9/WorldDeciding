using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
using WorldDeciding.Domain.Entities;
using WorldDeciding.Infrastructure.Persistence;

public interface ILiveQuestionService
{
    Task<LiveQuestionDto?> GetLiveQuestionAsync(CancellationToken ct);
}

public class LiveQuestionService : ILiveQuestionService
{
    private readonly WorldDecidingDbContext _db;
    private readonly IDistributedCache _cache;

    public LiveQuestionService(WorldDecidingDbContext db, IDistributedCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<LiveQuestionDto?> GetLiveQuestionAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var bucket = GetBucket(now);
        var rotatesAt = GetBucketEndUtc(now);

        var cacheKey = $"live:question:{bucket}";
        var cached = await _cache.GetStringAsync(cacheKey, ct);
        if (!string.IsNullOrWhiteSpace(cached))
        {
            var cachedDto = JsonSerializer.Deserialize<LiveQuestionDto>(cached);
            if (cachedDto is not null) return cachedDto;
        }

        // Seed: bucket'a göre deterministik
        var seed = bucket.ToString();

        // 1) Sadece Binary sorulardan 1 tane seç (deterministik random)
        // Not: Questions tablonun adı/kolonlar sende farklıysa uyarlarsın.
        // EF ile md5 order için raw SQL en temiz.
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
