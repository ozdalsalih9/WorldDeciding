using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Queries.AdminListQuestions;

public record AdminQuestionListItemDto(
    Guid Id,
    string Title,
    QuestionStatus Status,
    string Language,
    DateTime CreatedAt,
    DateTime? PublishedAt,
    QuestionType Type
);