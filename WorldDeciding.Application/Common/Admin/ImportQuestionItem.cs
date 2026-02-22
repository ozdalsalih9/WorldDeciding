namespace WorldDeciding.Application.Common.Admin;
public record ImportQuestionItem(
    string QuestionText,
    string Type,              // "SingleChoice" vs
    List<string> Options,
    string Language,
    List<string>? Tags,
    string? Notes,
    string? Source,
    string? CategorySlug
);