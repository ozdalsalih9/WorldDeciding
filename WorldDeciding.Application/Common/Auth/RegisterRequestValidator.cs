using FluentValidation;


namespace WorldDeciding.Application.Common.Auth;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(10)
            .Matches("[0-9]").WithMessage("Password must contain at least 1 digit.")
            .Matches("[A-Z]").WithMessage("Password must contain at least 1 uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain at least 1 lowercase letter.")
            .Matches("[^a-zA-Z0-9]").WithMessage("Password must contain at least 1 symbol.");

        // 13+ yaş (opsiyonel ama önerilir)
        RuleFor(x => x.BirthDate)
            .Must(b => b is null || b <= DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-13)))
            .WithMessage("Users must be 13+.");

        RuleFor(x => x.Gender)
            .Must(g => g is null || (g >= 0 && g <= 4))
            .WithMessage("Invalid gender.");
    }
}
