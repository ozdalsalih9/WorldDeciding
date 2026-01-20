using WorldDeciding.Application.Common.Models;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Common.Interfaces;

public record UserDemographics(Gender Gender, DateOnly? BirthDate);

public interface IUserDemographicsReader
{
    Task<List<UserDemographics>> GetByQuestionIdAsync(Guid questionId, CancellationToken ct);
}
