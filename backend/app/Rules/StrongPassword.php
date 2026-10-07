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
 *
 * Every composition failure reports the SAME message on purpose. Naming the
 * rule that failed ("must contain at least one number") hands an attacker
 * probing the endpoint a running tally of what is still missing, so length is
 * the only thing reported on its own.
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

        $strong =
            preg_match('/[a-z]/', $value)
            && preg_match('/[A-Z]/', $value)
            && preg_match('/[0-9]/', $value)
            && (! $this->requireSpecial || preg_match('/[^a-zA-Z0-9]/', $value));

        if (! $strong) {
            $fail($this->requireSpecial
                ? 'The :attribute must contain uppercase, lowercase, a number and a special character.'
                : 'The :attribute must contain uppercase, lowercase and a number.');
        }
    }
}
