using MediatR;

namespace WorldDeciding.Application.Questions.Commands.PublishQuestion;

public record PublishQuestionCommand(Guid QuestionId) : IRequest;