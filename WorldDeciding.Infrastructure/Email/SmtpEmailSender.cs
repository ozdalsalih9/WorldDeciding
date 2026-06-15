using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Mail;
using System.Text.RegularExpressions;
using System.Text;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Email;

public class SmtpEmailSender : IEmailSender
{
    private readonly SmtpOptions _options;

    public SmtpEmailSender(IOptions<SmtpOptions> options)
    {
        _options = options.Value;
    }

    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        to = (to ?? "").Trim();

        // Güvenli doğrulama (patlamasın, net hata versin)
        if (!MailAddress.TryCreate(to, out var toAddr))
            throw new InvalidOperationException($"Invalid 'to' email address: '{to}'");

        var fromEmail = (_options.FromEmail ?? "").Trim();
        var fromName = (_options.FromName ?? "WorldDeciding").Trim();

        if (!MailAddress.TryCreate(fromEmail, out var fromAddr))
            throw new InvalidOperationException($"Invalid 'from' email address: '{fromEmail}'");

        using var message = new MailMessage
        {
            From = new MailAddress(fromAddr.Address, fromName, Encoding.UTF8),
            Subject = subject ?? "",
            BodyEncoding = Encoding.UTF8,
            SubjectEncoding = Encoding.UTF8
        };

        message.To.Add(toAddr);
        message.ReplyToList.Add(new MailAddress(fromAddr.Address, fromName, Encoding.UTF8));
        message.Headers.Add("X-Auto-Response-Suppress", "All");

        // Order is important for MIME multipart/alternative:
        // Plain text first, then HTML (most preferred format last).
        message.AlternateViews.Add(
            AlternateView.CreateAlternateViewFromString(
                BuildPlainTextBody(htmlBody),
                Encoding.UTF8,
                "text/plain"));

        message.AlternateViews.Add(
            AlternateView.CreateAlternateViewFromString(
                htmlBody ?? "",
                Encoding.UTF8,
                "text/html"));

        using var client = new SmtpClient((_options.Host ?? "").Trim(), _options.Port)
        {
            Credentials = new NetworkCredential((_options.Username ?? "").Trim(), _options.Password ?? ""),
            EnableSsl = _options.EnableSsl
        };

        await client.SendMailAsync(message, ct);
    }

    private static string BuildPlainTextBody(string? htmlBody)
    {
        if (string.IsNullOrWhiteSpace(htmlBody))
        {
            return string.Empty;
        }

        // Remove <head> and <style> and <script> blocks entirely along with their contents
        var text = Regex.Replace(htmlBody, @"<head[^>]*>[\s\S]*?</head>", string.Empty, RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"<style[^>]*>[\s\S]*?</style>", string.Empty, RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"<script[^>]*>[\s\S]*?</script>", string.Empty, RegexOptions.IgnoreCase);

        text = Regex.Replace(text, "<br\\s*/?>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, "</p\\s*>", "\n\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, "<[^>]+>", string.Empty);
        text = WebUtility.HtmlDecode(text);
        text = Regex.Replace(text, @"\n{3,}", "\n\n");
        return text.Trim();
    }
}
