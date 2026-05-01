jest.mock("../src/utils/broker.util", () => ({
  publishFriendshipEvent: jest.fn(),
  publishPlanEvent: jest.fn()
}));

const Friendship = require("../src/models/friendship.model");
const friendshipService = require("../src/services/friendship.service");
const { publishFriendshipEvent } = require("../src/utils/broker.util");

describe("Friendship service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendRequest", () => {
    test("debe lanzar error si intenta enviarse solicitud a sí mismo", async () => {
      await expect(friendshipService.sendRequest("user-1", "user-1"))
        .rejects
        .toThrow("No puedes enviarte una solicitud a ti mismo");
    });

    test("debe crear solicitud de amistad", async () => {
      const friendship = await friendshipService.sendRequest("user-1", "user-2");

      expect(friendship.requesterId).toBe("user-1");
      expect(friendship.recipientId).toBe("user-2");
      expect(friendship.status).toBe("pending");

      expect(publishFriendshipEvent).toHaveBeenCalledWith(
        "friend_request_sent",
        {
          requesterId: "user-1",
          recipientId: "user-2"
        }
      );
    });

    test("debe lanzar error si ya son amigos", async () => {
      await Friendship.create({
        requesterId: "user-1",
        recipientId: "user-2",
        status: "accepted"
      });

      await expect(friendshipService.sendRequest("user-1", "user-2"))
        .rejects
        .toThrow("Ya sois amigos");
    });

    test("debe lanzar error si ya hay solicitud pendiente", async () => {
      await Friendship.create({
        requesterId: "user-1",
        recipientId: "user-2",
        status: "pending"
      });

      await expect(friendshipService.sendRequest("user-2", "user-1"))
        .rejects
        .toThrow("Ya hay una solicitud pendiente");
    });

    test("debe reactivar solicitud rechazada", async () => {
      await Friendship.create({
        requesterId: "user-1",
        recipientId: "user-2",
        status: "rejected"
      });

      const friendship = await friendshipService.sendRequest("user-2", "user-1");

      expect(friendship.requesterId).toBe("user-2");
      expect(friendship.recipientId).toBe("user-1");
      expect(friendship.status).toBe("pending");
    });
  });

  describe("acceptRequest", () => {
    test("debe aceptar solicitud pendiente", async () => {
      await Friendship.create({
        requesterId: "user-1",
        recipientId: "user-2",
        status: "pending"
      });

      const friendship = await friendshipService.acceptRequest("user-2", "user-1");

      expect(friendship.status).toBe("accepted");

      expect(publishFriendshipEvent).toHaveBeenCalledWith(
        "friend_request_accepted",
        {
          requesterId: "user-1",
          recipientId: "user-2"
        }
      );
    });

    test("debe lanzar error si no existe solicitud", async () => {
      await expect(friendshipService.acceptRequest("user-2", "user-1"))
        .rejects
        .toThrow("Solicitud no encontrada");
    });
  });

  describe("rejectRequest", () => {
    test("debe rechazar solicitud pendiente", async () => {
      await Friendship.create({
        requesterId: "user-1",
        recipientId: "user-2",
        status: "pending"
      });

      const friendship = await friendshipService.rejectRequest("user-2", "user-1");

      expect(friendship.status).toBe("rejected");
    });

    test("debe lanzar error si no existe solicitud", async () => {
      await expect(friendshipService.rejectRequest("user-2", "user-1"))
        .rejects
        .toThrow("Solicitud no encontrada");
    });
  });

  describe("removeFriend", () => {
    test("debe eliminar amistad aceptada", async () => {
      await Friendship.create({
        requesterId: "user-1",
        recipientId: "user-2",
        status: "accepted"
      });

      await friendshipService.removeFriend("user-1", "user-2");

      const friendship = await Friendship.findOne({
        requesterId: "user-1",
        recipientId: "user-2"
      });

      expect(friendship).toBeNull();
    });

    test("debe lanzar error si no existe amistad", async () => {
      await expect(friendshipService.removeFriend("user-1", "user-2"))
        .rejects
        .toThrow("Amistad no encontrada");
    });
  });

  describe("getMyFriends", () => {
    test("debe devolver ids de mis amigos", async () => {
      await Friendship.create({
        requesterId: "user-1",
        recipientId: "user-2",
        status: "accepted"
      });

      await Friendship.create({
        requesterId: "user-3",
        recipientId: "user-1",
        status: "accepted"
      });

      await Friendship.create({
        requesterId: "user-4",
        recipientId: "user-1",
        status: "pending"
      });

      const friends = await friendshipService.getMyFriends("user-1");

      expect(friends).toEqual(expect.arrayContaining(["user-2", "user-3"]));
      expect(friends).not.toContain("user-4");
    });
  });

  describe("getPendingRequests", () => {
    test("debe devolver solicitudes pendientes recibidas", async () => {
      await Friendship.create({
        requesterId: "user-2",
        recipientId: "user-1",
        status: "pending"
      });

      await Friendship.create({
        requesterId: "user-1",
        recipientId: "user-3",
        status: "pending"
      });

      const requests = await friendshipService.getPendingRequests("user-1");

      expect(requests).toHaveLength(1);
      expect(requests[0].requesterId).toBe("user-2");
    });
  });

  describe("getFriendshipStatus", () => {
    test("debe devolver none si no existe relación", async () => {
      const result = await friendshipService.getFriendshipStatus("user-1", "user-2");

      expect(result).toEqual({ status: "none" });
    });

    test("debe devolver estado de amistad existente", async () => {
      await Friendship.create({
        requesterId: "user-1",
        recipientId: "user-2",
        status: "accepted"
      });

      const result = await friendshipService.getFriendshipStatus("user-1", "user-2");

      expect(result).toEqual({
        status: "accepted",
        requesterId: "user-1"
      });
    });
  });
});