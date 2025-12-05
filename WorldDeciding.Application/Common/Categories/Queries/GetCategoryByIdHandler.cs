using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Categories.Dtos;
using WorldDeciding.Application.Common.Categories.Queries;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Common.Categories;

public sealed class GetCategoryByIdHandler : IRequestHandler<GetCategoryByIdQuery, CategoryDto?>
{
    private readonly IAppDbContext _db;
    public GetCategoryByIdHandler(IAppDbContext db) => _db = db;

    public async Task<CategoryDto?> Handle(GetCategoryByIdQuery request, CancellationToken ct)
        => await _db.Set<Category>().AsNoTracking()
            .Where(x => x.Id == request.Id)
            .Select(x => new CategoryDto { Id = x.Id, Slug = x.Slug, Name = x.Name })
            .FirstOrDefaultAsync(ct);
}

public sealed class ListCategoriesHandler : IRequestHandler<ListCategoriesQuery, List<CategoryDto>>
{
    private readonly IAppDbContext _db;
    public ListCategoriesHandler(IAppDbContext db) => _db = db;

    public async Task<List<CategoryDto>> Handle(ListCategoriesQuery request, CancellationToken ct)
        => await _db.Set<Category>().AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new CategoryDto { Id = x.Id, Slug = x.Slug, Name = x.Name })
            .ToListAsync(ct);
}
