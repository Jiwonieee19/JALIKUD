<?php

namespace Tests\Unit\Rules;

use App\Rules\StrongPassword;
use PHPUnit\Framework\TestCase;

class StrongPasswordTest extends TestCase
{
    /** @return array<int, string> */
    private function fails(string $value, ?StrongPassword $rule = null): array
    {
        $messages = [];
        ($rule ?? new StrongPassword)->validate('password', $value, function (string $message) use (&$messages): void {
            $messages[] = $message;
        });

        return $messages;
    }

    public function test_accepts_strong_password(): void
    {
        $this->assertSame([], $this->fails('Str0ngPassw0rd'));
    }

    public function test_rejects_too_short(): void
    {
        $this->assertNotSame([], $this->fails('Ab1c'));
    }

    public function test_rejects_missing_lowercase(): void
    {
        $this->assertNotSame([], $this->fails('STR0NGPASS'));
    }

    public function test_rejects_missing_number(): void
    {
        $this->assertNotSame([], $this->fails('StrongPassword'));
    }

    public function test_requires_special_when_enabled(): void
    {
        $rule = new StrongPassword(requireSpecial: true);

        $this->assertNotSame([], $this->fails('Str0ngPassw0rd', $rule));
        $this->assertSame([], $this->fails('Str0ng!Passw0rd', $rule));
    }
}
