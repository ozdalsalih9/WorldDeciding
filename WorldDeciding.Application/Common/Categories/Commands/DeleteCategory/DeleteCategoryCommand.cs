using MediatR;

namespace WorldDeciding.Application.Common.Categories.Commands.DeleteCategory;

public sealed record DeleteCategoryCommand(Guid Id) : IRequest<bool>;
