using FluentValidation;

namespace WorldDeciding.Application.Common.Categories.Commands.CreateCategory;

public sealed class CreateCategoryValidator : AbstractValidator<CreateCategoryCommand>
{
    public CreateCategoryValidator()
    {
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(50)
            .Matches("^[a-z0-9-]+$").WithMessage("Slug only lowercase letters, numbers and hyphen.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(80);
    }
}
