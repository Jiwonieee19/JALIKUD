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

# Ensure SQLite database file exists and is writable, then migrate
touch database/database.sqlite
chown www-data:www-data database/database.sqlite
php artisan migrate --force

exec php artisan serve --host=0.0.0.0 --port=8000
