using FluentValidation;
using WorldDeciding.Domain.Entities;

namespace WorldDeciding.Application.Questions.Commands.CreateQuestion;

public class CreateQuestionValidator : AbstractValidator<CreateQuestionCommand>
{
    public CreateQuestionValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Options)
            .NotEmpty()
            .Must(list => list.Distinct(StringComparer.OrdinalIgnoreCase).Count() >=
                          (list.Any() ? list.Count : 0)) // benzersiz
            .WithMessage("Options must be unique.");
        RuleFor(x => x.Type).IsInEnum();
        // Binary ise en az 2, Multi ise en az 3 seçenek gibi kural da ekleyebilirsin:
        RuleFor(x => x.Options).Must((cmd, opts) =>
            cmd.Type == QuestionType.Binary ? opts.Count >= 2 : opts.Count >= 3)
            .WithMessage("Binary questions need >=2 options; Multi questions need >=3 options.");
        RuleFor(x => x.Options).Must((cmd, opts) =>
    cmd.Type == QuestionType.Binary ? opts.Count == 2 : opts.Count >= 3)
    .WithMessage("Binary questions must have exactly 2 options; Multi questions need at least 3 options.");
    }
}
