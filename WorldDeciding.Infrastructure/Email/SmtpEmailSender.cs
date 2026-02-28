using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Mail;
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
            Body = htmlBody ?? "",
            IsBodyHtml = true
        };

        message.To.Add(toAddr);

        using var client = new SmtpClient((_options.Host ?? "").Trim(), _options.Port)
        {
            Credentials = new NetworkCredential((_options.Username ?? "").Trim(), _options.Password ?? ""),
            EnableSsl = _options.EnableSsl
        };

        await client.SendMailAsync(message, ct);
    }
}