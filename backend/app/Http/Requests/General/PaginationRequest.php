<?php

namespace App\Http\Requests\General;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Reusable pagination validation for any paginated list endpoint.
 */
class PaginationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function page(int $default = 1): int
    {
        return max(1, $this->integer('page', $default));
    }

    public function perPage(int $default = 15): int
    {
        $perPage = $this->integer('per_page', $default) ?: $default;

        return min(100, max(1, $perPage));
    }
}
