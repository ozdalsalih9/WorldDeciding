using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using System.Collections.Generic;
using WorldDeciding.Domain.Entities;
using WorldDeciding.Domain.Identity;

namespace WorldDeciding.Application.Common.Interfaces;

public interface IAppDbContext
{
    DbSet<Question> Questions { get; }
    DbSet<Option> Options { get; }
    DbSet<Vote> Votes { get; }
    DbSet<Comment> Comments { get; }
    DbSet<CommentLike> CommentLikes { get; }
    DbSet<QuestionView> QuestionViews { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<AppUser> Users { get; }
    DbSet<TEntity> Set<TEntity>() where TEntity : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    DatabaseFacade Database { get; }
}
