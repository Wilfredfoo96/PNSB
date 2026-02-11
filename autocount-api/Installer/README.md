# Cloudflare Tunnel Service - Master Script

## Quick Start

**One script to rule them all:**
```powershell
.\tunnel-service.ps1 [action]
```

## Available Actions

### `status` or `health` (default)
Check service status and health:
```powershell
.\tunnel-service.ps1
.\tunnel-service.ps1 status
.\tunnel-service.ps1 health
```

### `install`
Install the service (first time setup):
```powershell
.\tunnel-service.ps1 install
```

### `start`
Start the service:
```powershell
.\tunnel-service.ps1 start
```

### `stop`
Stop the service:
```powershell
.\tunnel-service.ps1 stop
```

### `restart`
Restart the service:
```powershell
.\tunnel-service.ps1 restart
```

### `fix`
Fix crashing service or configuration issues:
```powershell
.\tunnel-service.ps1 fix
```

### `debug`
Run tunnel manually to see error messages:
```powershell
.\tunnel-service.ps1 debug
```

## Initial Setup (First Time)

1. **Download cloudflared:**
   ```powershell
   .\setup-cloudflare-tunnel.ps1
   ```

2. **Configure tunnel:**
   ```powershell
   .\configure-tunnel.ps1
   ```

3. **Install service:**
   ```powershell
   .\tunnel-service.ps1 install
   ```

4. **Check status:**
   ```powershell
   .\tunnel-service.ps1 status
   ```

## Common Issues

### Service is crashing
```powershell
.\tunnel-service.ps1 fix
```

### Service won't start
```powershell
.\tunnel-service.ps1 debug
```
This will show you the actual error messages.

### Check if everything is working
```powershell
.\tunnel-service.ps1 status
```

## Examples

```powershell
# Check current status
.\tunnel-service.ps1

# Install/Reinstall service
.\tunnel-service.ps1 install

# Service crashed? Fix it
.\tunnel-service.ps1 fix

# Need to see what's wrong?
.\tunnel-service.ps1 debug

# Restart after config changes
.\tunnel-service.ps1 restart
```

## Notes

- Most actions require Administrator privileges
- The `status` action works without admin rights
- After `install` or `fix`, wait 30-60 seconds for tunnel to connect
- Use `debug` to see real-time error messages if something isn't working

## Documentation

- `PREVENT_SERVICE_CRASHES.md` - Detailed guide on preventing issues
- `QUICK_REFERENCE.md` - Quick reference guide
- `FIX_ERROR_1033.md` - Troubleshooting Error 1033

