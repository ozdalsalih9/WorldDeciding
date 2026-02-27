using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Ai;

public sealed class GptSummarizer : IAiSummarizer
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly ILogger<GptSummarizer> _logger;

    public GptSummarizer(HttpClient http, IConfiguration cfg, ILogger<GptSummarizer> logger)
    {
        _http = http;
        _logger = logger;
        _apiKey = cfg["Gemini:ApiKey"]
            ?? throw new InvalidOperationException("Gemini ApiKey not configured.");
        _model = cfg["Gemini:Model"] ?? "gemini-2.5-flash";

        _http.BaseAddress = new Uri("https://generativelanguage.googleapis.com/");
    }

    public async Task<string> SummarizeCommentsAsync(
        string questionTitle,
        IReadOnlyList<string> comments,
        CancellationToken ct)
    {
        if (comments.Count == 0)
            return "No comments yet.";

        try
        {
            var prompt = $"""
You are summarizing a casual online discussion.

Question:
"{questionTitle}"

Instructions:
- Casual, neutral, human tone
- 3-5 short bullet points
- Reflect different opinions
- No ads, no promotion
- No academic or scientific language

Comments:
- {string.Join("\n- ", comments.Take(80))}
""";

            var body = new
            {
                contents = new[]
                {
                    new
                    {
                        role = "user",
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                }
            };

            using var req = new HttpRequestMessage(
                HttpMethod.Post,
                $"v1beta/models/{_model}:generateContent");

            req.Headers.Add("x-goog-api-key", _apiKey);
            req.Content = new StringContent(
                JsonSerializer.Serialize(body),
                Encoding.UTF8,
                "application/json");

            using var res = await _http.SendAsync(req, ct);
            var raw = await res.Content.ReadAsStringAsync(ct);

            if (res.StatusCode == HttpStatusCode.TooManyRequests)
                return "Summary is temporarily unavailable due to high demand.";

            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("Gemini HTTP {StatusCode}", res.StatusCode);
                return "Summary could not be generated at the moment.";
            }

            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;

            // Prompt-level block kontrolü
            if (root.TryGetProperty("promptFeedback", out var promptFeedback) &&
                promptFeedback.TryGetProperty("blockReason", out var blockReason))
            {
                _logger.LogWarning("Gemini prompt blocked: {Reason}", blockReason);
                return "Summary could not be generated at the moment.";
            }

            if (!root.TryGetProperty("candidates", out var candidates) ||
                candidates.ValueKind != JsonValueKind.Array ||
                candidates.GetArrayLength() == 0)
            {
                _logger.LogWarning("Gemini response has no candidates");
                return "Summary could not be generated at the moment.";
            }

            var candidate = candidates[0];

            if (candidate.TryGetProperty("finishReason", out var finishReason))
            {
                var finishReasonValue = finishReason.GetString();
                if (!string.IsNullOrWhiteSpace(finishReasonValue) &&
                    !finishReasonValue.Equals("STOP", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("Gemini finishReason: {FinishReason}", finishReasonValue);
                }
            }

            if (!candidate.TryGetProperty("content", out var content) ||
                !content.TryGetProperty("parts", out var parts) ||
                parts.ValueKind != JsonValueKind.Array ||
                parts.GetArrayLength() == 0)
            {
                _logger.LogWarning("Gemini response has no content parts");
                return "Summary could not be generated at the moment.";
            }

            var texts = new List<string>();
            foreach (var part in parts.EnumerateArray())
            {
                if (part.TryGetProperty("text", out var textProp))
                {
                    var txt = textProp.GetString();
                    if (!string.IsNullOrWhiteSpace(txt))
                        texts.Add(txt.Trim());
                }
            }

            if (texts.Count == 0)
            {
                _logger.LogWarning("Gemini parts exist but no text field found");
                return "Summary could not be generated.";
            }

            return string.Join("\n", texts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gemini summarization exception");
            return "Summary is currently unavailable.";
        }
    }
}
