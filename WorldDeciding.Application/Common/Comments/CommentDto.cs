namespace WorldDeciding.Application.Common.Comments;

public enum CommentSort { Top, New }

public record CommentDto(
    Guid Id,
    Guid QuestionId,
    Guid UserId,
    Guid? ParentId,
    string Text,
    DateTime CreatedAt,
    CommentAuthorDto Author,
    int LikeCount,
    bool LikedByMe,
    int ReplyCount
);

public record CommentAuthorDto(
    Guid UserId,
    string DisplayName,
    string? AvatarUrl,
    int Stars,
    string Rank
);

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int Take,
    bool HasMore
);
