using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WorldDeciding.Application.Common.Interfaces
{
    public interface IAiSummarizer
    {
        Task<string> SummarizeCommentsAsync(
            string questionTitle,
            IReadOnlyList<string> comments,
            CancellationToken ct);
    }
}
