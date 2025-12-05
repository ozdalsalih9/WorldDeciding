using Microsoft.AspNetCore.Identity;

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

    // Basit enum (ileride Domain'e taşınabilir)
    public enum Gender : short
    {
        Unknown = 0,
        Male = 1,
        Female = 2,
        Other = 3,
        PreferNotToSay = 4
    }
}
