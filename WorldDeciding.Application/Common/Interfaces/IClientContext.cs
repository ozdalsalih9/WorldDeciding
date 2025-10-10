using System.Net;

namespace WorldDeciding.Application.Common.Interfaces;

public interface IClientContext
{
    IPAddress? ClientIp { get; }
    string? DeclaredCountryIso2 { get; } // kullanıcı beyanı (profilden veya header'dan)
}
