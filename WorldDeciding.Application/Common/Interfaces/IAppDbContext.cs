using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Common.Interfaces;

public interface IAppDbContext
{
    DbSet<Question> Questions { get; }
    DbSet<Option> Options { get; }
    DbSet<Vote> Votes { get; }
    DbSet<Comment> Comments { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
