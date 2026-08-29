<?php

namespace App\Http\Requests\General;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates an image upload.
 *
 * Enforces a real image (not a spoofed file), an allowed mime type, a size
 * cap and optional sane dimensions. Tune the constants to your needs.
 */
class UploadImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'image' => [
                'required',
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp,gif',
                'max:5120', // 5 MB
                'dimensions:min_width=128,min_height=128,max_width=6000,max_height=6000',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'image.required' => 'Please choose an image to upload.',
            'image.image' => 'The file must be an image.',
            'image.mimes' => 'The image must be a JPG, PNG, WebP or GIF file.',
            'image.max' => 'The image may not be larger than 5MB.',
            'image.dimensions' => 'The image must be between 128x128 and 6000x6000 pixels.',
        ];
    }
}
