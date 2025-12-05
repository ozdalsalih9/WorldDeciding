using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Categories.Dtos;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Common.Categories.Commands.CreateCategory;

public sealed class CreateCategoryHandler : IRequestHandler<CreateCategoryCommand, CategoryDto>
{
    private readonly IAppDbContext _db;
    public CreateCategoryHandler(IAppDbContext db) => _db = db;

    public async Task<CategoryDto> Handle(CreateCategoryCommand request, CancellationToken ct)
    {
        // benzersiz slug kontrolü
        var exists = await _db.Set<Category>().AsNoTracking()
            .AnyAsync(x => x.Slug == request.Slug, ct);
        if (exists) throw new InvalidOperationException("Slug already exists.");

        var entity = new Category
        {
            Id = Guid.NewGuid(),
            Slug = request.Slug,
            Name = request.Name
        };

        await _db.Set<Category>().AddAsync(entity, ct);
        await _db.SaveChangesAsync(ct);

        return new CategoryDto { Id = entity.Id, Slug = entity.Slug, Name = entity.Name };
    }
}
