<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\UploadDocumentRequest;
use App\Http\Requests\General\UploadImageRequest;
use Illuminate\Http\JsonResponse;

/**
 * Admin file uploads. Stores to the public disk and returns a relative URL for
 * use in menu item `image_url` / rider `photo_url` fields (so the stored value
 * works behind any proxy, tunnel or domain the client resolves it against).
 */
class UploadController extends Controller
{
    /**
     * POST /api/admin/uploads/image
     *
     * Body: multipart `image` + optional `folder` (one of UploadImageRequest::FOLDERS,
     * default `general`). The folder routes the image to its own subdirectory so
     * different upload features stay separated.
     */
    public function storeImage(UploadImageRequest $request): JsonResponse
    {
        $folder = $request->input('folder', 'general');
        $path = $request->file('image')->store('uploads/images/'.$folder, 'public');

        return response()->json([
            'data' => [
                'url' => '/storage/'.$path,
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
                'url' => '/storage/'.$path,
                'path' => $path,
            ],
        ], 201);
    }
}
