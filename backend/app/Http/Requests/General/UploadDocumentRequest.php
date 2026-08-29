<?php

namespace App\Http\Requests\General;

use Illuminate\Foundation\Http\FormRequest;

class UploadDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'document' => [
                'required',
                'file',
                'mimes:pdf,doc,docx,xls,xlsx,csv,txt',
                'max:10240', // 10 MB
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'document.required' => 'Please choose a document to upload.',
            'document.mimes' => 'The document must be a PDF, Word, Excel, CSV or text file.',
            'document.max' => 'The document may not be larger than 10MB.',
        ];
    }
}
