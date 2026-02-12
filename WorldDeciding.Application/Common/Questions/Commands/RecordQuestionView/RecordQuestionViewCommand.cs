using MediatR;

namespace WorldDeciding.Application.Questions.Commands.RecordQuestionView;

public sealed record RecordQuestionViewCommand(Guid QuestionId) : IRequest;
