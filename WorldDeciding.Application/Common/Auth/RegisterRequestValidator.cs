using FluentValidation;


namespace WorldDeciding.Application.Common.Auth;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6);

        // 13+ yaş (opsiyonel ama önerilir)
        RuleFor(x => x.BirthDate)
            .Must(b => b is null || b <= DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-13)))
            .WithMessage("Users must be 13+.");

        RuleFor(x => x.Gender)
            .Must(g => g is null || (g >= 0 && g <= 4))
            .WithMessage("Invalid gender.");
    }
}
