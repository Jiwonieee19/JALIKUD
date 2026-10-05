<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | This file is published deliberately rather than left to fall back to the
    | framework's vendor defaults, so the cross-origin policy for the public
    | API is explicit and survives framework upgrades.
    |
    | The API authenticates with Sanctum BEARER tokens (an Authorization
    | header), not cookies, so 'allowed_origins' can stay permissive without
    | exposing anything: a browser will not attach credentials to a wildcard
    | origin because 'supports_credentials' is false, and CORS is enforced by
    | browsers only (Postman, curl, and native mobile clients ignore it).
    |
    | If cookie-based SPA auth (Sanctum's stateful domains) is ever adopted,
    | lock 'allowed_origins' down to your real hostnames AND flip
    | 'supports_credentials' to true, which makes '*' illegal.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Add your tunnel hostnames here (e.g. the ngrok domain and the
    // Cloudflare API hostname) if you ever want to restrict origins.
    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];