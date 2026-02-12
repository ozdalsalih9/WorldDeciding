using WorldDeciding.Application.Common.Abuse;

namespace WorldDeciding.Application.Common.Interfaces;

public interface IAbuseDetector
{
    Task<AbuseDecision> CheckAsync(
        AbuseAction action,
        string? userId,
        string ipHash,
        CancellationToken ct);

    // Auth için: başarısız login denemelerini ayrıca işaretlemek isteriz
    Task MarkLoginFailureAsync(string ipHash, CancellationToken ct);
}
