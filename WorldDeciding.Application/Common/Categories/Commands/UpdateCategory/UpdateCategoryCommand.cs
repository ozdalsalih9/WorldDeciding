using MediatR;
using WorldDeciding.Application.Common.Categories.Dtos;

namespace WorldDeciding.Application.Common.Categories.Commands.UpdateCategory;

public sealed record UpdateCategoryCommand(Guid Id, string Slug, string Name) : IRequest<CategoryDto>;
