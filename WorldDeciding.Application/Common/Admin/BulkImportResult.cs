namespace WorldDeciding.Application.Common.Admin;

public record BulkImportResult(
    int Total,
    int Inserted,
    int Failed,
    List<BulkImportError> Errors
);

public record BulkImportError(
    int Index,
    string Message
);