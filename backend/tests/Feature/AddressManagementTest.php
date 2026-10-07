<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the customer's own delivery addresses.
 *
 * These routes are what make a delivery order possible: POST /api/orders
 * requires an `address_id` owned by the caller whenever order_type is
 * `delivery`. Before they existed, a customer who registered through the
 * public API had no way to create an address and could therefore only ever
 * check out for pickup.
 */
class AddressManagementTest extends TestCase
{
    use RefreshDatabase;

    private function actor(): User
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        return $user;
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'line1' => '123 Katipunan Ave',
            'city' => 'Quezon City',
            'country' => 'Philippines',
        ], $overrides);
    }

    public function test_addresses_require_authentication(): void
    {
        $this->getJson('/api/addresses')->assertStatus(401);
        $this->postJson('/api/addresses', $this->payload())->assertStatus(401);
    }

    public function test_a_customer_can_create_and_list_an_address(): void
    {
        $user = $this->actor();

        $response = $this->postJson('/api/addresses', $this->payload([
            'label' => 'Home',
            'state' => 'Metro Manila',
            'postal_code' => '1103',
            'latitude' => 14.6254,
            'longitude' => 121.043,
        ]))->assertStatus(201);

        $this->assertSame($user->id, $response->json('data.user_id'));
        $this->assertSame('123 Katipunan Ave', $response->json('data.line1'));

        $this->getJson('/api/addresses')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_the_first_address_becomes_the_default_implicitly(): void
    {
        $this->actor();

        // No is_default sent: a brand-new account still needs a usable default,
        // otherwise a checkout UI has nothing to pre-select.
        $response = $this->postJson('/api/addresses', $this->payload())->assertStatus(201);

        $this->assertTrue($response->json('data.is_default'));
    }

    public function test_promoting_an_address_demotes_the_previous_default(): void
    {
        $this->actor();

        $first = $this->postJson('/api/addresses', $this->payload(['label' => 'Home']))->json('data.id');
        $this->postJson('/api/addresses', $this->payload(['label' => 'Office']))->assertStatus(201);

        // Two defaults would make "which address is default?" ambiguous.
        $this->assertSame(1, Address::where('is_default', true)->count());

        $this->putJson("/api/addresses/{$first}", ['label' => 'Home', 'is_default' => true])->assertOk();

        $this->assertSame(1, Address::where('is_default', true)->count());
        $this->assertTrue(Address::find($first)->is_default);
    }

    public function test_an_ordinary_edit_does_not_steal_the_default_flag(): void
    {
        $this->actor();

        $first = $this->postJson('/api/addresses', $this->payload(['label' => 'Home']))->json('data.id');
        $second = $this->postJson('/api/addresses', $this->payload(['label' => 'Office']))->json('data.id');

        // Editing the non-default address without mentioning is_default must
        // not silently promote it.
        $this->putJson("/api/addresses/{$second}", ['line1' => '456 Taft Ave'])->assertOk();

        $this->assertTrue(Address::find($first)->is_default);
        $this->assertFalse(Address::find($second)->is_default);
        $this->assertSame('456 Taft Ave', Address::find($second)->line1);
    }

    public function test_deleting_the_default_address_promotes_a_survivor(): void
    {
        $this->actor();

        $first = $this->postJson('/api/addresses', $this->payload(['label' => 'Home']))->json('data.id');
        $second = $this->postJson('/api/addresses', $this->payload(['label' => 'Office']))->json('data.id');

        $this->deleteJson("/api/addresses/{$first}")->assertOk();

        // The account must never be left with no default for checkout.
        $this->assertTrue(Address::find($second)->is_default);
    }

    public function test_a_customer_cannot_read_or_modify_another_customers_addresses(): void
    {
        $this->actor();

        $victim = User::factory()->create();
        $address = Address::create([
            'user_id' => $victim->id,
            'line1' => '999 Somewhere St',
            'city' => 'Manila',
        ]);

        // The list is scoped to the caller, so another user's row never appears.
        $this->getJson('/api/addresses')->assertOk()->assertJsonCount(0, 'data');

        $this->putJson("/api/addresses/{$address->id}", $this->payload())->assertStatus(422);
        $this->deleteJson("/api/addresses/{$address->id}")->assertStatus(422);

        $this->assertSame('999 Somewhere St', $address->fresh()->line1);
    }

    public function test_user_id_cannot_be_forced_from_client_input(): void
    {
        $user = $this->actor();
        $other = User::factory()->create();

        $response = $this->postJson('/api/addresses', $this->payload([
            'user_id' => $other->id,
        ]))->assertStatus(201);

        // Ownership always comes from the authenticated user.
        $this->assertSame($user->id, $response->json('data.user_id'));
    }

    public function test_required_and_bounded_fields_are_validated(): void
    {
        $this->actor();

        $this->postJson('/api/addresses', ['city' => 'Quezon City'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['line1']);

        $this->postJson('/api/addresses', $this->payload(['latitude' => 999]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['latitude']);

        $this->postJson('/api/addresses', $this->payload(['longitude' => 999]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['longitude']);
    }
}
