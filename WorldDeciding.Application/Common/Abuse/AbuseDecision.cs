namespace WorldDeciding.Application.Common.Abuse;

public enum AbuseAction
{
    LoginAttempt,
    ForgotPassword,
    VoteAttempt,
    ViewAttempt
}

public enum AbuseMode
{
    Allow,
    Throttle,    // 429
    Block,       // 403 (istersen)
    SilentDrop   // request ok, ama view sayma
}

public sealed record AbuseDecision(
    AbuseMode Mode,
    int? RetryAfterSeconds = null,
    string? Reason = null)
{
    public static readonly AbuseDecision Allowed = new(AbuseMode.Allow);
}
