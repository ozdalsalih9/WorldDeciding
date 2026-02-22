using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Profile;

namespace WorldDeciding.Application.Profile.Queries.GetMyProfile;

public sealed class GetMyProfileHandler
    : IRequestHandler<GetMyProfileQuery, MyProfileDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetMyProfileHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<MyProfileDto> Handle(GetMyProfileQuery request, CancellationToken ct)
    {
        var userId = _currentUser.UserId
            ?? throw new UnauthorizedAccessException("Login required.");

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new KeyNotFoundException("User not found.");

        // stats
        var totalVotes = await _db.Votes.AsNoTracking().CountAsync(v => v.UserId == userId, ct);
        var totalComments = await _db.Comments.AsNoTracking().CountAsync(c => c.UserId == userId, ct);

        var likesReceived = await _db.CommentLikes
            .AsNoTracking()
            .Join(_db.Comments.AsNoTracking(),
                l => l.CommentId,
                c => c.Id,
                (l, c) => new { l, c })
            .CountAsync(x => x.c.UserId == userId, ct);

        // derived
        var rank = UserRankResolver.GetTag(user.Score);
        var stars = UserRankResolver.GetStars(user.Score);
        var completion = ProfileCompletenessCalculator.Calculate(user);
        var badges = UserBadgesResolver.Resolve(totalVotes, totalComments, likesReceived, user.Score);

        return new MyProfileDto(
            UserId: user.Id,
            Email: user.Email ?? "",
            DisplayName: user.DisplayName,
            Bio: user.Bio,
            AvatarUrl: user.AvatarUrl,
            CountryCode: user.CountryCode,
            BirthDate: user.BirthDate,
            Gender: (short)user.Gender,

            Score: user.Score,
            Stars: stars,
            Rank: rank,

            ProfileCompletionPercent: completion,

            TotalVotes: totalVotes,
            TotalComments: totalComments,
            LikesReceived: likesReceived,

            Badges: badges
        );
    }
}
