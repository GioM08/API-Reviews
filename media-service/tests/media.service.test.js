const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  setBucketPolicy: jest.fn(),
  putObject: jest.fn()
};

jest.mock("minio", () => ({
  Client: jest.fn(() => mockMinioClient)
}));

jest.mock("uuid", () => ({
  v4: jest.fn(() => "fixed-uuid")
}));

process.env.MINIO_ENDPOINT = "localhost";
process.env.MINIO_PORT = "9000";
process.env.MINIO_ACCESS_KEY = "minioadmin";
process.env.MINIO_SECRET_KEY = "minioadmin";
process.env.MINIO_BUCKET = "media";
process.env.MINIO_PUBLIC_URL = "http://localhost:9000";

const { ensureBucket, uploadToStorage } = require("../src/services/media.service");

describe("Media service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ensureBucket", () => {
    test("debe crear el bucket si no existe", async () => {
      mockMinioClient.bucketExists.mockResolvedValueOnce(false);
      mockMinioClient.makeBucket.mockResolvedValueOnce();
      mockMinioClient.setBucketPolicy.mockResolvedValueOnce();

      await ensureBucket();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith("media");
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith("media", "us-east-1");
      expect(mockMinioClient.setBucketPolicy).toHaveBeenCalledTimes(1);
    });

    test("no debe crear el bucket si ya existe", async () => {
      mockMinioClient.bucketExists.mockResolvedValueOnce(true);
      mockMinioClient.setBucketPolicy.mockResolvedValueOnce();

      await ensureBucket();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith("media");
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
      expect(mockMinioClient.setBucketPolicy).toHaveBeenCalledTimes(1);
    });
  });

  describe("uploadToStorage", () => {
    test("debe subir archivo a MinIO y devolver URL pública", async () => {
      mockMinioClient.putObject.mockResolvedValueOnce();

      const result = await uploadToStorage(
        [Buffer.from("contenido")],
        "foto.png",
        "image/png"
      );

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        "media",
        "fixed-uuid.png",
        Buffer.from("contenido"),
        Buffer.from("contenido").length,
        {
          "Content-Type": "image/png"
        }
      );

      expect(result).toEqual({
        url: "http://localhost:9000/media/fixed-uuid.png",
        filename: "fixed-uuid.png"
      });
    });

    test("debe usar extensión bin si el archivo no tiene extensión", async () => {
      mockMinioClient.putObject.mockResolvedValueOnce();

      const result = await uploadToStorage(
        [Buffer.from("contenido")],
        "archivo",
        ""
      );

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        "media",
        "fixed-uuid.bin",
        Buffer.from("contenido"),
        Buffer.from("contenido").length,
        {
          "Content-Type": "application/octet-stream"
        }
      );

      expect(result.filename).toBe("fixed-uuid.bin");
    });
  });
});