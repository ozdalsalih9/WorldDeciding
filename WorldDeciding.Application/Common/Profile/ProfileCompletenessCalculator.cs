using WorldDeciding.Domain.Identity;
 

namespace WorldDeciding.Application.Common.Profile;

public static class ProfileCompletenessCalculator
{
    public static int Calculate(AppUser u)
    {
        int s = 0;
        if (!string.IsNullOrWhiteSpace(u.DisplayName)) s += 20;
        if (!string.IsNullOrWhiteSpace(u.Bio)) s += 20;
        if (!string.IsNullOrWhiteSpace(u.AvatarUrl)) s += 20;
        if (!string.IsNullOrWhiteSpace(u.CountryCode)) s += 20;
        if (u.BirthDate.HasValue) s += 20;
        return s;
    }
}
