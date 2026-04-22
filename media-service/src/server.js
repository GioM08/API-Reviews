const dotenv = require('dotenv');
dotenv.config();

const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { uploadMedia } = require('./handlers/media.handler');
const { ensureBucket, uploadToStorage } = require('./services/media.service');

const PROTO_PATH = path.join(__dirname, 'proto', 'media.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const grpcObject = grpc.loadPackageDefinition(packageDef);
const mediaProto = grpcObject.media;

const startServer = async () => {
  try {
    await ensureBucket();
    console.log('✔ Media-Service: MinIO conectado');

    const server = new grpc.Server();
    server.addService(mediaProto.MediaService.service, { UploadMedia: uploadMedia });

    const GRPC_PORT = process.env.GRPC_PORT || 50051;
    server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) {
        console.error('Error al iniciar Media-Service gRPC:', err);
        process.exit(1);
      }
      console.log(`Media-Service gRPC corriendo en puerto ${port}`);
    });

    const upload = multer({ storage: multer.memoryStorage() });
    const app = express();
    app.use(cors());

    app.post('/upload', upload.single('file'), async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'No file provided' });
        const { originalname, buffer, mimetype } = req.file;
        const result = await uploadToStorage([buffer], originalname, mimetype);
        res.json(result);
      } catch (err) {
        console.error('[!] Error en HTTP upload:', err.message);
        res.status(500).json({ error: 'Upload failed' });
      }
    });

    const HTTP_PORT = process.env.PORT_MEDIA_HTTP || 3005;
    app.listen(HTTP_PORT, () => {
      console.log(`Media-Service HTTP corriendo en puerto ${HTTP_PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar Media-Service:', error);
    process.exit(1);
  }
};

startServer();
