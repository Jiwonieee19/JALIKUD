<?php

namespace Database\Seeders;

use App\Models\Address;
use App\Models\RiderProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds one demo account per role so every guarded API surface can be
 * exercised without hand-promoting accounts in the database.
 *
 * Re-runnable: accounts are matched on their unique email and updated in
 * place, so running this against a non-empty database is safe. Soft-deleted
 * matches are restored rather than violating the users_email_unique index.
 */
class UserSeeder extends Seeder
{
    /**
     * Shared password for every seeded account. It must satisfy
     * App\Rules\StrongPassword (>= 8 chars, one lowercase, one UPPERCASE
     * and one digit) so the accounts can authenticate through
     * POST /api/login. Override per environment with SEED_USER_PASSWORD.
     */
    public const DEFAULT_PASSWORD = 'Jalikud123';

    /**
     * The accounts to seed, one per role allowed by the users.role
     * CHECK constraint. Riders get a rider_profiles row and customers get a
     * default address, matching what those roles need to operate.
     *
     * @var array<int, array<string, mixed>>
     */
    private function accounts(): array
    {
        return [
            [
                'name' => 'JALIKUD Admin',
                'email' => 'admin@jalikud.test',
                'phone' => '+639171234001',
                'role' => User::ROLE_ADMIN,
            ],
            [
                'name' => 'JALIKUD Staff',
                'email' => 'staff@jalikud.test',
                'phone' => '+639171234002',
                'role' => User::ROLE_STAFF,
            ],
            [
                'name' => 'JALIKUD Rider',
                'email' => 'rider@jalikud.test',
                'phone' => '+639171234003',
                'role' => User::ROLE_RIDER,
                'rider_profile' => [
                    'vehicle_type' => 'motorcycle',
                    'plate_number' => 'ABC-1234',
                    'is_active' => true,
                ],
            ],
            [
                'name' => 'JALIKUD Customer',
                'email' => 'customer@jalikud.test',
                'phone' => '+639171234004',
                'role' => User::ROLE_CUSTOMER,
                'address' => [
                    'label' => 'Home',
                    'line1' => '123 Katipunan Ave',
                    'line2' => 'Brgy. Santo Rosario',
                    'city' => 'Quezon City',
                    'state' => 'Metro Manila',
                    'postal_code' => '1103',
                    'country' => 'Philippines',
                    'latitude' => 14.6254000,
                    'longitude' => 121.0430000,
                    'is_default' => true,
                ],
            ],
            [
                'name' => 'JALIKUD Customer 2',
                'email' => 'customer2@jalikud.test',
                'phone' => '+639171234005',
                'role' => User::ROLE_CUSTOMER,
            ],
        ];
    }

    public function run(): void
    {
        $password = (string) (env('SEED_USER_PASSWORD') ?: self::DEFAULT_PASSWORD);

        DB::transaction(function () use ($password): void {
            foreach ($this->accounts() as $account) {
                $user = $this->upsertUser($account, $password);

                if (isset($account['rider_profile'])) {
                    $this->upsertRiderProfile($user, $account['rider_profile']);
                }

                if (isset($account['address'])) {
                    $this->upsertDefaultAddress($user, $account['address']);
                }
            }
        });

        $this->command?->info('Seeded '.count($this->accounts()).' accounts (one per role).');
        $this->command?->line('  Password for all seeded accounts: '.$password);
    }

    /**
     * Create or refresh a single account. role is assigned explicitly rather
     * than trusted from mass assignment so a re-run always repairs the role.
     *
     * @param  array<string, mixed>  $account
     */
    private function upsertUser(array $account, string $password): User
    {
        $attributes = [
            'name' => $account['name'],
            'phone' => $account['phone'] ?? null,
            // 'hashed' cast on User hashes this at set time.
            'password' => $password,
            'email_verified_at' => now(),
        ];

        // withTrashed() so a soft-deleted row is updated instead of tripping
        // the unique index on email.
        $user = User::withTrashed()->updateOrCreate(
            ['email' => $account['email']],
            $attributes
        );

        $user->role = $account['role'];
        $user->save();

        if ($user->trashed()) {
            $user->restore();
        }

        return $user;
    }

    /**
     * @param  array<string, mixed>  $profile
     */
    private function upsertRiderProfile(User $user, array $profile): void
    {
        RiderProfile::updateOrCreate(
            ['user_id' => $user->id],
            $profile
        );
    }

    /**
     * @param  array<string, mixed>  $address
     */
    private function upsertDefaultAddress(User $user, array $address): void
    {
        Address::updateOrCreate(
            ['user_id' => $user->id, 'label' => $address['label']],
            $address
        );
    }
}
