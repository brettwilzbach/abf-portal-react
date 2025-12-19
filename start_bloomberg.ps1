# PowerShell script to start Bloomberg MCP Server
# Requires: Bloomberg Terminal running, blpapi Python package installed

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bloomberg MCP Server for ABF Portal  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prerequisites:" -ForegroundColor Yellow
Write-Host "  1. Bloomberg Terminal must be running" -ForegroundColor Yellow
Write-Host "  2. BBComm process must be accessible" -ForegroundColor Yellow
Write-Host ""

# Check if Bloomberg Terminal is running (BBComm process)
$bbcomm = Get-Process -Name "bbcomm" -ErrorAction SilentlyContinue
if (-not $bbcomm) {
    Write-Host "[WARNING] BBComm process not found." -ForegroundColor Red
    Write-Host "          Please start Bloomberg Terminal first." -ForegroundColor Red
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}
else {
    Write-Host "[OK] Bloomberg Terminal detected (BBComm running)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Bloomberg MCP Server on http://localhost:8000..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host ""

# Start the server
python -m blpapi_mcp --sse --host 127.0.0.1 --port 8000
