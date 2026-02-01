namespace WorldDeciding.Infrastructure.Email;

public class SmtpOptions
{
    public string Host { get; set; } = default!;
    public int Port { get; set; }
    public string Username { get; set; } = default!;
    public string Password { get; set; } = default!;
    public bool EnableSsl { get; set; }

    public string FromEmail { get; set; } = default!;
    public string FromName { get; set; } = default!;
}
