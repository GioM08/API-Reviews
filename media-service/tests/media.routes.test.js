const request = require("supertest");

jest.mock("../src/services/media.service", () => ({
  uploadToStorage: jest.fn()
}));

const { uploadToStorage } = require("../src/services/media.service");
const createApp = require("../src/app");

const app = createApp();

describe("Media HTTP routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /upload", () => {
    test("debe devolver 400 si no se envía archivo", async () => {
      const response = await request(app)
        .post("/upload");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "No file provided");
    });

    test("debe subir archivo y devolver resultado", async () => {
      const uploadResult = {
        url: "http://localhost:9000/media/fixed.png",
        filename: "fixed.png"
      };

      uploadToStorage.mockResolvedValueOnce(uploadResult);

      const response = await request(app)
        .post("/upload")
        .attach("file", Buffer.from("contenido"), {
          filename: "foto.png",
          contentType: "image/png"
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(uploadResult);
      expect(uploadToStorage).toHaveBeenCalledTimes(1);
    });

    test("debe devolver 500 si falla la subida", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      uploadToStorage.mockRejectedValueOnce(new Error("MinIO error"));

      const response = await request(app)
        .post("/upload")
        .attach("file", Buffer.from("contenido"), {
          filename: "foto.png",
          contentType: "image/png"
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Upload failed");

      consoleSpy.mockRestore();
    });
  });
});