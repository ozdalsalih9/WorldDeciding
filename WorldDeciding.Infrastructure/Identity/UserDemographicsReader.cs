using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Infrastructure.Persistence;

namespace WorldDeciding.Infrastructure.Identity;

public class UserDemographicsReader : IUserDemographicsReader
{
    private readonly WorldDecidingDbContext _db;
    public UserDemographicsReader(WorldDecidingDbContext db) => _db = db;

    public async Task<List<UserDemographics>> GetByQuestionIdAsync(Guid questionId, CancellationToken ct)
    {
        return await (
            from v in _db.Votes
            join u in _db.Users on v.UserId equals u.Id
            where v.QuestionId == questionId
            select new UserDemographics(u.Gender, u.BirthDate)
        ).ToListAsync(ct);
    }
}
