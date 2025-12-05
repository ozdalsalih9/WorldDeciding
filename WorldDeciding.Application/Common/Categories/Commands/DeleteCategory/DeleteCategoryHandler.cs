using MediatR;
using Microsoft.EntityFrameworkCore;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Common.Categories.Commands.DeleteCategory;

public sealed class DeleteCategoryHandler : IRequestHandler<DeleteCategoryCommand, bool>
{
    private readonly IAppDbContext _db;
    public DeleteCategoryHandler(IAppDbContext db) => _db = db;

    public async Task<bool> Handle(DeleteCategoryCommand request, CancellationToken ct)
    {
        var entity = await _db.Set<Category>().FirstOrDefaultAsync(x => x.Id == request.Id, ct);
        if (entity is null) return false;

        _db.Set<Category>().Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
