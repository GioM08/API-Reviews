const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../src/utils/jwt.util", () => ({
  verifyToken: jest.fn(() => ({
    id: "user-123",
    role: "user"
  }))
}));

const app = require("../src/app");
const Notification = require("../src/models/notification.model");
const DeviceToken = require("../src/models/device_token.model");
const { verifyToken } = require("../src/utils/jwt.util");

const authHeader = "Bearer fake-token";

const createNotification = async (data = {}) => {
  return Notification.create({
    userId: data.userId || "user-123",
    type: data.type || "plan_proposed",
    title: data.title || "Notificación de prueba",
    body: data.body || "Contenido de prueba",
    data: data.data || {},
    read: data.read ?? false
  });
};

describe("Notification routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /health", () => {
    test("debe devolver status ok", async () => {
      const response = await request(app)
        .get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("auth middleware", () => {
    test("debe devolver 401 si no se manda token", async () => {
      const response = await request(app)
        .get("/api/notifications");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No autorizado");
    });

    test("debe devolver 401 si el token es inválido", async () => {
      verifyToken.mockImplementationOnce(() => {
        throw new Error("Token inválido");
      });

      const response = await request(app)
        .get("/api/notifications")
        .set("Authorization", authHeader);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Token inválido");
    });
  });

  describe("GET /api/notifications", () => {
    test("debe devolver las notificaciones del usuario autenticado", async () => {
      await createNotification({
        userId: "user-123",
        title: "Notificación 1"
      });

      await createNotification({
        userId: "user-123",
        title: "Notificación 2"
      });

      await createNotification({
        userId: "other-user",
        title: "No debe aparecer"
      });

      const response = await request(app)
        .get("/api/notifications")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.every((n) => n.userId === "user-123")).toBe(true);
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    test("debe devolver el conteo de notificaciones no leídas", async () => {
      await createNotification({ userId: "user-123", read: false });
      await createNotification({ userId: "user-123", read: false });
      await createNotification({ userId: "user-123", read: true });
      await createNotification({ userId: "other-user", read: false });

      const response = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ count: 2 });
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    test("debe marcar una notificación como leída", async () => {
      const notification = await createNotification({
        userId: "user-123",
        read: false
      });

      const response = await request(app)
        .patch(`/api/notifications/${notification._id}/read`)
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body.read).toBe(true);

      const updated = await Notification.findById(notification._id);
      expect(updated.read).toBe(true);
    });

    test("debe devolver 404 si la notificación no existe", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .patch(`/api/notifications/${fakeId}/read`)
        .set("Authorization", authHeader);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Notificación no encontrada");
    });

    test("debe devolver 400 si el id no es válido", async () => {
      const response = await request(app)
        .patch("/api/notifications/id-invalido/read")
        .set("Authorization", authHeader);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("PATCH /api/notifications/read-all", () => {
    test("debe marcar todas las notificaciones del usuario como leídas", async () => {
      await createNotification({ userId: "user-123", read: false });
      await createNotification({ userId: "user-123", read: false });
      await createNotification({ userId: "other-user", read: false });

      const response = await request(app)
        .patch("/api/notifications/read-all")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: "Todas las notificaciones marcadas como leídas"
      });

      const unreadCount = await Notification.countDocuments({
        userId: "user-123",
        read: false
      });

      const otherUserUnreadCount = await Notification.countDocuments({
        userId: "other-user",
        read: false
      });

      expect(unreadCount).toBe(0);
      expect(otherUserUnreadCount).toBe(1);
    });
  });

  describe("POST /api/notifications/token", () => {
    test("debe devolver 400 si no se manda token", async () => {
      const response = await request(app)
        .post("/api/notifications/token")
        .set("Authorization", authHeader)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Token requerido");
    });

    test("debe registrar token con plataforma por defecto web", async () => {
      const response = await request(app)
        .post("/api/notifications/token")
        .set("Authorization", authHeader)
        .send({
          token: "device-token-123"
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Token registrado" });

      const tokenDoc = await DeviceToken.findOne({ token: "device-token-123" });

      expect(tokenDoc).not.toBeNull();
      expect(tokenDoc.userId).toBe("user-123");
      expect(tokenDoc.platform).toBe("web");
    });

    test("debe registrar token con plataforma android", async () => {
      const response = await request(app)
        .post("/api/notifications/token")
        .set("Authorization", authHeader)
        .send({
          token: "android-token-123",
          platform: "android"
        });

      expect(response.status).toBe(200);

      const tokenDoc = await DeviceToken.findOne({ token: "android-token-123" });

      expect(tokenDoc.platform).toBe("android");
    });
  });

  describe("DELETE /api/notifications/token", () => {
    test("debe devolver 400 si no se manda token", async () => {
      const response = await request(app)
        .delete("/api/notifications/token")
        .set("Authorization", authHeader)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Token requerido");
    });

    test("debe eliminar token del usuario autenticado", async () => {
      await DeviceToken.create({
        userId: "user-123",
        token: "token-to-delete",
        platform: "web"
      });

      const response = await request(app)
        .delete("/api/notifications/token")
        .set("Authorization", authHeader)
        .send({
          token: "token-to-delete"
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Token eliminado" });

      const tokenDoc = await DeviceToken.findOne({ token: "token-to-delete" });
      expect(tokenDoc).toBeNull();
    });

    test("no debe eliminar token de otro usuario", async () => {
      await DeviceToken.create({
        userId: "other-user",
        token: "other-token",
        platform: "web"
      });

      const response = await request(app)
        .delete("/api/notifications/token")
        .set("Authorization", authHeader)
        .send({
          token: "other-token"
        });

      expect(response.status).toBe(200);

      const tokenDoc = await DeviceToken.findOne({ token: "other-token" });
      expect(tokenDoc).not.toBeNull();
    });
  });
});