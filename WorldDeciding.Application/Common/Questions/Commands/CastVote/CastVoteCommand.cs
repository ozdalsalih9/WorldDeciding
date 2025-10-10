using MediatR;

namespace WorldDeciding.Application.Votes.Commands.CastVote;

public record CastVoteCommand(Guid QuestionId, Guid OptionId) : IRequest<Unit>;
