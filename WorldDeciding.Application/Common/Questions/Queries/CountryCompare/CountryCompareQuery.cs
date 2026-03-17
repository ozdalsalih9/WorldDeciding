using MediatR;

namespace WorldDeciding.Application.Questions.Queries.CountryCompare;

public sealed record CountryCompareQuery(
    Guid QuestionId,
    string LeftCountryCode,
    string RightCountryCode
) : IRequest<CountryCompareDto>;