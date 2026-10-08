<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UploadTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN]);
    }

    private function image(): UploadedFile
    {
        return UploadedFile::fake()->image('meal.png', 200, 200);
    }

    public function test_image_upload_goes_into_the_requested_folder(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->admin());

        $response = $this->post('/api/admin/uploads/image', [
            'image' => $this->image(),
            'folder' => 'menu-items',
        ])->assertStatus(201);

        $path = $response->json('data.path');
        $this->assertStringStartsWith('uploads/images/menu-items/', $path);
        Storage::disk('public')->assertExists($path);
    }

    public function test_image_upload_defaults_to_general_folder(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->admin());

        $response = $this->post('/api/admin/uploads/image', [
            'image' => $this->image(),
        ])->assertStatus(201);

        $this->assertStringStartsWith('uploads/images/general/', $response->json('data.path'));
    }

    public function test_image_upload_rejects_an_unknown_folder(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->admin());

        $this->post('/api/admin/uploads/image', [
            'image' => $this->image(),
            'folder' => '../../etc',
        ])->assertStatus(422)->assertJsonValidationErrors(['folder']);
    }

    public function test_image_upload_requires_admin(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_CUSTOMER]));

        $this->post('/api/admin/uploads/image', ['image' => $this->image()])->assertStatus(403);
    }
}
