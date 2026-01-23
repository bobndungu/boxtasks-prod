<?php

namespace Drupal\boxtasks_api\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\File\FileSystemInterface;
use Drupal\file\Entity\File;
use Drupal\node\Entity\Node;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for file upload operations.
 */
class FileUploadController extends ControllerBase {

  /**
   * The file system service.
   *
   * @var \Drupal\Core\File\FileSystemInterface
   */
  protected $fileSystem;

  /**
   * Constructs a new FileUploadController.
   */
  public function __construct(FileSystemInterface $file_system) {
    $this->fileSystem = $file_system;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('file_system')
    );
  }

  /**
   * Upload a file and return file information.
   */
  public function uploadFile(Request $request): JsonResponse {
    try {
      // Get filename from header or form data
      $filename = NULL;
      $content_disposition = $request->headers->get('Content-Disposition');
      if ($content_disposition && preg_match('/filename="([^"]+)"/', $content_disposition, $matches)) {
        $filename = urldecode($matches[1]);
      }

      // Get the file content
      $content = $request->getContent();

      // Check for uploaded file in form data
      $uploaded_file = $request->files->get('file');
      if ($uploaded_file) {
        $filename = $uploaded_file->getClientOriginalName();
        $content = file_get_contents($uploaded_file->getPathname());
      }

      if (empty($filename)) {
        return new JsonResponse([
          'error' => 'No filename provided',
        ], 400);
      }

      if (empty($content)) {
        return new JsonResponse([
          'error' => 'No file content provided',
        ], 400);
      }

      // Validate file extension
      $allowed_extensions = 'txt pdf doc docx xls xlsx ppt pptx png jpg jpeg gif svg zip rar 7z';
      $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
      if (!in_array($extension, explode(' ', $allowed_extensions))) {
        return new JsonResponse([
          'error' => 'File type not allowed. Allowed types: ' . $allowed_extensions,
        ], 400);
      }

      // Validate file size (10MB max)
      $max_size = 10 * 1024 * 1024;
      if (strlen($content) > $max_size) {
        return new JsonResponse([
          'error' => 'File size exceeds maximum allowed (10 MB)',
        ], 400);
      }

      // Create base directory first if it doesn't exist
      $base_directory = 'public://card-attachments';
      if (!$this->fileSystem->prepareDirectory($base_directory, FileSystemInterface::CREATE_DIRECTORY | FileSystemInterface::MODIFY_PERMISSIONS)) {
        // Try to create the directory manually
        $real_base_path = $this->fileSystem->realpath('public://') . '/card-attachments';
        if (!is_dir($real_base_path)) {
          @mkdir($real_base_path, 0775, TRUE);
        }
      }

      // Create monthly subdirectory
      $directory = $base_directory . '/' . date('Y-m');
      if (!$this->fileSystem->prepareDirectory($directory, FileSystemInterface::CREATE_DIRECTORY | FileSystemInterface::MODIFY_PERMISSIONS)) {
        // Try to create the directory manually
        $real_path = $this->fileSystem->realpath('public://') . '/card-attachments/' . date('Y-m');
        if (!is_dir($real_path)) {
          @mkdir($real_path, 0775, TRUE);
        }
      }

      // Generate unique filename
      $safe_filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename);
      $destination = $directory . '/' . $safe_filename;
      $destination = $this->fileSystem->getDestinationFilename($destination, FileSystemInterface::EXISTS_RENAME);

      // Save the file
      $uri = $this->fileSystem->saveData($content, $destination, FileSystemInterface::EXISTS_RENAME);

      if (!$uri) {
        return new JsonResponse([
          'error' => 'Failed to save file',
        ], 500);
      }

      // Compress PDF files using Ghostscript if available
      if ($extension === 'pdf') {
        $this->compressPdf($uri);
      }

      // Get actual file size after potential compression
      $real_path = $this->fileSystem->realpath($uri);
      $actual_size = $real_path ? filesize($real_path) : strlen($content);

      // Create file entity
      $file = File::create([
        'uri' => $uri,
        'filename' => $safe_filename,
        'filemime' => mime_content_type($this->fileSystem->realpath($uri)) ?: 'application/octet-stream',
        'filesize' => $actual_size,
        'status' => 1,
        'uid' => $this->currentUser()->id(),
      ]);
      $file->save();

      // Return file information
      return new JsonResponse([
        'data' => [
          'id' => $file->uuid(),
          'type' => 'file--file',
          'attributes' => [
            'drupal_internal__fid' => $file->id(),
            'filename' => $file->getFilename(),
            'uri' => [
              'value' => $file->getFileUri(),
              'url' => $file->createFileUrl(FALSE),
            ],
            'filemime' => $file->getMimeType(),
            'filesize' => $file->getSize(),
          ],
        ],
      ]);
    }
    catch (\Exception $e) {
      \Drupal::logger('boxtasks_api')->error('File upload error: @message', ['@message' => $e->getMessage()]);
      return new JsonResponse([
        'error' => 'Failed to upload file: ' . $e->getMessage(),
      ], 500);
    }
  }

  /**
   * Compress a PDF file using Ghostscript.
   *
   * Uses the /ebook preset which provides good quality at reduced file size.
   * Only replaces the original if the compressed version is smaller.
   *
   * @param string $uri
   *   The file URI (e.g., public://card-attachments/2026-01/file.pdf).
   */
  protected function compressPdf(string $uri): void {
    $gs_path = '/usr/bin/gs';
    if (!file_exists($gs_path)) {
      return;
    }

    $real_path = $this->fileSystem->realpath($uri);
    if (!$real_path || !file_exists($real_path)) {
      return;
    }

    $original_size = filesize($real_path);
    $temp_output = $real_path . '.compressed.pdf';

    // Run Ghostscript with /ebook settings (150 dpi, good quality/size balance)
    $command = sprintf(
      '%s -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=%s %s 2>&1',
      escapeshellarg($gs_path),
      escapeshellarg($temp_output),
      escapeshellarg($real_path)
    );

    exec($command, $output, $return_code);

    if ($return_code === 0 && file_exists($temp_output)) {
      $compressed_size = filesize($temp_output);

      // Only use compressed version if it's actually smaller
      if ($compressed_size < $original_size) {
        rename($temp_output, $real_path);
        \Drupal::logger('boxtasks_api')->info('PDF compressed: @original -> @compressed bytes (@percent% reduction)', [
          '@original' => $original_size,
          '@compressed' => $compressed_size,
          '@percent' => round((1 - $compressed_size / $original_size) * 100),
        ]);
      }
      else {
        // Compressed is larger or same, keep original
        @unlink($temp_output);
      }
    }
    else {
      // Compression failed, clean up temp file
      if (file_exists($temp_output)) {
        @unlink($temp_output);
      }
      \Drupal::logger('boxtasks_api')->warning('PDF compression failed for: @path', ['@path' => $real_path]);
    }
  }

  /**
   * Create an attachment with file upload.
   */
  public function createAttachment(string $card_id, Request $request): JsonResponse {
    try {
      // First upload the file
      $upload_response = $this->uploadFile($request);
      $upload_data = json_decode($upload_response->getContent(), TRUE);

      if ($upload_response->getStatusCode() !== 200) {
        return $upload_response;
      }

      $file_uuid = $upload_data['data']['id'];
      $filename = $upload_data['data']['attributes']['filename'];

      // Load the card to verify it exists
      $cards = \Drupal::entityTypeManager()
        ->getStorage('node')
        ->loadByProperties(['type' => 'card', 'uuid' => $card_id]);

      if (empty($cards)) {
        return new JsonResponse([
          'error' => 'Card not found',
        ], 404);
      }

      $card = reset($cards);

      // Load the file entity
      $files = \Drupal::entityTypeManager()
        ->getStorage('file')
        ->loadByProperties(['uuid' => $file_uuid]);

      if (empty($files)) {
        return new JsonResponse([
          'error' => 'File entity not found',
        ], 500);
      }

      $file = reset($files);

      // Create the attachment node
      $attachment = Node::create([
        'type' => 'card_attachment',
        'title' => $filename,
        'field_attachment_card' => ['target_id' => $card->id()],
        'field_attachment_file' => ['target_id' => $file->id()],
        'uid' => $this->currentUser()->id(),
      ]);
      $attachment->save();

      // Return attachment information
      return new JsonResponse([
        'data' => [
          'id' => $attachment->uuid(),
          'type' => 'node--card_attachment',
          'attributes' => [
            'title' => $attachment->getTitle(),
            'created' => $attachment->getCreatedTime(),
          ],
          'relationships' => [
            'field_attachment_file' => [
              'data' => [
                'type' => 'file--file',
                'id' => $file_uuid,
              ],
            ],
            'field_attachment_card' => [
              'data' => [
                'type' => 'node--card',
                'id' => $card_id,
              ],
            ],
          ],
          'file' => [
            'id' => $file_uuid,
            'filename' => $file->getFilename(),
            'url' => $file->createFileUrl(FALSE),
            'filemime' => $file->getMimeType(),
            'filesize' => $file->getSize(),
          ],
        ],
      ]);
    }
    catch (\Exception $e) {
      \Drupal::logger('boxtasks_api')->error('Attachment creation error: @message', ['@message' => $e->getMessage()]);
      return new JsonResponse([
        'error' => 'Failed to create attachment: ' . $e->getMessage(),
      ], 500);
    }
  }

}
