using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using WorldDeciding.Application.Common.Interfaces;

namespace WorldDeciding.Infrastructure.Ai;

public sealed class GptSummarizer : IAiSummarizer
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly string _apiVersion;
    private readonly ILogger<GptSummarizer> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public GptSummarizer(HttpClient http, IConfiguration cfg, ILogger<GptSummarizer> logger)
    {
        _http = http;
        _logger = logger;
        _apiKey = cfg["Gemini:ApiKey"]
            ?? throw new InvalidOperationException("Gemini ApiKey not configured.");
        _model = cfg["Gemini:Model"] ?? "gemini-2.5-flash";
        _apiVersion = cfg["Gemini:ApiVersion"] ?? "v1beta";

        _http.BaseAddress = new Uri("https://generativelanguage.googleapis.com/");
    }

    public async Task<string> SummarizeCommentsAsync(
        string questionTitle,
        IReadOnlyList<string> comments,
        CancellationToken ct)
    {
        var cleanedTitle = SanitizeText(questionTitle, 200);
        var cleanedComments = comments
            .Select(comment => SanitizeText(comment, 1_200))
            .Where(comment => !string.IsNullOrWhiteSpace(comment))
            .Distinct(StringComparer.Ordinal)
            .Take(80)
            .ToList();

        if (cleanedComments.Count == 0)
            return BuildNoCommentsSummary(cleanedTitle);

        try
        {
            var prompt = $"""
Question:
"{cleanedTitle}"

Recent comments:
- {string.Join("\n- ", cleanedComments)}
""";

            var body = new GeminiGenerateContentRequest(
                SystemInstruction: new GeminiContent(
                    Parts:
                    [
                        new GeminiPart(
                            "Summarize the discussion in 3 to 5 short bullet points. Keep the tone neutral, casual, and readable. Reflect disagreement where it exists. Do not invent facts, do not add promotion, and do not use academic phrasing.")
                    ]),
                Contents:
                [
                    new GeminiContent(
                        Parts:
                        [
                            new GeminiPart(prompt)
                        ],
                        Role: "user")
                ],
                GenerationConfig: new GeminiGenerationConfig(
                    Temperature: 0.4m,
                    TopP: 0.9m,
                    MaxOutputTokens: 256));

            var requestJson = JsonSerializer.Serialize(body, JsonOptions);
            var requestPath = $"{_apiVersion}/models/{_model}:generateContent";

            _logger.LogDebug("Gemini generateContent request path: {Path}", requestPath);
            _logger.LogDebug("Gemini generateContent request body: {RequestBody}", requestJson);

            using var req = new HttpRequestMessage(HttpMethod.Post, requestPath);
            req.Headers.Add("x-goog-api-key", _apiKey);
            req.Content = new StringContent(requestJson, Encoding.UTF8, "application/json");

            using var res = await _http.SendAsync(req, ct);
            var raw = await res.Content.ReadAsStringAsync(ct);

            if (res.StatusCode == HttpStatusCode.TooManyRequests)
            {
                _logger.LogWarning("Gemini HTTP 429 response body: {ResponseBody}", raw);
                return BuildFallbackSummary(cleanedTitle, cleanedComments.Count);
            }

            if (!res.IsSuccessStatusCode)
            {
                if (res.StatusCode == HttpStatusCode.BadRequest)
                {
                    _logger.LogWarning("Gemini HTTP 400 response body: {ResponseBody}", raw);
                }
                else
                {
                    _logger.LogWarning("Gemini HTTP {StatusCode} response body: {ResponseBody}", res.StatusCode, raw);
                }

                return BuildFallbackSummary(cleanedTitle, cleanedComments.Count);
            }

            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;

            if (root.TryGetProperty("promptFeedback", out var promptFeedback) &&
                promptFeedback.TryGetProperty("blockReason", out var blockReason))
            {
                _logger.LogWarning("Gemini prompt blocked: {Reason}", blockReason);
                return BuildFallbackSummary(cleanedTitle, cleanedComments.Count);
            }

            if (!root.TryGetProperty("candidates", out var candidates) ||
                candidates.ValueKind != JsonValueKind.Array ||
                candidates.GetArrayLength() == 0)
            {
                _logger.LogWarning("Gemini response has no candidates");
                return BuildFallbackSummary(cleanedTitle, cleanedComments.Count);
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
                return BuildFallbackSummary(cleanedTitle, cleanedComments.Count);
            }

            var texts = new List<string>();
            foreach (var part in parts.EnumerateArray())
            {
                if (part.TryGetProperty("text", out var textProp))
                {
                    var text = textProp.GetString();
                    if (!string.IsNullOrWhiteSpace(text))
                        texts.Add(text.Trim());
                }
            }

            if (texts.Count == 0)
            {
                _logger.LogWarning("Gemini parts exist but no text field found");
                return BuildFallbackSummary(cleanedTitle, cleanedComments.Count);
            }

            return string.Join("\n", texts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gemini summarization exception");
            return BuildFallbackSummary(cleanedTitle, cleanedComments.Count);
        }
    }

    private static string BuildNoCommentsSummary(string questionTitle)
    {
        if (string.IsNullOrWhiteSpace(questionTitle))
            return "No comments yet for this question.";

        return $"No comments yet for \"{questionTitle}\".";
    }

    private static string BuildFallbackSummary(string questionTitle, int commentCount)
    {
        var discussionLabel = string.IsNullOrWhiteSpace(questionTitle)
            ? "this question"
            : $"\"{questionTitle}\"";

        return commentCount switch
        {
            <= 0 => $"No comments yet for {discussionLabel}.",
            1 => $"There is 1 recent comment on {discussionLabel}. AI summary is temporarily unavailable, so showing the raw discussion is recommended.",
            _ => $"There are {commentCount} recent comments on {discussionLabel}. AI summary is temporarily unavailable right now, but the discussion is active."
        };
    }

    private static string SanitizeText(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var trimmed = value.Trim();
        var builder = new StringBuilder(trimmed.Length);

        foreach (var ch in trimmed)
        {
            if (!char.IsControl(ch) || ch is '\n' or '\r' or '\t')
                builder.Append(ch);
        }

        var normalized = builder
            .ToString()
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Trim();

        return normalized.Length <= maxLength
            ? normalized
            : normalized[..maxLength];
    }

    private sealed record GeminiGenerateContentRequest(
        [property: JsonPropertyName("system_instruction")] GeminiContent SystemInstruction,
        [property: JsonPropertyName("contents")] IReadOnlyList<GeminiContent> Contents,
        [property: JsonPropertyName("generationConfig")] GeminiGenerationConfig GenerationConfig);

    private sealed record GeminiContent(
        [property: JsonPropertyName("parts")] IReadOnlyList<GeminiPart> Parts,
        [property: JsonPropertyName("role")] string? Role = null);

    private sealed record GeminiPart(
        [property: JsonPropertyName("text")] string Text);

    private sealed record GeminiGenerationConfig(
        [property: JsonPropertyName("temperature")] decimal Temperature,
        [property: JsonPropertyName("topP")] decimal TopP,
        [property: JsonPropertyName("maxOutputTokens")] int MaxOutputTokens);
}
