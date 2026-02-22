public interface IUserScoreService
{
    Task AddVoteScoreAsync(Guid userId, CancellationToken ct);
}
