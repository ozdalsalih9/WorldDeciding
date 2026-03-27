namespace WorldDeciding.Application.Questions.Queries.CountryCompare;

public sealed record CountryCompareDto(
    Guid QuestionId,
    CountryBucketDto Left,
    CountryBucketDto Right,
    CountryBucketDto Global,
    string AiSummary,
    DateTime AiGeneratedAt
);

public sealed record CountryBucketDto(
    string CountryCode,
    int TotalCount,
    IReadOnlyList<OptionCountDto> Options,
    bool IsSuppressed = false
);

public sealed record OptionCountDto(
    Guid OptionId,
    int Count,
    double Percentage
);
