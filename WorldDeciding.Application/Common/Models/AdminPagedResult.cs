namespace WorldDeciding.Application.Common.Models;

public record AdminPagedResult<T>(
    List<T> Items,
    int Total,
    int Page,
    int PageSize
);