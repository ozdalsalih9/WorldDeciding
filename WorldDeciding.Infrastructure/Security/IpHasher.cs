using System.Security.Cryptography;
using System.Text;
using WorldDeciding.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace WorldDeciding.Infrastructure.Security;

public class IpHasher : IIpHasher
{
    private readonly string _salt;

    public IpHasher(IConfiguration configuration)
    {
        _salt = configuration["Privacy:IpSalt"]
                ?? throw new InvalidOperationException("Privacy:IpSalt is missing");
    }

    public string Hash(string ip)
    {
        using var sha = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes($"{_salt}|{ip}");
        return Convert.ToHexString(sha.ComputeHash(bytes));
    }
}
