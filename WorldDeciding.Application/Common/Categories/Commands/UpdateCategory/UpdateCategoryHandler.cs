using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Categories.Dtos;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Common.Categories.Commands.UpdateCategory;

public sealed class UpdateCategoryHandler : IRequestHandler<UpdateCategoryCommand, CategoryDto>
{
    private readonly IAppDbContext _db;
    public UpdateCategoryHandler(IAppDbContext db) => _db = db;

    public async Task<CategoryDto> Handle(UpdateCategoryCommand request, CancellationToken ct)
    {
        var entity = await _db.Set<Category>().FirstOrDefaultAsync(x => x.Id == request.Id, ct);
        if (entity is null) throw new KeyNotFoundException("Category not found.");

        // slug başka kategori tarafından kullanılıyor mu?
        var slugUsed = await _db.Set<Category>().AsNoTracking()
            .AnyAsync(x => x.Id != request.Id && x.Slug == request.Slug, ct);
        if (slugUsed) throw new InvalidOperationException("Slug already exists.");

        entity.Slug = request.Slug;
        entity.Name = request.Name;

        await _db.SaveChangesAsync(ct);
        return new CategoryDto { Id = entity.Id, Slug = entity.Slug, Name = entity.Name };
    }
}
