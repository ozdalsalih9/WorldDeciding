public record LiveQuestionDto(
    Guid QuestionId,
    string Title,
    string CategorySlug,
    string CategoryName,
    string Type,
    DateTime RotatesAtUtc,
    List<LiveOptionDto> Options
);

public record LiveOptionDto(Guid OptionId, string Text);
