const EventEmitter = require("events");

jest.mock("../src/services/media.service", () => ({
  uploadToStorage: jest.fn()
}));

const { uploadToStorage } = require("../src/services/media.service");
const { uploadMedia } = require("../src/handlers/media.handler");

describe("Media handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("debe procesar stream gRPC y subir archivo", async () => {
    const call = new EventEmitter();
    const callback = jest.fn();

    const uploadResult = {
      url: "http://localhost:9000/media/file.png",
      filename: "file.png"
    };

    uploadToStorage.mockResolvedValueOnce(uploadResult);

    uploadMedia(call, callback);

    call.emit("data", {
      filename: "foto.png",
      content_type: "image/png",
      data: Buffer.from("parte1")
    });

    call.emit("data", {
      data: Buffer.from("parte2")
    });

    call.emit("end");

    await new Promise(process.nextTick);

    expect(uploadToStorage).toHaveBeenCalledWith(
      [Buffer.from("parte1"), Buffer.from("parte2")],
      "foto.png",
      "image/png"
    );

    expect(callback).toHaveBeenCalledWith(null, uploadResult);
  });

  test("debe usar nombre por defecto si no se recibe filename", async () => {
    const call = new EventEmitter();
    const callback = jest.fn();

    uploadToStorage.mockResolvedValueOnce({
      url: "http://localhost:9000/media/file.bin",
      filename: "file.bin"
    });

    uploadMedia(call, callback);

    call.emit("data", {
      data: Buffer.from("contenido")
    });

    call.emit("end");

    await new Promise(process.nextTick);

    expect(uploadToStorage).toHaveBeenCalledWith(
      [Buffer.from("contenido")],
      "file",
      ""
    );
  });

  test("debe llamar callback con error si uploadToStorage falla", async () => {
    const call = new EventEmitter();
    const callback = jest.fn();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const error = new Error("MinIO error");
    uploadToStorage.mockRejectedValueOnce(error);

    uploadMedia(call, callback);

    call.emit("data", {
      filename: "foto.png",
      content_type: "image/png",
      data: Buffer.from("contenido")
    });

    call.emit("end");

    await new Promise(process.nextTick);

    expect(callback).toHaveBeenCalledWith(error);

    consoleSpy.mockRestore();
  });
});