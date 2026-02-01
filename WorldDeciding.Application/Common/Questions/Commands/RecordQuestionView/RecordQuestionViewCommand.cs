using MediatR;

public record RecordQuestionViewCommand(Guid QuestionId) : IRequest;
