namespace WorldDeciding.Application.Common.Comments.Models;

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int Take,
    bool HasMore
);
