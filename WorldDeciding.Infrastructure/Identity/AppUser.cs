using Microsoft.AspNetCore.Identity;

namespace WorldDeciding.Infrastructure.Identity;

public class AppUser : IdentityUser<Guid>
{
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Kullanıcı beyanı (opsiyonel)
    public string? CountryCode { get; set; } // ISO2
}
