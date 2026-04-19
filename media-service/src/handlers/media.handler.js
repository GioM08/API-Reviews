const { uploadToStorage } = require('../services/media.service');

const uploadMedia = (call, callback) => {
  const chunks = [];
  let filename = '';
  let contentType = '';

  call.on('data', (chunk) => {
    if (chunk.filename) filename = chunk.filename;
    if (chunk.content_type) contentType = chunk.content_type;
    if (chunk.data && chunk.data.length > 0) chunks.push(chunk.data);
  });

  call.on('end', async () => {
    try {
      const result = await uploadToStorage(chunks, filename || 'file', contentType);
      callback(null, result);
    } catch (err) {
      console.error(' [!] Error subiendo archivo:', err.message);
      callback(err);
    }
  });

  call.on('error', (err) => {
    console.error(' [!] Error en stream gRPC:', err.message);
  });
};

module.exports = { uploadMedia };
