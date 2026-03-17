namespace WorldDeciding.Application.Questions.Queries.CountryCompare;

public sealed record CountryCompareDto(
    Guid QuestionId,
    CountryBucketDto Left,
    CountryBucketDto Right,
    CountryBucketDto Global
);

public sealed record CountryBucketDto(
    string CountryCode,
    int TotalCount,
    IReadOnlyList<OptionCountDto> Options,
    bool IsSuppressed // privacy guard (az data)
);

public sealed record OptionCountDto(
    Guid OptionId,
    int Count,
    double Percentage
);