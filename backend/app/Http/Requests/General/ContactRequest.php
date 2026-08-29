<?php

namespace App\Http\Requests\General;

use App\Rules\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A "contact us" style form demonstrating combined validation of common
 * inputs: name, email, optional phone (custom rule), subject and message.
 */
class ContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', new PhoneNumber],
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'phone' => 'Please provide a valid phone number, e.g. +1 (555) 123-4567.',
        ];
    }
}
