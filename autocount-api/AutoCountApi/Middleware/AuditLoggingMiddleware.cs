using System.Text;
using Microsoft.Extensions.Configuration;

namespace AutoCountApi.Middleware;

public class AuditLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuditLoggingMiddleware> _logger;
    private readonly bool _enableAuditLogging;

    public AuditLoggingMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<AuditLoggingMiddleware> logger)
    {
        _next = next;
        _configuration = configuration;
        _logger = logger;
        _enableAuditLogging = _configuration.GetValue<bool>("ApiSettings:EnableAuditLogging", true);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Skip audit logging for health check and swagger endpoints
        var path = context.Request.Path.Value?.ToLower() ?? "";
        if (path.StartsWith("/swagger") || 
            path.StartsWith("/api/v1/health") || 
            path.StartsWith("/api/v1/version"))
        {
            await _next(context);
            return;
        }

        if (!_enableAuditLogging)
        {
            await _next(context);
            return;
        }

        var requestId = Guid.NewGuid().ToString();
        var remoteIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var method = context.Request.Method;
        var requestPath = context.Request.Path.Value ?? "";
        var queryString = context.Request.QueryString.Value ?? "";

        // Read request body if present
        string? requestBody = null;
        if (context.Request.ContentLength > 0 && 
            context.Request.ContentType?.Contains("application/json") == true)
        {
            context.Request.EnableBuffering();
            var buffer = new byte[context.Request.ContentLength ?? 0];
            await context.Request.Body.ReadAsync(buffer, 0, buffer.Length);
            requestBody = Encoding.UTF8.GetString(buffer);
            context.Request.Body.Position = 0;
        }

        var startTime = DateTime.UtcNow;

        // Capture response
        var originalBodyStream = context.Response.Body;
        using var responseBody = new MemoryStream();
        context.Response.Body = responseBody;

        try
        {
            await _next(context);
        }
        finally
        {
            var endTime = DateTime.UtcNow;
            var duration = (endTime - startTime).TotalMilliseconds;
            var statusCode = context.Response.StatusCode;

            // Read response body
            responseBody.Seek(0, SeekOrigin.Begin);
            var responseBodyText = await new StreamReader(responseBody).ReadToEndAsync();
            responseBody.Seek(0, SeekOrigin.Begin);
            await responseBody.CopyToAsync(originalBodyStream);

            // Log audit entry
            _logger.LogInformation(
                "Audit: RequestId={RequestId} IP={RemoteIp} Method={Method} Path={Path} Query={Query} " +
                "StatusCode={StatusCode} Duration={Duration}ms RequestBody={RequestBody} ResponseBody={ResponseBody}",
                requestId, remoteIp, method, requestPath, queryString, statusCode, duration, 
                requestBody ?? "N/A", responseBodyText.Length > 500 ? responseBodyText.Substring(0, 500) + "..." : responseBodyText);

            // Also write to audit log file if configured
            var auditLogPath = _configuration["ApiSettings:AuditLogPath"];
            if (!string.IsNullOrEmpty(auditLogPath))
            {
                try
                {
                    var logDir = Path.GetDirectoryName(auditLogPath);
                    if (!string.IsNullOrEmpty(logDir) && !Directory.Exists(logDir))
                    {
                        Directory.CreateDirectory(logDir);
                    }

                    var auditEntry = $"{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} | " +
                                   $"RequestId={requestId} | " +
                                   $"IP={remoteIp} | " +
                                   $"Method={method} | " +
                                   $"Path={requestPath} | " +
                                   $"StatusCode={statusCode} | " +
                                   $"Duration={duration}ms\n";

                    await File.AppendAllTextAsync(auditLogPath, auditEntry);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to write to audit log file");
                }
            }
        }
    }
}

