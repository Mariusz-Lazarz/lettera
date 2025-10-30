/**
 * File validation utilities
 * Provides functions for validating file types using magic bytes
 */

/**
 * Check if a buffer contains a valid PDF file based on magic bytes
 * PDF files start with "%PDF-" (hex: 25 50 44 46 2D)
 * @param buffer - File buffer to check
 * @returns true if buffer starts with PDF magic bytes, false otherwise
 */
export function isPdfFile(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 5) {
    return false;
  }

  // PDF magic bytes: %PDF- (25 50 44 46 2D in hex)
  const pdfMagicBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

  // Check if buffer starts with PDF magic bytes
  return buffer.subarray(0, 5).equals(pdfMagicBytes);
}

/**
 * Sanitize a filename to prevent path traversal and other security issues
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and any directory traversal attempts
  let sanitized = filename.replace(/[/\\]/g, '_');

  // Remove any null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.trim().replace(/^\.+/, '');

  // If filename is empty after sanitization, use a default
  if (!sanitized) {
    sanitized = 'document.pdf';
  }

  // Ensure it has .pdf extension
  if (!sanitized.toLowerCase().endsWith('.pdf')) {
    sanitized = `${sanitized}.pdf`;
  }

  return sanitized;
}

/**
 * Generate a safe filename from an original filename
 * @param originalFilename - Original filename from upload
 * @returns Safe filename with timestamp
 */
export function generateSafeFilename(originalFilename?: string): string {
  if (!originalFilename) {
    return `cv-${Date.now()}.pdf`;
  }

  const sanitized = sanitizeFilename(originalFilename);

  // Extract base name and extension
  const lastDotIndex = sanitized.lastIndexOf('.');
  const baseName =
    lastDotIndex > 0 ? sanitized.slice(0, lastDotIndex) : sanitized;

  // Return sanitized filename (without adding timestamp unless needed for uniqueness)
  return `${baseName}.pdf`;
}
