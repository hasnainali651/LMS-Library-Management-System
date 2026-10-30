const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');
const { isConfigured, uploadBuffer } = require('../config/cloudinary');

// Memory storage to process buffers with Sharp
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file format. Only JPEG, PNG, and WebP images are permitted.'), false);
  }
};

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5;

const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024,
  },
  fileFilter,
});

/**
 * Single file upload middleware
 * @param {string} field Form field name
 */
const uploadSingle = (field) => {
  return upload.single(field);
};

/**
 * Validates magic bytes for JPEG, PNG, and WebP
 * JPEG: FF D8 FF
 * PNG: 89 50 4E 47
 * WebP: RIFF at 0-3 and WEBP at 8-11
 */
const validateMagicBytesBuffer = (buffer) => {
  if (!buffer || buffer.length < 12) return false;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) return true;

  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  if (isPng) return true;

  const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  const isWebP = buffer.toString('ascii', 8, 12) === 'WEBP';
  if (isRiff && isWebP) return true;

  return false;
};

const validateFileMagicBytes = (req, res, next) => {
  if (req.file && req.file.buffer) {
    if (!validateMagicBytesBuffer(req.file.buffer)) {
      return next(
        new ApiError(
          400,
          'File content validation failed: Invalid magic bytes. Only genuine JPEG, PNG, and WebP images are permitted.'
        )
      );
    }
  }
  next();
};

/**
 * Image processing middleware with Sharp
 * Validates magic bytes, resizes covers (800x1200) or avatars (200x200), converts to WebP, and saves to /uploads/{books|avatars}/
 * @param {'books' | 'avatars'} type
 */
const processImage = (type = 'avatars') => {
  return async (req, res, next) => {
    if (!req.file) {
      return next();
    }

    // Validate magic bytes
    if (!validateMagicBytesBuffer(req.file.buffer)) {
      return next(
        new ApiError(
          400,
          'File content validation failed: Invalid magic bytes. Only genuine JPEG, PNG, and WebP images are permitted.'
        )
      );
    }

    try {
      const isBook = type === 'books';
      const width = isBook ? 800 : 200;
      const height = isBook ? 1200 : 200;

      // Optimize image in memory via Sharp
      const processedBuffer = await sharp(req.file.buffer)
        .resize(width, height, { fit: 'cover', position: 'center' })
        .toFormat('webp')
        .webp({ quality: 85 })
        .toBuffer();

      // Cloudinary upload if configured
      if (isConfigured) {
        try {
          const result = await uploadBuffer(processedBuffer, {
            folder: `lms/${type}`,
            format: 'webp',
          });
          req.file.processed = {
            filename: result.public_id,
            url: result.secure_url,
            cloudinary: true,
          };
          return next();
        } catch (cloudErr) {
          console.warn('Cloudinary upload fallback to local storage:', cloudErr.message);
        }
      }

      // Local storage fallback
      const uploadDir = path.resolve(__dirname, '../../uploads', type);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `${type}-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      const outputPath = path.join(uploadDir, filename);

      await fs.promises.writeFile(outputPath, processedBuffer);

      req.file.processed = {
        filename,
        path: outputPath,
        url: `/uploads/${type}/${filename}`,
      };

      next();
    } catch (err) {
      next(new ApiError(500, `Image processing error: ${err.message}`));
    }
  };
};

module.exports = {
  uploadSingle,
  processImage,
  validateFileMagicBytes,
  validateMagicBytesBuffer,
};
