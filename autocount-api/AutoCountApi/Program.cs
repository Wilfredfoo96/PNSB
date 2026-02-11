using AutoCountApi.Middleware;
using AutoCountApi.Services;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .CreateLogger();

builder.Host.UseSerilog();

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "AutoCount Integration API",
        Version = "v1",
        Description = "Posting-safe REST API for AutoCount Accounting v2.2 integration"
    });
    
    // Add API key authentication to Swagger
    c.AddSecurityDefinition("ApiKey", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "API Key authentication",
        Name = "X-API-Key",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey
    });
    
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "ApiKey"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigins", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("ApiSettings:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Register services
builder.Services.AddScoped<IAutoCountDbService, AutoCountDbService>();
builder.Services.AddScoped<IIdempotencyService, IdempotencyService>();
builder.Services.AddScoped<IDocumentLockService, DocumentLockService>();
builder.Services.AddScoped<IDebtorService, DebtorService>();
builder.Services.AddScoped<IItemService, ItemService>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();
builder.Services.AddScoped<IDeliveryOrderService, DeliveryOrderService>();
builder.Services.AddScoped<ISettingsService, SettingsService>();

// Add authentication middleware
builder.Services.AddScoped<ApiKeyAuthenticationMiddleware>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging();

app.UseHttpsRedirection();

app.UseCors("AllowSpecificOrigins");

// Custom middleware
app.UseMiddleware<ApiKeyAuthenticationMiddleware>();
app.UseMiddleware<IpAllowlistMiddleware>();
app.UseMiddleware<AuditLoggingMiddleware>();

app.UseAuthorization();

app.MapControllers();

// Health check endpoint
app.MapGet("/api/v1/health", () => new
{
    status = "healthy",
    timestamp = DateTime.UtcNow,
    version = "1.0.0"
});

app.MapGet("/api/v1/version", () => new
{
    apiVersion = "1.0.0",
    autocountVersion = "2.2", // TODO: Get from AutoCount
    timestamp = DateTime.UtcNow
});

Log.Information("AutoCount API starting on {Urls}", string.Join(", ", app.Urls));

app.Run();

