using System.Text.Json;
using WorldDeciding.Application.Common.Interfaces;
using WorldDeciding.Infrastructure.Security;

namespace WorldDeciding.UnitTests;

public sealed class IpQualityScoreVpnDetectionServiceTests
{
    [Fact]
    public void ParseIpQualityScoreResponse_BlocksVpn()
    {
        var result = Parse("""{"success":true,"vpn":true,"proxy":false,"tor":false,"fraud_score":20,"country_code":"US"}""");

        Assert.True(result.ShouldBlock);
        Assert.True(result.Vpn);
        Assert.Contains("vpn", result.RiskReason);
        Assert.Equal("US", result.CountryCode);
    }

    [Fact]
    public void ParseIpQualityScoreResponse_BlocksProxy()
    {
        var result = Parse("""{"success":true,"proxy":true,"vpn":false,"tor":false,"fraud_score":20}""");

        Assert.True(result.ShouldBlock);
        Assert.True(result.Proxy);
        Assert.Contains("proxy", result.RiskReason);
    }

    [Fact]
    public void ParseIpQualityScoreResponse_BlocksTor()
    {
        var result = Parse("""{"success":true,"active_tor":true,"vpn":false,"proxy":false,"fraud_score":20}""");

        Assert.True(result.ShouldBlock);
        Assert.True(result.Tor);
        Assert.Contains("tor", result.RiskReason);
    }

    [Fact]
    public void ParseIpQualityScoreResponse_BlocksHighFraudScore()
    {
        var result = Parse("""{"success":true,"proxy":false,"vpn":false,"tor":false,"fraud_score":90}""");

        Assert.True(result.ShouldBlock);
        Assert.Equal(90, result.FraudScore);
        Assert.Contains("high_fraud_score", result.RiskReason);
    }

    [Fact]
    public void ParseIpQualityScoreResponse_AllowsCleanResidentialIp()
    {
        var result = Parse("""{"success":true,"proxy":false,"vpn":false,"tor":false,"connection_type":"Residential","fraud_score":12,"country_code":"TR"}""");

        Assert.True(result.IsAvailable);
        Assert.False(result.ShouldBlock);
        Assert.Null(result.RiskReason);
        Assert.Equal("TR", result.CountryCode);
    }

    private static VpnDetectionResult Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return IpQualityScoreVpnDetectionService.ParseIpQualityScoreResponse(document.RootElement, 85);
    }
}
