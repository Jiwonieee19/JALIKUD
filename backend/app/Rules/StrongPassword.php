<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Enforces a strong password.
 *
 * By default requires at least $minLength characters and at least one
 * uppercase letter, one lowercase letter and one number. Pass
 * $requireSpecial = true to also require a special character.
 */
class StrongPassword implements ValidationRule
{
    public function __construct(
        protected int $minLength = 8,
        protected bool $requireSpecial = false,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || strlen($value) < $this->minLength) {
            $fail("The :attribute must be at least {$this->minLength} characters.");

            return;
        }

        if (! preg_match('/[a-z]/', $value)) {
            $fail('The :attribute must contain at least one lowercase letter.');
        }

        if (! preg_match('/[A-Z]/', $value)) {
            $fail('The :attribute must contain at least one uppercase letter.');
        }

        if (! preg_match('/[0-9]/', $value)) {
            $fail('The :attribute must contain at least one number.');
        }

        if ($this->requireSpecial && ! preg_match('/[^a-zA-Z0-9]/', $value)) {
            $fail('The :attribute must contain at least one special character.');
        }
    }
}
