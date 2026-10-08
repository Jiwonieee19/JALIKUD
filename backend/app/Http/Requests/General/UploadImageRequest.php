<?php

namespace App\Http\Requests\General;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates an image upload.
 *
 * Enforces a real image (not a spoofed file), an allowed mime type, a size
 * cap and optional sane dimensions. The optional `folder` routes the image to
 * its own subdirectory under uploads/images so different upload features do
 * not clump together. Tune the constants to your needs.
 */
class UploadImageRequest extends FormRequest
{
    /**
     * Allowed image subfolders. Add a new value here (and pass it as `folder`)
     * whenever a new upload feature is introduced.
     */
    public const FOLDERS = ['general', 'menu-items', 'categories', 'riders'];

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
            'folder' => ['sometimes', 'nullable', 'string', 'max:50', Rule::in(self::FOLDERS)],
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
            'folder.in' => 'The upload folder is not recognised.',
        ];
    }
}
