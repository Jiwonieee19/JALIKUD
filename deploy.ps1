# Pull the latest images from GHCR and restart the local stack.
# Run this after the `deploy` GitHub workflow completes.

docker login ghcr.io -u Jiwonieee19
if ($LASTEXITCODE -ne 0) { exit 1 }

docker compose pull backend frontend
if ($LASTEXITCODE -ne 0) { exit 1 }

docker compose up -d --no-build backend frontend
if ($LASTEXITCODE -ne 0) { exit 1 }

docker image prune -f
Write-Host "Deploy complete." -ForegroundColor Green
