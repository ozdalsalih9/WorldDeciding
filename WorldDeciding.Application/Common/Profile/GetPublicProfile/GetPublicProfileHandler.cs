using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Profile;

namespace WorldDeciding.Application.Profile.Queries.GetPublicProfile;

// Query
public record GetPublicProfileQuery(Guid UserId)
    : IRequest<PublicProfileDto?>;

// Handler
public sealed class GetPublicProfileHandler
    : IRequestHandler<GetPublicProfileQuery, PublicProfileDto?>
{
    private readonly IAppDbContext _db;

    public GetPublicProfileHandler(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<PublicProfileDto?> Handle(GetPublicProfileQuery req, CancellationToken ct)
    {
        var u = await _db.Users
            .AsNoTracking()
            .Where(x => x.Id == req.UserId)
            .Select(x => new
            {
                x.Id,
                x.DisplayName,
                x.Bio,
                x.AvatarUrl,
                x.CreatedAt,
                x.Score,
                x.CountryCode,
                x.BirthDate
            })
            .SingleOrDefaultAsync(ct);

        if (u is null)
            return null;

        var displayName = !string.IsNullOrWhiteSpace(u.DisplayName)
            ? u.DisplayName!
            : "Member " + u.Id.ToString().Substring(0, 5);

        var rank = UserRankResolver.GetTag(u.Score);
        var stars = UserRankResolver.GetStars(u.Score);

        var completion = 0;
        if (!string.IsNullOrWhiteSpace(u.DisplayName)) completion += 20;
        if (!string.IsNullOrWhiteSpace(u.Bio)) completion += 20;
        if (!string.IsNullOrWhiteSpace(u.AvatarUrl)) completion += 20;
        if (!string.IsNullOrWhiteSpace(u.CountryCode)) completion += 20;
        if (u.BirthDate.HasValue) completion += 20;

        var totalVotes = await _db.Votes.CountAsync(v => v.UserId == u.Id, ct);
        var totalComments = await _db.Comments.CountAsync(c => c.UserId == u.Id, ct);

        var likesReceived = await _db.CommentLikes
            .Join(_db.Comments,
                l => l.CommentId,
                c => c.Id,
                (l, c) => new { l, c })
            .CountAsync(x => x.c.UserId == u.Id, ct);

        return new PublicProfileDto(
            u.Id,
            displayName,
            u.Bio,
            u.AvatarUrl,
            u.CreatedAt,
            u.Score,
            stars,
            rank,
            completion,
            totalVotes,
            totalComments,
            likesReceived
        );
    }
}
