namespace WorldDeciding.Application.Common.Profile;

public record MyProfileDto(
    Guid UserId,
    string Email,
    string DisplayName,
    string? Bio,
    string? AvatarUrl,
    string? CountryCode,
    DateOnly? BirthDate,
    short Gender,
    int Score,
    int Stars,
    string Rank,
    int ProfileCompletionPercent,
    int TotalVotes,
    int TotalComments,
    int LikesReceived,
    IReadOnlyList<string> Badges




);

public record UpdateMyProfileReq(
    string? DisplayName,
    string? Bio,
    string? AvatarUrl,
    string? CountryCode,
    DateOnly? BirthDate,
    short? Gender
);
