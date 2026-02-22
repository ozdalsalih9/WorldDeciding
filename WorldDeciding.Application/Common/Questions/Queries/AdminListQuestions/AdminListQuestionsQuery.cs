using MediatR;
using WorldDeciding.Application.Common.Models;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Queries.AdminListQuestions;

public record AdminListQuestionsQuery(
    QuestionStatus? Status,
    string? Language,
    string? Search,
    int Page = 1,
    int PageSize = 20
) : IRequest<AdminPagedResult<AdminQuestionListItemDto>>;