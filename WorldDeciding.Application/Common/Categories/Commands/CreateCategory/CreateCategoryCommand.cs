using MediatR;
using WorldDeciding.Application.Common.Categories.Dtos;

namespace WorldDeciding.Application.Common.Categories.Commands.CreateCategory;

public sealed record CreateCategoryCommand(string Slug, string Name) : IRequest<CategoryDto>;
