using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WorldDeciding.Infrastructure.Security
{
    public sealed class RefreshCookieOptions
    {
        public string Name { get; set; } = "wd_refresh";
        public string Path { get; set; } = "/api/auth/refresh";
        public int Days { get; set; } = 30;
        public bool HttpOnly { get; set; } = true;
        public bool Secure { get; set; } = false; // dev'de false, prod'da true
        public string SameSite { get; set; } = "Lax"; // prod subdomain senaryosunda None olabilir
    }
}
