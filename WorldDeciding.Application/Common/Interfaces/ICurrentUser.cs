namespace WorldDeciding.Application.Common.Interfaces;

public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    Guid? UserId { get; } // null olabilir (anon); biz comment için zorunlu kılacağız
}
