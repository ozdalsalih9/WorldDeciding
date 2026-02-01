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
    DbSet<QuestionView> QuestionViews { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<TEntity> Set<TEntity>() where TEntity : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
