namespace WorldDeciding.Application.Common.Profile;

public record PublicProfileDto(
    Guid UserId,
    string DisplayName,
    string? Bio,
    string? AvatarUrl,
    DateTime CreatedAt,
    int Score,
    int Stars,
    string Rank,
    int ProfileCompletionPercent,
    int TotalVotes,
    int TotalComments,
    int LikesReceived
);
