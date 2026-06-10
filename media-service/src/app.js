const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { uploadToStorage } = require("./services/media.service");

const createApp = () => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });
  const app = express();

  app.disable("x-powered-by");
  app.use(cors());

  app.post("/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const { originalname, buffer, mimetype } = req.file;
      const result = await uploadToStorage([buffer], originalname, mimetype);

      res.json(result);
    } catch (err) {
      console.error("[!] Error en HTTP upload:", err.message);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  return app;
};

module.exports = createApp;