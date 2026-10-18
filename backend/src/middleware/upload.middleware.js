const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.'), false);
  }
};

const maxFileSize = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5) * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: maxFileSize },
  fileFilter,
});

const validateMagicBytes = (buffer) => {
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

const resizeImage = (width = 600, height = 800) => {
  return async (req, res, next) => {
    if (!req.file) return next();

    if (!validateMagicBytes(req.file.buffer)) {
      return next(
        new ApiError(
          400,
          'Invalid file content: Mega byte verification failed. Only genuine JPEG, PNG, and WebP images are allowed.'
        )
      );
    }

    try {
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      const outputPath = path.join(uploadDir, filename);

      await sharp(req.file.buffer)
        .resize(width, height, { fit: 'cover' })
        .toFormat('webp')
        .webp({ quality: 80 })
        .toFile(outputPath);

      req.file.filename = filename;
      req.file.path = outputPath;
      req.file.url = `/uploads/${filename}`;
      next();
    } catch (error) {
      next(new ApiError(500, `Image processing failed: ${error.message}`));
    }
  };
};

module.exports = {
  upload,
  resizeImage,
};
