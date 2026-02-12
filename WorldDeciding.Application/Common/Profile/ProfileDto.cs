namespace WorldDeciding.Application.Common.Profile;

public record MyProfileDto(
    Guid UserId,
    string Email,
    string? DisplayName,
    string? Bio,
    string? AvatarUrl,
    string? CountryCode,
    DateOnly? BirthDate,
    short Gender
);

public record UpdateMyProfileReq(
    string? DisplayName,
    string? Bio,
    string? AvatarUrl,
    string? CountryCode,
    DateOnly? BirthDate,
    short? Gender
);
