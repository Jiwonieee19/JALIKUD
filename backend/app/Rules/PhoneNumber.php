<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Validates an international phone number.
 *
 * Accepts digits, a leading "+" for the country code, plus the separators
 * space, dash, dot and parentheses (e.g. "+1 (555) 123-4567").
 * After stripping separators the value must contain between 7 and 15 digits.
 */
class PhoneNumber implements ValidationRule
{
    /**
     * @param  bool  $allowSeparators  Allow spaces, dashes, dots and parentheses.
     */
    public function __construct(protected bool $allowSeparators = true) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) && ! is_numeric($value)) {
            $fail('The :attribute must be a valid phone number.');

            return;
        }

        $value = trim((string) $value);

        $pattern = $this->allowSeparators
            ? '/^\+?[0-9][0-9\s().-]{5,19}$/'
            : '/^\+?[0-9]{7,15}$/';

        if (! preg_match($pattern, $value)) {
            $fail('The :attribute must be a valid phone number.');

            return;
        }

        $digits = preg_replace('/\D/', '', $value);

        if (strlen($digits) < 7 || strlen($digits) > 15) {
            $fail('The :attribute must contain between 7 and 15 digits.');
        }
    }
}
