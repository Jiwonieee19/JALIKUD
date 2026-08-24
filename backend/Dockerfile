# ---------- Backend: Laravel API ----------
FROM php:8.4-cli-alpine

# Install system deps and PHP extensions needed by Laravel + SQLite
RUN apk add --no-cache bash sqlite sqlite-dev pkgconfig libpq-dev \
    && docker-php-ext-install pdo_sqlite pdo_pgsql

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install PHP dependencies first (better layer caching)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

# Copy application code
COPY . .

# Finish autoloader, ensure storage permissions
RUN composer dump-autoload --optimize \
    && chown -R www-data:www-data storage bootstrap/cache database \
    && chmod -R 775 storage bootstrap/cache database

# Startup script: prepare env/db, migrate, then serve
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
