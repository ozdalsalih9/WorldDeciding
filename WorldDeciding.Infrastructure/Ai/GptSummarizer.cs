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
    private readonly string? _apiKey;
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
        _apiKey = cfg["Gemini:ApiKey"];
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

        var prompt = $"""
Question:
"{cleanedTitle}"

Recent comments:
- {string.Join("\n- ", cleanedComments)}
""";

        var generated = await GenerateTextAsync(
            "Summarize the discussion in 3 to 5 short bullet points. Keep the tone neutral, casual, and readable. Reflect disagreement where it exists. Do not invent facts, do not add promotion, and do not use academic phrasing.",
            prompt,
            maxOutputTokens: 256,
            ct);

        return string.IsNullOrWhiteSpace(generated)
            ? BuildFallbackSummary(cleanedTitle, cleanedComments.Count)
            : generated;
    }

    public async Task<string> SummarizeCountryComparisonAsync(
        string questionTitle,
        CountryComparisonSummaryInput input,
        CancellationToken ct)
    {
        var fallback = BuildCountryComparisonFallback(questionTitle, input);
        if (input.Options.Count == 0)
            return fallback;

        var lines = input.Options
            .Select(option =>
                $"- {SanitizeText(option.OptionLabel, 180)} | {input.LeftCountryCode}: {Math.Round(option.LeftPercentage, 1)}% ({option.LeftCount}) | {input.RightCountryCode}: {Math.Round(option.RightPercentage, 1)}% ({option.RightCount}) | GLOBAL: {Math.Round(option.GlobalPercentage, 1)}% ({option.GlobalCount})")
            .ToList();

        var prompt = $"""
Question:
"{SanitizeText(questionTitle, 200)}"

Compare these country vote patterns:
- {input.LeftCountryCode}: {input.LeftTotal} votes
- {input.RightCountryCode}: {input.RightTotal} votes
- GLOBAL: {input.GlobalTotal} votes

Option split:
{string.Join("\n", lines)}
""";

        var generated = await GenerateTextAsync(
            "Write 2 or 3 short sentences about why these countries may be answering differently. Mention the biggest contrast, note where they align with the global baseline, and use tentative language such as 'could reflect' or 'might be related to'. If the sample is small, say that clearly. Do not claim certainty.",
            prompt,
            maxOutputTokens: 220,
            ct);

        return string.IsNullOrWhiteSpace(generated)
            ? fallback
            : generated;
    }

    private async Task<string?> GenerateTextAsync(
        string systemInstruction,
        string prompt,
        int maxOutputTokens,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            _logger.LogWarning("Gemini ApiKey not configured. Returning fallback text.");
            return null;
        }

        try
        {
            var body = new GeminiGenerateContentRequest(
                SystemInstruction: new GeminiContent(
                    Parts:
                    [
                        new GeminiPart(systemInstruction)
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
                    MaxOutputTokens: maxOutputTokens));

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
                return null;
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

                return null;
            }

            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;

            if (root.TryGetProperty("promptFeedback", out var promptFeedback) &&
                promptFeedback.TryGetProperty("blockReason", out var blockReason))
            {
                _logger.LogWarning("Gemini prompt blocked: {Reason}", blockReason);
                return null;
            }

            if (!root.TryGetProperty("candidates", out var candidates) ||
                candidates.ValueKind != JsonValueKind.Array ||
                candidates.GetArrayLength() == 0)
            {
                _logger.LogWarning("Gemini response has no candidates");
                return null;
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
                return null;
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
                return null;
            }

            return string.Join("\n", texts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gemini summarization exception");
            return null;
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

    private static string BuildCountryComparisonFallback(
        string questionTitle,
        CountryComparisonSummaryInput input)
    {
        if (input.LeftTotal == 0 && input.RightTotal == 0)
            return $"There is no country-level vote data yet for \"{questionTitle}\".";

        var strongestGap = input.Options
            .OrderByDescending(option => Math.Abs(option.LeftPercentage - option.RightPercentage))
            .FirstOrDefault();

        if (strongestGap is null)
            return $"{input.LeftCountryCode} and {input.RightCountryCode} already have vote activity on this question, but there is not enough option-level detail yet to explain the pattern.";

        var leadingCountry = strongestGap.LeftPercentage >= strongestGap.RightPercentage
            ? input.LeftCountryCode
            : input.RightCountryCode;
        var gap = Math.Round(Math.Abs(strongestGap.LeftPercentage - strongestGap.RightPercentage), 1);
        var overlapScore = Math.Round(input.Options.Sum(option => Math.Min(option.LeftPercentage, option.RightPercentage)));
        var sampleSize = input.LeftTotal + input.RightTotal;
        var sampleNote = sampleSize < 20
            ? $" The sample is still very small ({sampleSize} votes across the pair), so this should be read as an early signal."
            : string.Empty;

        return $"{leadingCountry} leans more toward \"{strongestGap.OptionLabel}\" in this comparison, with a {gap}-point gap between the two countries. The two distributions still overlap by about {overlapScore} points overall, which means part of the preference pattern is shared even if one option stands out more strongly.{sampleNote}";
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
