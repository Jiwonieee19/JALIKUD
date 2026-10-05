# Pull the latest images from GHCR and restart the local stack.
# Run this after the `deploy` GitHub workflow completes.
#
# Usage:
#   .\deploy.ps1 -Token <github_pat_with_read_packages>
#   .\deploy.ps1                          (prompts securely for the token)
#
# Create a token at: GitHub > Settings > Developer settings >
# Personal access tokens (classic) > scope: read:packages

param(
    [string]$Token
)

if (-not $Token) {
    $secure = Read-Host "Enter your GitHub PAT (read:packages)" -AsSecureString
    $Token = [System.Net.NetworkCredential]::new("", $secure).Password
}
if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "No token provided. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host "Logging in to ghcr.io..." -ForegroundColor Cyan
$Token | docker login ghcr.io -u Jiwonieee19 --password-stdin
if ($LASTEXITCODE -ne 0) { Write-Host "Login failed." -ForegroundColor Red; exit 1 }

Write-Host "Pulling latest images..." -ForegroundColor Cyan
docker compose pull backend frontend
if ($LASTEXITCODE -ne 0) { Write-Host "Pull failed." -ForegroundColor Red; exit 1 }

Write-Host "Restarting containers..." -ForegroundColor Cyan
docker compose up -d --no-build backend frontend
if ($LASTEXITCODE -ne 0) { Write-Host "Restart failed." -ForegroundColor Red; exit 1 }

# The cloudflared container is a token-based agent with no config file to
# reload, but it must be restarted so it re-dials Cloudflare and re-resolves
# the backend service IP after the backend container is recreated.
if ($env:CLOUDFLARE_TUNNEL_TOKEN) {
    Write-Host "Restarting Cloudflare tunnel..." -ForegroundColor Cyan
    docker compose up -d cloudflared
    if ($LASTEXITCODE -ne 0) { Write-Host "Tunnel restart failed." -ForegroundColor Red; exit 1 }
} else {
    Write-Host "CLOUDFLARE_TUNNEL_TOKEN not set; skipping Cloudflare tunnel." -ForegroundColor Yellow
}

docker image prune -f | Out-Null
Write-Host "Deploy complete. Frontend: http://localhost:5173" -ForegroundColor Green
