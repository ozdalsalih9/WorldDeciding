using Microsoft.AspNetCore.Identity;
using WorldDeciding.Application.Common.Models;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Domain.Identity;

public class AppUser : IdentityUser<Guid>
{
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CountryCode { get; set; }
    public DateOnly? BirthDate { get; set; }
    public Gender Gender { get; set; } = Gender.Unknown;

    public string? DisplayName { get; set; }
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }
    public int Score { get; set; } = 0;

}
