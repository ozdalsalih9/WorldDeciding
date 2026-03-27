namespace WorldDeciding.Application.Common.Interfaces;

public interface IAiSummarizer
{
    Task<string> SummarizeCommentsAsync(
        string questionTitle,
        IReadOnlyList<string> comments,
        CancellationToken ct);

    Task<string> SummarizeCountryComparisonAsync(
        string questionTitle,
        CountryComparisonSummaryInput input,
        CancellationToken ct);
}

public sealed record CountryComparisonSummaryInput(
    string LeftCountryCode,
    int LeftTotal,
    string RightCountryCode,
    int RightTotal,
    int GlobalTotal,
    IReadOnlyList<CountryComparisonOptionInput> Options);

public sealed record CountryComparisonOptionInput(
    string OptionLabel,
    double LeftPercentage,
    int LeftCount,
    double RightPercentage,
    int RightCount,
    double GlobalPercentage,
    int GlobalCount);
