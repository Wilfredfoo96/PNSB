using Microsoft.Extensions.Configuration;

namespace AutoCountApi.Middleware;

public class IpAllowlistMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private readonly ILogger<IpAllowlistMiddleware> _logger;
    private readonly HashSet<string> _allowedIPs;

    public IpAllowlistMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<IpAllowlistMiddleware> logger)
    {
        _next = next;
        _configuration = configuration;
        _logger = logger;
        
        var allowedIPs = _configuration.GetSection("ApiSettings:AllowedIPs").Get<string[]>() ?? Array.Empty<string>();
        _allowedIPs = new HashSet<string>(allowedIPs, StringComparer.OrdinalIgnoreCase);
        
        // Always allow localhost
        _allowedIPs.Add("127.0.0.1");
        _allowedIPs.Add("::1");
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Skip IP check for health check and swagger endpoints
        var path = context.Request.Path.Value?.ToLower() ?? "";
        if (path.StartsWith("/swagger") || 
            path.StartsWith("/api/v1/health") || 
            path.StartsWith("/api/v1/version"))
        {
            await _next(context);
            return;
        }

        var remoteIp = context.Connection.RemoteIpAddress?.ToString() ?? "";
        
        // Check if IP is in allowlist
        if (!_allowedIPs.Contains(remoteIp) && _allowedIPs.Count > 0)
        {
            _logger.LogWarning("Access denied for IP: {RemoteIp}", remoteIp);
            context.Response.StatusCode = 403;
            await context.Response.WriteAsync("Access denied: IP not in allowlist");
            return;
        }

        await _next(context);
    }
}

