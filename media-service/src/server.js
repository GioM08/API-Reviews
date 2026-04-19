const dotenv = require('dotenv');
dotenv.config();

const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { uploadMedia } = require('./handlers/media.handler');
const { ensureBucket } = require('./services/media.service');

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

    const PORT = process.env.GRPC_PORT || 50051;
    server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) {
        console.error('Error al iniciar Media-Service gRPC:', err);
        process.exit(1);
      }
      console.log(`Media-Service gRPC corriendo en puerto ${port}`);
    });
  } catch (error) {
    console.error('Error al iniciar Media-Service:', error);
    process.exit(1);
  }
};

startServer();
