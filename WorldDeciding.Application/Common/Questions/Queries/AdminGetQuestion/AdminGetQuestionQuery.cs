using MediatR;

namespace WorldDeciding.Application.Questions.Queries.AdminGetQuestion;

public record AdminGetQuestionQuery(Guid Id) : IRequest<AdminQuestionDetailDto>;