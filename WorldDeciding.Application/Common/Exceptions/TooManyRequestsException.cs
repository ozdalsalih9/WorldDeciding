namespace WorldDeciding.Application.Common.Exceptions;

public sealed class TooManyRequestsException : Exception
{
    public int RetryAfterSeconds { get; }

    public TooManyRequestsException(string message, int retryAfterSeconds)
        : base(message)
    {
        RetryAfterSeconds = retryAfterSeconds;
    }
}
