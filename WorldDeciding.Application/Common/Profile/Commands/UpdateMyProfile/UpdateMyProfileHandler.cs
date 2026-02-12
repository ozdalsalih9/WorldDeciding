using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Application.Common.Models;
using WorldDeciding.Application.Common.Profile;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Profile.Commands.UpdateMyProfile;

public sealed class UpdateMyProfileHandler
    : IRequestHandler<UpdateMyProfileCommand, MyProfileDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public UpdateMyProfileHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<MyProfileDto> Handle(UpdateMyProfileCommand request, CancellationToken ct)
    {
        var userId = _currentUser.UserId
            ?? throw new UnauthorizedAccessException("Login required.");

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new KeyNotFoundException("User not found.");

        // normalize + validate
        string? displayName = string.IsNullOrWhiteSpace(request.Req.DisplayName)
            ? null
            : request.Req.DisplayName.Trim();

        if (displayName is { Length: > 40 })
            throw new ArgumentException("DisplayName max 40.");

        string? bio = string.IsNullOrWhiteSpace(request.Req.Bio)
            ? null
            : request.Req.Bio.Trim();

        if (bio is { Length: > 160 })
            throw new ArgumentException("Bio max 160.");

        string? avatarUrl = string.IsNullOrWhiteSpace(request.Req.AvatarUrl)
            ? null
            : request.Req.AvatarUrl.Trim();

        if (avatarUrl is { Length: > 300 })
            throw new ArgumentException("AvatarUrl max 300.");

        string? country = string.IsNullOrWhiteSpace(request.Req.CountryCode)
            ? null
            : request.Req.CountryCode.Trim().ToUpperInvariant();

        if (country is { Length: > 2 })
            throw new ArgumentException("CountryCode must be ISO2.");

        user.DisplayName = displayName;
        user.Bio = bio;
        user.AvatarUrl = avatarUrl;
        user.CountryCode = country;
        user.BirthDate = request.Req.BirthDate ?? user.BirthDate;

        if (request.Req.Gender.HasValue)
            user.Gender = (Gender)request.Req.Gender.Value;

        await _db.SaveChangesAsync(ct);

        return new MyProfileDto(
            user.Id,
            user.Email ?? "",
            user.DisplayName,
            user.Bio,
            user.AvatarUrl,
            user.CountryCode,
            user.BirthDate,
            (short)user.Gender
        );
    }
}
