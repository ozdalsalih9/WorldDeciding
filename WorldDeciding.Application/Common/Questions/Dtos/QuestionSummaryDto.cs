using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WorldDeciding.Application.Common.Questions.Dtos
{
    public record QuestionSummaryDto(
     Guid QuestionId,
     string Summary,
     DateTime GeneratedAt
 );
}
