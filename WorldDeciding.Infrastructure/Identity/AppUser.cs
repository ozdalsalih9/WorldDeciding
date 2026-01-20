using Microsoft.AspNetCore.Identity;
using WorldDeciding.Application.Common.Models;

namespace WorldDeciding.Infrastructure.Identity
{
    public class AppUser : IdentityUser<Guid>
    {
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Opsiyonel ülke beyanı (mevcut)
        public string? CountryCode { get; set; } // ISO2

        // --- Yeni demografi alanları ---
        // Npgsql/EFCore 7+ ise DateOnly; daha eski ise DateTime? kullan
        public DateOnly? BirthDate { get; set; }

        public Gender Gender { get; set; } = Gender.Unknown;
    }


}
