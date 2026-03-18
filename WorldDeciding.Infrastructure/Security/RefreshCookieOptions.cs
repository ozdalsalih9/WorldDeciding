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
        public bool Secure { get; set; } = true;
        public string SameSite { get; set; } = "None";
    }
}
