namespace WorldDeciding.Application.Common.Auth;

public sealed class RegisterRequest
{
    public string Email { get; init; } = default!;
    public string Password { get; init; } = default!;
    public string? CountryCode { get; init; }   // ISO2 (TR, US, ...)

    // Yeni alanlar (ISO "yyyy-MM-dd" formatında gönder)
    public DateOnly? BirthDate { get; init; }   // .NET 8'de native; 7 ve altı ise string gönderebilirsin
    public short? Gender { get; init; }         // 0..4 (Unknown, Male, Female, Other, PreferNotToSay)
}
