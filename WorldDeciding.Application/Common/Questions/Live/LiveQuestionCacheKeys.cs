namespace WorldDeciding.Application.Common.Questions.Live;

public static class LiveQuestionCacheKeys
{
    public static string ForUtcNow(DateTime utcNow) => $"live:question:{GetBucket(utcNow)}";

    public static long GetBucket(DateTime utcNow)
    {
        var epoch = new DateTimeOffset(utcNow).ToUnixTimeSeconds();
        return epoch / 300;
    }

    public static DateTime GetBucketEndUtc(DateTime utcNow)
    {
        var epoch = new DateTimeOffset(utcNow).ToUnixTimeSeconds();
        var bucketEnd = ((epoch / 300) + 1) * 300;
        return DateTimeOffset.FromUnixTimeSeconds(bucketEnd).UtcDateTime;
    }
}
