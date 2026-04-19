const { Client } = require('minio');
const { v4: uuidv4 } = require('uuid');

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

const BUCKET = process.env.MINIO_BUCKET;

const PUBLIC_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${BUCKET}/*`],
    },
  ],
});

const ensureBucket = async () => {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, 'us-east-1');
    console.log(`✔ Bucket '${BUCKET}' creado`);
  }
  await minioClient.setBucketPolicy(BUCKET, PUBLIC_POLICY);
  console.log(`✔ Bucket '${BUCKET}' configurado como público`);
};

const uploadToStorage = async (chunks, filename, contentType) => {
  const ext = filename.includes('.') ? filename.split('.').pop() : 'bin';
  const uniqueName = `${uuidv4()}.${ext}`;
  const buffer = Buffer.concat(chunks);

  await minioClient.putObject(BUCKET, uniqueName, buffer, buffer.length, {
    'Content-Type': contentType || 'application/octet-stream',
  });

  const baseUrl = process.env.MINIO_PUBLIC_URL || `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`;
  const url = `${baseUrl}/${BUCKET}/${uniqueName}`;
  return { url, filename: uniqueName };
};

module.exports = { ensureBucket, uploadToStorage };
