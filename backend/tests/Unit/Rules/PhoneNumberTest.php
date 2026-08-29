<?php

namespace Tests\Unit\Rules;

use App\Rules\PhoneNumber;
use PHPUnit\Framework\TestCase;

class PhoneNumberTest extends TestCase
{
    /** @return array<int, string> */
    private function fails(string $value): array
    {
        $messages = [];
        $rule = new PhoneNumber;
        $rule->validate('phone', $value, function (string $message) use (&$messages): void {
            $messages[] = $message;
        });

        return $messages;
    }

    public function test_accepts_international_format(): void
    {
        $this->assertSame([], $this->fails('+1 (555) 123-4567'));
    }

    public function test_accepts_plain_digits(): void
    {
        $this->assertSame([], $this->fails('09171234567'));
    }

    public function test_accepts_separators(): void
    {
        $this->assertSame([], $this->fails('555-123-4567'));
    }

    public function test_rejects_letters(): void
    {
        $this->assertNotSame([], $this->fails('555-123-ABCD'));
    }

    public function test_rejects_too_few_digits(): void
    {
        $this->assertNotSame([], $this->fails('12345'));
    }

    public function test_rejects_empty_value(): void
    {
        $this->assertNotSame([], $this->fails(''));
    }
}
