using MediatR;
using WorldDeciding.Application.Questions.Dtos;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Commands.CreateQuestion;

public record CreateQuestionCommand(
    string Title,
    QuestionType Type,
    List<string> Options,
    Guid? CategoryId
) : IRequest<QuestionDto>;