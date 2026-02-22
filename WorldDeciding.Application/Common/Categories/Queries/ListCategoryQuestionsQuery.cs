using MediatR;
using WorldDeciding.Application.Questions.Dtos;

namespace WorldDeciding.Application.Common.Categories.Queries;

public record ListCategoryQuestionsQuery(Guid CategoryId)
    : IRequest<IReadOnlyList<QuestionDto>>;