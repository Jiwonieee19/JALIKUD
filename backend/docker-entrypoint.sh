#!/bin/sh
set -e

cd /var/www/html

# Ensure .env exists
if [ ! -f .env ]; then
    cp .env.example .env
fi

# Generate APP_KEY if missing
if ! grep -q "^APP_KEY=base64" .env; then
    php artisan key:generate --force
fi

# Persist runtime settings into .env because `artisan serve` workers
# do not reliably inherit container environment variables
for var in APP_KEY APP_ENV APP_DEBUG APP_URL LOG_LEVEL TRUSTED_PROXIES DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD; do
    value=$(printenv "$var")
    if [ -n "$value" ]; then
        sed -i "s#^$var=.*#$var=$value#" .env
    fi
done

# Never let debug mode leak into production, even if .env was built wrong
if grep -q "^APP_ENV=production" .env; then
    sed -i "s#^APP_DEBUG=.*#APP_DEBUG=false#" .env
fi

# Ensure SQLite database file exists when running on SQLite, then migrate
if grep -q "^DB_CONNECTION=sqlite" .env || [ "$DB_CONNECTION" = "sqlite" ]; then
    touch database/database.sqlite
    chown www-data:www-data database/database.sqlite
fi

php artisan migrate --force

# In production, cache config/routes for performance. Cache files are written
# into bootstrap/cache; the app is rebuilt per image so stale caches are not
# a concern across deployments.
if grep -q "^APP_ENV=production" .env; then
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache || true
else
    php artisan config:clear >/dev/null 2>&1 || true
    php artisan route:clear >/dev/null 2>&1 || true
fi

exec php artisan serve --host=0.0.0.0 --port=8000
