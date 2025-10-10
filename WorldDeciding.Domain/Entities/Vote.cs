namespace WorldDeciding.Domain.Entities;

public enum CountrySource : short
{
    Unknown = 0,
    Inferred = 1, // IP'den tahmin
    Declared = 2  // kullanıcı beyanı
}

public class Vote
{
    public Guid Id { get; set; }
    public Guid QuestionId { get; set; }
    public Guid OptionId { get; set; }
    public Guid UserId { get; set; }           // anonymous oylar için ileride nullable yapılabilir
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Ülke bilgisi (IP saklanmayacak!)
    public string? CountryCode { get; set; }   // ISO-3166-1 alpha-2 (TR, US...)
    public CountrySource CountrySource { get; set; }
    public string? CountryProvider { get; set; }   // "MaxMind" gibi
    public double? CountryConfidence { get; set; } // 0..1 (opsiyonel)
}