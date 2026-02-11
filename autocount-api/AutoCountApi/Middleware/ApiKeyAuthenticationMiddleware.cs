using Microsoft.Extensions.Configuration;

namespace AutoCountApi.Middleware;

public class ApiKeyAuthenticationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ApiKeyAuthenticationMiddleware> _logger;
    private const string ApiKeyHeaderName = "X-API-Key";

    public ApiKeyAuthenticationMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<ApiKeyAuthenticationMiddleware> logger)
    {
        _next = next;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Skip authentication for health check and swagger endpoints
        var path = context.Request.Path.Value?.ToLower() ?? "";
        if (path.StartsWith("/swagger") || 
            path.StartsWith("/api/v1/health") || 
            path.StartsWith("/api/v1/version"))
        {
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue(ApiKeyHeaderName, out var extractedApiKey))
        {
            _logger.LogWarning("API request missing API key from {RemoteIpAddress}", context.Connection.RemoteIpAddress);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("API Key is missing");
            return;
        }

        var apiKey = _configuration["ApiSettings:ApiKey"];
        
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogError("API key not configured in settings");
            context.Response.StatusCode = 500;
            await context.Response.WriteAsync("API key not configured");
            return;
        }

        if (!apiKey.Equals(extractedApiKey))
        {
            _logger.LogWarning("Invalid API key attempt from {RemoteIpAddress}", context.Connection.RemoteIpAddress);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("Invalid API Key");
            return;
        }

        await _next(context);
    }
}

