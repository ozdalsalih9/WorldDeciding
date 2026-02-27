using MediatR;
using WorldDeciding.Application.Common.Questions.Dtos;
using WorldDeciding.Application.Questions.Dtos;

public record GetQuestionSummaryQuery(Guid QuestionId)
    : IRequest<QuestionSummaryDto>;