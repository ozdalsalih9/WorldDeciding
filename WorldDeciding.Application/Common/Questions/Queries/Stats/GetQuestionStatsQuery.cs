using MediatR;

public record GetQuestionStatsQuery(Guid QuestionId) : IRequest<QuestionStatsDto>;

public class QuestionStatsDto
{
    public Guid QuestionId { get; set; }
    public List<OptionCount> Options { get; set; } = new();
    public List<CountryCount> ByCountry { get; set; } = new();
    public record OptionCount(Guid OptionId, string OptionText, int Count, double Percentage);
    public record CountryCount(string CountryCode, int Count, double Percentage);
}
