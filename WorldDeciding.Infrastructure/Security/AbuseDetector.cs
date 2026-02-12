using WorldDeciding.Application.Common.Abuse;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Security;

public sealed class AbuseDetector : IAbuseDetector
{
    private readonly IAbuseStore _store;

    public AbuseDetector(IAbuseStore store)
    {
        _store = store;
    }

    // Key helper
    private static string Key(AbuseAction action, string ipHash, string? userId = null)
        => userId is null
            ? $"abuse:{action}:ip:{ipHash}"
            : $"abuse:{action}:ip:{ipHash}:u:{userId}";

    public async Task<AbuseDecision> CheckAsync(AbuseAction action, string? userId, string ipHash, CancellationToken ct)
    {
        // MVP: tek pencere counter (sliding değil, fixed window). Basit ve yeterli.
        switch (action)
        {
            case AbuseAction.LoginAttempt:
                {
                    // “login denemesi” sayacı (başarılı/başarısız fark etmez istemiyorsan sadece failure’da say)
                    var ttl = TimeSpan.FromMinutes(10);
                    var count = await _store.IncrementAndGetAsync(Key(action, ipHash), ttl, ct);

                    if (count > 30) // çok agresif bot
                        return new(AbuseMode.Throttle, RetryAfterSeconds: 60, Reason: "login spam");

                    return AbuseDecision.Allowed;
                }

            case AbuseAction.ForgotPassword:
                {
                    var ttl = TimeSpan.FromHours(1);
                    var count = await _store.IncrementAndGetAsync(Key(action, ipHash), ttl, ct);

                    if (count > 5)
                        return new(AbuseMode.Throttle, RetryAfterSeconds: 600, Reason: "forgot-password spam");

                    return AbuseDecision.Allowed;
                }

            case AbuseAction.VoteAttempt:
                {
                    // 1 dakika içinde çok fazla vote denemesi (bot DB’yi yoruyor)
                    var ttl = TimeSpan.FromMinutes(1);
                    var count = await _store.IncrementAndGetAsync(Key(action, ipHash, userId), ttl, ct);

                    if (count > 20)
                        return new(AbuseMode.Throttle, RetryAfterSeconds: 30, Reason: "vote spam");

                    return AbuseDecision.Allowed;
                }

            case AbuseAction.ViewAttempt:
                {
                    // View spam’ini “silent drop”: sayma ama cevap ver
                    var ttl = TimeSpan.FromMinutes(1);
                    var count = await _store.IncrementAndGetAsync(Key(action, ipHash), ttl, ct);

                    if (count > 120)
                        return new(AbuseMode.SilentDrop, RetryAfterSeconds: null, Reason: "view spam");

                    return AbuseDecision.Allowed;
                }

            default:
                return AbuseDecision.Allowed;
        }
    }

    public async Task MarkLoginFailureAsync(string ipHash, CancellationToken ct)
    {
        // failure için ayrı counter kullan (bu daha doğru)
        var key = $"abuse:LoginFailure:ip:{ipHash}";
        await _store.IncrementAndGetAsync(key, TimeSpan.FromMinutes(10), ct);
    }
}
