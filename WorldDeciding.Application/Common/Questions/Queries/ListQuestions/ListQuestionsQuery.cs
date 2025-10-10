using MediatR;
using WorldDeciding.Application.Questions.Dtos;
using WorldDeciding.Domain.Entities;

public record ListQuestionsQuery(Guid? CategoryId, QuestionType? Type, int Page = 1, int PageSize = 20)
    : IRequest<IReadOnlyList<QuestionDto>>;
