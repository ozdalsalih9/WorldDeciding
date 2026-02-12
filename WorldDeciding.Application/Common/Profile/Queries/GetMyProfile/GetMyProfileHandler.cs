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
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new MyProfileDto(
                u.Id,
                u.Email ?? "",
                u.DisplayName,
                u.Bio,
                u.AvatarUrl,
                u.CountryCode,
                u.BirthDate,
                (short)u.Gender
            ))
            .FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("User not found.");

        return user;
    }
}
