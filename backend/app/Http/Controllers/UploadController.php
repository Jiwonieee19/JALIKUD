<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\UploadDocumentRequest;
use App\Http\Requests\General\UploadImageRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

/**
 * Admin file uploads. Stores to the public disk and returns a URL for use in
 * menu item `image_url` / rider `photo_url` fields.
 */
class UploadController extends Controller
{
    /**
     * POST /api/admin/uploads/image
     */
    public function storeImage(UploadImageRequest $request): JsonResponse
    {
        $path = $request->file('image')->store('uploads/images', 'public');

        return response()->json([
            'data' => [
                'url' => Storage::disk('public')->url($path),
                'path' => $path,
            ],
        ], 201);
    }

    /**
     * POST /api/admin/uploads/document
     */
    public function storeDocument(UploadDocumentRequest $request): JsonResponse
    {
        $path = $request->file('document')->store('uploads/documents', 'public');

        return response()->json([
            'data' => [
                'url' => Storage::disk('public')->url($path),
                'path' => $path,
            ],
        ], 201);
    }
}
