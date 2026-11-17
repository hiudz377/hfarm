const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { wrap, httpError } = require('../../utils');

const router = express.Router();
const uploadDirectory = path.resolve(__dirname, '../../../uploads');
const acceptedTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomBytes(16).toString('hex')}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!acceptedTypes[extension] || acceptedTypes[extension] !== file.mimetype) {
      return callback(httpError(400, 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP đúng định dạng.'));
    }
    callback(null, true);
  },
});

router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      error.status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      error.message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Ảnh tải lên không được vượt quá 5 MB.'
        : 'Không thể nhận tệp tải lên.';
    }
    next(error);
  });
}, wrap(async (req, res) => {
  if (!req.file) throw httpError(400, 'Vui lòng chọn ảnh để tải lên.');
  const publicUrl = (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/+$/, '');
  res.status(201).json({ url: `${publicUrl}/uploads/${req.file.filename}` });
}));

module.exports = router;
