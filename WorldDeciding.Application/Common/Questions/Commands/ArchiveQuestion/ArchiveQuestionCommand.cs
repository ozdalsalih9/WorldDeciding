using MediatR;

namespace WorldDeciding.Application.Questions.Commands.ArchiveQuestion;

public record ArchiveQuestionCommand(Guid QuestionId) : IRequest;