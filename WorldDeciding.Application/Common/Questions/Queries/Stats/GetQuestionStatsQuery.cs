using MediatR;

public record GetQuestionStatsQuery(Guid QuestionId) : IRequest<QuestionStatsDto>;

public class QuestionStatsDto
{
    public Guid QuestionId { get; set; }

    public List<OptionCount> Options { get; set; } = new();
    public List<CountryCount> ByCountry { get; set; } = new();

    // NEW
    public List<GenderCount> ByGender { get; set; } = new();
    public List<AgeBandCount> ByAgeBands { get; set; } = new();

    public record OptionCount(Guid OptionId, string OptionText, int Count, double Percentage);
    public record CountryCount(string CountryCode, int Count, double Percentage);

    // NEW
    public record GenderCount(string Gender, int Count, double Percentage);
    public record AgeBandCount(string Band, int Count, double Percentage);
}
