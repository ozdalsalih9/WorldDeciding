using MediatR;
using WorldDeciding.Application.Common.Categories.Dtos;

namespace WorldDeciding.Application.Common.Categories.Queries;

public sealed record ListCategoriesQuery() : IRequest<List<CategoryDto>>;
