using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Queries.AdminGetQuestion;

public record AdminQuestionDetailDto(
    Guid Id,
    string Title,
    QuestionStatus Status,
    string Language,
    string? TagsJson,
    string? Notes,
    string Source,
    DateTime CreatedAt,
    DateTime? PublishedAt,
    QuestionType Type,
    List<AdminQuestionOptionDto> Options
);

public record AdminQuestionOptionDto(string Text);