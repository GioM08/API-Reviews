jest.mock("../src/utils/firebase", () => ({
  sendPush: jest.fn()
}));

const Notification = require("../src/models/notification.model");
const DeviceToken = require("../src/models/device_token.model");
const { sendPush } = require("../src/utils/firebase");
const { handleMessage, pushToUsers } = require("../src/utils/consumer");

const createMessage = (payload) => ({
  content: Buffer.from(JSON.stringify(payload))
});

const createInvalidMessage = () => ({
  content: Buffer.from("{ invalid json")
});

const createChannel = () => ({
  ack: jest.fn(),
  nack: jest.fn()
});

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe("Notification consumer", () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("handleMessage", () => {
    test("no debe hacer nada si el mensaje viene vacío", async () => {
      const channel = createChannel();

      await handleMessage(null, channel);

      expect(channel.ack).not.toHaveBeenCalled();
      expect(channel.nack).not.toHaveBeenCalled();
    });

    test("debe crear notificación de solicitud de amistad y confirmar mensaje", async () => {
      const channel = createChannel();

      const msg = createMessage({
        eventType: "friend_request_sent",
        recipientId: "user-2",
        requesterId: "user-1"
      });

      await handleMessage(msg, channel);
      await flushPromises();

      const notifications = await Notification.find({ userId: "user-2" });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("friend_request_sent");
      expect(notifications[0].title).toBe("Nueva solicitud de amistad");
      expect(notifications[0].data.requesterId).toBe("user-1");

      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    test("debe crear notificación cuando cambia la fecha de una quedada", async () => {
      const channel = createChannel();

      const msg = createMessage({
        eventType: "plan_date_changed",
        recipientIds: ["user-7"],
        proposedDate: "2026-05-22T12:00:00.000Z",
        callerName: "Juan",
        planId: "plan-123"
      });

      await handleMessage(msg, channel);
      await flushPromises();

      const notification = await Notification.findOne({ userId: "user-7" });

      expect(notification).not.toBeNull();
      expect(notification.type).toBe("plan_date_changed");
      expect(notification.title).toBe("Fecha de quedada actualizada");
      expect(notification.data.planId).toBe("plan-123");

      expect(channel.ack).toHaveBeenCalledWith(msg);
    });

    test("debe ignorar eventos no soportados y confirmar mensaje", async () => {
      const channel = createChannel();

      const msg = createMessage({
        eventType: "unknown_event",
        userId: "user-123"
      });

      await handleMessage(msg, channel);

      const count = await Notification.countDocuments();

      expect(count).toBe(0);
      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    test("debe rechazar mensaje si el JSON es inválido", async () => {
      const channel = createChannel();
      const msg = createInvalidMessage();

      await handleMessage(msg, channel);

      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });
  });

  describe("pushToUsers", () => {
    test("debe enviar push a tokens del usuario y eliminar tokens inválidos", async () => {
      await DeviceToken.create({
        userId: "user-1",
        token: "good-token",
        platform: "web"
      });

      await DeviceToken.create({
        userId: "user-1",
        token: "bad-token",
        platform: "web"
      });

      sendPush.mockResolvedValueOnce({
        invalidTokens: ["bad-token"]
      });

      await pushToUsers([
        {
          userId: "user-1",
          title: "Título de prueba",
          body: "Mensaje de prueba",
          data: { restaurantId: "restaurant-1" }
        }
      ]);

      expect(sendPush).toHaveBeenCalledWith(
        expect.arrayContaining(["good-token", "bad-token"]),
        {
          title: "Título de prueba",
          body: "Mensaje de prueba",
          data: { restaurantId: "restaurant-1" }
        }
      );

      const goodToken = await DeviceToken.findOne({ token: "good-token" });
      const badToken = await DeviceToken.findOne({ token: "bad-token" });

      expect(goodToken).not.toBeNull();
      expect(badToken).toBeNull();
    });

    test("no debe llamar Firebase si el usuario no tiene tokens", async () => {
      await pushToUsers([
        {
          userId: "user-without-token",
          title: "Sin tokens",
          body: "No debe enviar push",
          data: {}
        }
      ]);

      expect(sendPush).not.toHaveBeenCalled();
    });
  });
});