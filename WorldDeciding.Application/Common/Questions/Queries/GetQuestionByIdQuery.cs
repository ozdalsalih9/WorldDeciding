using MediatR;
using WorldDeciding.Application.Questions.Dtos;

namespace WorldDeciding.Application.Common.Questions.Queries;

public sealed record GetQuestionByIdQuery(Guid Id) : IRequest<QuestionDto?>;
