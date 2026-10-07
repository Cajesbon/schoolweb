'use strict';
const { v2: cloudinary } = require('cloudinary');

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  cloudinary.config({ secure: true }); // also picks up CLOUDINARY_URL if set
}

// Large photos are resized and compressed once, at upload time.
function uploadBuffer(buffer, folder = 'general') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `school-site/${folder}`,
        resource_type: 'image',
        transformation: [{ width: 2400, height: 2400, crop: 'limit' }, { quality: 'auto' }],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

async function destroy(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[cloudinary] delete failed:', err.message);
  }
}

module.exports = { uploadBuffer, destroy };
