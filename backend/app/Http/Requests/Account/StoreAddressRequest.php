<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation for creating and updating a delivery address.
 *
 * Shared by store and update so the two cannot drift apart. `user_id` is
 * deliberately absent: ownership is always taken from the authenticated user,
 * never from client input, so a caller cannot attach an address to somebody
 * else's account.
 */
class StoreAddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        // Creating an address demands the core fields; updating is PATCH-like and
        // only validates what was actually submitted, so toggling is_default or
        // editing one line does not require resending the whole address.
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'label' => ['sometimes', 'nullable', 'string', 'max:50'],
            'line1' => [$required, 'string', 'max:255'],
            'line2' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city' => [$required, 'string', 'max:100'],
            'state' => ['sometimes', 'nullable', 'string', 'max:100'],
            'postal_code' => ['sometimes', 'nullable', 'string', 'max:20'],
            'country' => ['sometimes', 'nullable', 'string', 'max:100'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'is_default' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'line1.required' => 'Please provide the address line.',
            'city.required' => 'Please provide a city.',
            'latitude.between' => 'The latitude must be between -90 and 90.',
            'longitude.between' => 'The longitude must be between -180 and 180.',
        ];
    }
}
