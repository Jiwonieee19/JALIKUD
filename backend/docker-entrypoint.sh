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
for var in APP_KEY DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD; do
    value=$(printenv "$var")
    if [ -n "$value" ]; then
        sed -i "s#^$var=.*#$var=$value#" .env
    fi
done

# Ensure SQLite database file exists when running on SQLite, then migrate
if grep -q "^DB_CONNECTION=sqlite" .env || [ "$DB_CONNECTION" = "sqlite" ]; then
    touch database/database.sqlite
    chown www-data:www-data database/database.sqlite
fi

php artisan migrate --force

exec php artisan serve --host=0.0.0.0 --port=8000
