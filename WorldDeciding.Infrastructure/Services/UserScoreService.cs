using WorldDeciding.Application.Common.Interfaces;

public class UserScoreService : IUserScoreService
{
    private readonly IAppDbContext _db;

    public UserScoreService(IAppDbContext db)
    {
        _db = db;
    }

    public async Task AddVoteScoreAsync(Guid userId, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user == null) return;

        user.Score += 10;
        await _db.SaveChangesAsync(ct);
    }
}
