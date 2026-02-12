namespace WorldDeciding.Application.Common.Interfaces;

public static class IClientContextExtensions
{
    // Burayı senin gerçek kullanıcı id kaynağına bağlayacağız.
    // Şimdilik 2 olası pattern koyuyorum:
    public static Guid GetUserIdOrThrow(this IClientContext ctx)
    {
        // Eğer sende Guid? UserId varsa:
        if (TryGetUserId(ctx, out var id))
            return id;

        throw new UnauthorizedAccessException("Login required.");
    }

    private static bool TryGetUserId(IClientContext ctx, out Guid id)
    {
        // 1) Eğer sende "UserId" property’si varsa bunu açıp kullan:
        // id = ctx.UserId!.Value; return ctx.UserId.HasValue;

        // 2) Eğer sende "UserIdString" gibi bir şey varsa parse et:
        // if (!string.IsNullOrWhiteSpace(ctx.UserIdString) && Guid.TryParse(ctx.UserIdString, out id)) return true;

        id = default;
        return false;
    }
}
