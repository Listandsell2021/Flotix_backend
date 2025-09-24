const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;
let storage = null;
let bucket = null;

function initializeFirebase() {
  if (firebaseInitialized) return { storage, bucket };

  try {
    // Check if Firebase config exists
    const configPath = path.join(__dirname, 'firebase-config.json');

    if (fs.existsSync(configPath)) {
      console.log('🔥 Initializing Firebase with config file...');
      const serviceAccount = require(configPath);

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: serviceAccount.project_id + '.firebasestorage.app',
        });
      }

      storage = admin.storage();
      bucket = storage.bucket();
      firebaseInitialized = true;

      console.log('✅ Firebase initialized successfully');
    } else {
      console.warn('⚠️  Firebase config file not found. File upload features will be disabled.');
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
  }

  return { storage, bucket };
}

class FirebaseStorageService {
  /**
   * Upload a file buffer to Firebase Storage
   */
  static async uploadReceiptImage(buffer, fileName, mimeType, userId, companyId) {
    const { bucket } = initializeFirebase();

    if (!bucket) {
      throw new Error('Firebase not initialized. Check firebase-config.json');
    }

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
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

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
  static async deleteReceiptImage(fileUrl) {
    const { bucket } = initializeFirebase();

    if (!bucket) {
      console.warn('Firebase not initialized. Cannot delete file.');
      return false;
    }

    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/');
      const bucketName = urlParts[3];
      const filePath = urlParts.slice(4).join('/');

      if (bucketName !== bucket.name) {
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
   * Validate file before upload
   */
  static validateReceiptFile(buffer, mimeType, fileName) {
    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (buffer.length > maxSize) {
      return {
        valid: false,
        error: `File size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(maxSize / 1024 / 1024).toFixed(2)}MB`,
      };
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
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
  static isValidImageBuffer(buffer, mimeType) {
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
  static async getFileMetadata(fileUrl) {
    const { bucket } = initializeFirebase();

    if (!bucket) {
      return null;
    }

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
  static async listReceipts(companyId, userId = null, limit = 100) {
    const { bucket } = initializeFirebase();

    if (!bucket) {
      return [];
    }

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
            url: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
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

  /**
   * Check if Firebase is available
   */
  static isAvailable() {
    const { bucket } = initializeFirebase();
    return bucket !== null;
  }
}

module.exports = {
  FirebaseStorageService,
  initializeFirebase,
};