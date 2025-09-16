import admin from 'firebase-admin';
import { config } from '../../shared-config/src';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.FIREBASE_PROJECT_ID,
      privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: config.FIREBASE_CLIENT_EMAIL,
    }),
    storageBucket: config.FIREBASE_STORAGE_BUCKET,
  });
}

const storage = admin.storage();
const bucket = storage.bucket();

export class FirebaseStorageService {
  /**
   * Upload a file buffer to Firebase Storage
   */
  static async uploadReceiptImage(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    userId: string,
    companyId: string
  ): Promise<string> {
    try {
      // Create a path with user and company organization
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileExtension = mimeType.includes('png') ? 'png' : 'jpg';
      const filePath = `receipts/${companyId}/${userId}/${timestamp}-${fileName}.${fileExtension}`;
      
      const file = bucket.file(filePath);
      
      // Upload the file
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            userId,
            companyId,
            uploadedAt: new Date().toISOString(),
          },
        },
        resumable: false,
      });

      // Make the file publicly readable
      await file.makePublic();
      
      // Return the public URL
      const publicUrl = `https://storage.googleapis.com/${config.FIREBASE_STORAGE_BUCKET}/${filePath}`;
      
      console.log(`Receipt uploaded successfully: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error('Firebase upload error:', error);
      throw new Error('Failed to upload receipt image');
    }
  }

  /**
   * Delete a receipt image from Firebase Storage
   */
  static async deleteReceiptImage(fileUrl: string): Promise<boolean> {
    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/');
      const bucketName = urlParts[3];
      const filePath = urlParts.slice(4).join('/');
      
      if (bucketName !== config.FIREBASE_STORAGE_BUCKET) {
        console.warn('File does not belong to our bucket:', fileUrl);
        return false;
      }

      const file = bucket.file(filePath);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        console.warn('File does not exist:', filePath);
        return false;
      }

      // Delete the file
      await file.delete();
      console.log(`Receipt deleted successfully: ${filePath}`);
      return true;
    } catch (error) {
      console.error('Firebase delete error:', error);
      return false;
    }
  }

  /**
   * Generate a signed URL for temporary access (if needed for private files)
   */
  static async generateSignedUrl(
    filePath: string,
    expiresInMinutes: number = 60
  ): Promise<string> {
    try {
      const file = bucket.file(filePath);
      
      const options = {
        version: 'v4' as const,
        action: 'read' as const,
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      };

      const [signedUrl] = await file.getSignedUrl(options);
      return signedUrl;
    } catch (error) {
      console.error('Firebase signed URL error:', error);
      throw new Error('Failed to generate signed URL');
    }
  }

  /**
   * Validate file before upload
   */
  static validateReceiptFile(
    buffer: Buffer,
    mimeType: string,
    fileName: string
  ): { valid: boolean; error?: string } {
    // Check file size (5MB limit)
    const maxSize = config.MAX_FILE_SIZE;
    if (buffer.length > maxSize) {
      return {
        valid: false,
        error: `File size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(maxSize / 1024 / 1024).toFixed(2)}MB`,
      };
    }

    // Check file type
    const allowedTypes = config.ALLOWED_FILE_TYPES;
    if (!allowedTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `File type ${mimeType} not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      };
    }

    // Check filename
    if (!fileName || fileName.length > 255) {
      return {
        valid: false,
        error: 'Invalid filename',
      };
    }

    // Basic image validation - check for valid image headers
    const isValidImage = this.isValidImageBuffer(buffer, mimeType);
    if (!isValidImage) {
      return {
        valid: false,
        error: 'Invalid image file',
      };
    }

    return { valid: true };
  }

  /**
   * Basic image validation by checking file headers
   */
  private static isValidImageBuffer(buffer: Buffer, mimeType: string): boolean {
    if (buffer.length < 8) return false;

    // Check JPEG header
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }

    // Check PNG header
    if (mimeType.includes('png')) {
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0D &&
        buffer[5] === 0x0A &&
        buffer[6] === 0x1A &&
        buffer[7] === 0x0A
      );
    }

    return false;
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(fileUrl: string): Promise<any> {
    try {
      const urlParts = fileUrl.split('/');
      const filePath = urlParts.slice(4).join('/');
      
      const file = bucket.file(filePath);
      const [metadata] = await file.getMetadata();
      
      return {
        size: parseInt(metadata.size),
        contentType: metadata.contentType,
        created: metadata.timeCreated,
        updated: metadata.updated,
        customMetadata: metadata.metadata,
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }

  /**
   * List receipts for a user/company (for admin purposes)
   */
  static async listReceipts(
    companyId: string,
    userId?: string,
    limit: number = 100
  ): Promise<Array<{ name: string; url: string; metadata: any }>> {
    try {
      const prefix = userId 
        ? `receipts/${companyId}/${userId}/`
        : `receipts/${companyId}/`;

      const [files] = await bucket.getFiles({
        prefix,
        maxResults: limit,
      });

      return Promise.all(
        files.map(async (file) => {
          const [metadata] = await file.getMetadata();
          return {
            name: file.name,
            url: `https://storage.googleapis.com/${config.FIREBASE_STORAGE_BUCKET}/${file.name}`,
            metadata: {
              size: parseInt(metadata.size),
              contentType: metadata.contentType,
              created: metadata.timeCreated,
              customMetadata: metadata.metadata,
            },
          };
        })
      );
    } catch (error) {
      console.error('Error listing receipts:', error);
      return [];
    }
  }
}

export default FirebaseStorageService;