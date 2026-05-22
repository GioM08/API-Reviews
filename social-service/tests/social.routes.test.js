const request = require("supertest");

jest.mock("../src/utils/jwt.util", () => ({
  verifyToken: jest.fn()
}));

jest.mock("../src/services/friendship.service", () => ({
  sendRequest: jest.fn(),
  acceptRequest: jest.fn(),
  rejectRequest: jest.fn(),
  removeFriend: jest.fn(),
  getMyFriends: jest.fn(),
  getPendingRequests: jest.fn(),
  getFriendshipStatus: jest.fn()
}));

jest.mock("../src/services/plan.service", () => {
  class ETagMismatchError extends Error {
    constructor() {
      super("El plan fue modificado por otra acción. Recarga e intenta de nuevo.");
      this.name = "ETagMismatchError";
    }
  }

  return {
    ETagMismatchError,
    getETag: jest.fn(),
    createPlan: jest.fn(),
    respondToPlan: jest.fn(),
    completePlan: jest.fn(),
    updatePlanDate: jest.fn(),
    inviteParticipants: jest.fn(),
    removeParticipant: jest.fn(),
    getMyPlans: jest.fn(),
    getPlanById: jest.fn()
  };
});

const app = require("../src/app");
const { verifyToken } = require("../src/utils/jwt.util");
const friendshipService = require("../src/services/friendship.service");
const planService = require("../src/services/plan.service");

const authHeader = "Bearer fake-token";

describe("Social routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.USER_SERVICE_URL = "http://user-service:3001";

    verifyToken.mockReturnValue({
      id: "user-123",
      role: "user"
    });

    planService.getETag.mockReturnValue("etag-test");

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        "friend-1": {
          name: "Amigo Uno",
          avatar: "avatar1.png"
        }
      })
    });
  });

  describe("GET /health", () => {
    test("debe devolver status ok", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("auth middleware", () => {
    test("debe devolver 401 si no se manda token", async () => {
      const response = await request(app).get("/api/friends");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No autorizado");
    });

    test("debe devolver 401 si el token es inválido", async () => {
      verifyToken.mockImplementationOnce(() => {
        throw new Error("Token inválido");
      });

      const response = await request(app)
        .get("/api/friends")
        .set("Authorization", authHeader);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Token inválido");
    });
  });

  describe("friendship routes", () => {
    test("debe enviar solicitud de amistad", async () => {
      const friendship = {
        requesterId: "user-123",
        recipientId: "friend-1",
        status: "pending"
      };

      friendshipService.sendRequest.mockResolvedValueOnce(friendship);

      const response = await request(app)
        .post("/api/friends/request/friend-1")
        .set("Authorization", authHeader);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(friendship);
      expect(friendshipService.sendRequest).toHaveBeenCalledWith("user-123", "friend-1");
    });

    test("debe aceptar solicitud de amistad", async () => {
      const friendship = {
        requesterId: "friend-1",
        recipientId: "user-123",
        status: "accepted"
      };

      friendshipService.acceptRequest.mockResolvedValueOnce(friendship);

      const response = await request(app)
        .post("/api/friends/accept/friend-1")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(friendship);
      expect(friendshipService.acceptRequest).toHaveBeenCalledWith("user-123", "friend-1");
    });

    test("debe rechazar solicitud de amistad", async () => {
      const friendship = {
        requesterId: "friend-1",
        recipientId: "user-123",
        status: "rejected"
      };

      friendshipService.rejectRequest.mockResolvedValueOnce(friendship);

      const response = await request(app)
        .post("/api/friends/reject/friend-1")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(friendship);
      expect(friendshipService.rejectRequest).toHaveBeenCalledWith("user-123", "friend-1");
    });

    test("debe eliminar amistad", async () => {
      friendshipService.removeFriend.mockResolvedValueOnce();

      const response = await request(app)
        .delete("/api/friends/friend-1")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Amistad eliminada" });
      expect(friendshipService.removeFriend).toHaveBeenCalledWith("user-123", "friend-1");
    });

    test("debe devolver amigos enriquecidos con datos de user-service", async () => {
      friendshipService.getMyFriends.mockResolvedValueOnce(["friend-1"]);

      const response = await request(app)
        .get("/api/friends")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          userId: "friend-1",
          name: "Amigo Uno",
          avatar: "avatar1.png"
        }
      ]);
    });

    test("debe devolver lista vacía si no hay amigos", async () => {
      friendshipService.getMyFriends.mockResolvedValueOnce([]);

      const response = await request(app)
        .get("/api/friends")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    test("debe devolver solicitudes pendientes", async () => {
      const requests = [
        {
          requesterId: "friend-1",
          recipientId: "user-123",
          status: "pending"
        }
      ];

      friendshipService.getPendingRequests.mockResolvedValueOnce(requests);

      const response = await request(app)
        .get("/api/friends/requests")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(requests);
    });

    test("debe devolver estado de amistad", async () => {
      friendshipService.getFriendshipStatus.mockResolvedValueOnce({
        status: "accepted",
        requesterId: "user-123"
      });

      const response = await request(app)
        .get("/api/friends/status/friend-1")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "accepted",
        requesterId: "user-123"
      });
    });

    test("debe devolver 400 si service falla en solicitud", async () => {
      friendshipService.sendRequest.mockRejectedValueOnce(
        new Error("Ya hay una solicitud pendiente")
      );

      const response = await request(app)
        .post("/api/friends/request/friend-1")
        .set("Authorization", authHeader);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Ya hay una solicitud pendiente");
    });
  });

  describe("plan routes", () => {
    test("debe crear un plan válido", async () => {
      const plan = {
        _id: "plan-1",
        restaurantId: 1,
        proposerId: "user-123",
        status: "proposed"
      };

      planService.createPlan.mockResolvedValueOnce(plan);

      const response = await request(app)
        .post("/api/plans")
        .set("Authorization", authHeader)
        .send({
          restaurantId: 1,
          restaurantName: "Restaurante Test",
          participantIds: ["friend-1"],
          proposedDate: "2026-05-01T18:00:00.000Z",
          context: {
            moment: "dinner",
            when: "weekend"
          }
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(plan);
      expect(planService.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: 1,
          restaurantName: "Restaurante Test",
          participantIds: ["friend-1"]
        }),
        "user-123"
      );
    });

    test("debe devolver 400 si el plan no es válido", async () => {
      const response = await request(app)
        .post("/api/plans")
        .set("Authorization", authHeader)
        .send({
          restaurantId: 1,
          participantIds: [],
          proposedDate: "fecha-mala"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("debe devolver mis planes", async () => {
      const plans = [
        {
          _id: "plan-1",
          proposerId: "user-123"
        }
      ];

      planService.getMyPlans.mockResolvedValueOnce(plans);

      const response = await request(app)
        .get("/api/plans")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(plans);
      expect(planService.getMyPlans).toHaveBeenCalledWith("user-123");
    });

    test("debe devolver plan por id y agregar header ETag", async () => {
      const plan = {
        _id: "plan-1",
        proposerId: "user-123"
      };

      planService.getPlanById.mockResolvedValueOnce(plan);

      const response = await request(app)
        .get("/api/plans/plan-1")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(plan);
      expect(response.headers.etag).toBe("etag-test");
      expect(planService.getPlanById).toHaveBeenCalledWith("plan-1", "user-123");
      expect(planService.getETag).toHaveBeenCalledWith(plan);
    });

    test("debe devolver 404 si no tiene acceso al plan", async () => {
      planService.getPlanById.mockRejectedValueOnce(
        new Error("No tienes acceso a este plan")
      );

      const response = await request(app)
        .get("/api/plans/plan-1")
        .set("Authorization", authHeader);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "No tienes acceso a este plan");
    });

    test("debe aceptar plan usando If-Match", async () => {
      const plan = {
        _id: "plan-1",
        status: "accepted"
      };

      planService.respondToPlan.mockResolvedValueOnce(plan);

      const response = await request(app)
        .post("/api/plans/plan-1/accept")
        .set("Authorization", authHeader)
        .set("If-Match", "etag-old");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(plan);
      expect(response.headers.etag).toBe("etag-test");
      expect(planService.respondToPlan).toHaveBeenCalledWith(
        "plan-1",
        "user-123",
        "accepted",
        "etag-old"
      );
    });

    test("debe devolver 412 si hay conflicto de ETag al aceptar plan", async () => {
      planService.respondToPlan.mockRejectedValueOnce(
        new planService.ETagMismatchError()
      );

      const response = await request(app)
        .post("/api/plans/plan-1/accept")
        .set("Authorization", authHeader)
        .set("If-Match", "etag-old");

      expect(response.status).toBe(412);
      expect(response.body).toHaveProperty(
        "error",
        "El plan fue modificado por otra acción. Recarga e intenta de nuevo."
      );
    });

    test("debe rechazar plan usando If-Match", async () => {
      const plan = {
        _id: "plan-1",
        status: "rejected"
      };

      planService.respondToPlan.mockResolvedValueOnce(plan);

      const response = await request(app)
        .post("/api/plans/plan-1/reject")
        .set("Authorization", authHeader)
        .set("If-Match", "etag-old");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(plan);
      expect(planService.respondToPlan).toHaveBeenCalledWith(
        "plan-1",
        "user-123",
        "rejected",
        "etag-old"
      );
    });

    test("debe completar plan usando If-Match", async () => {
      const plan = {
        _id: "plan-1",
        status: "completed"
      };

      planService.completePlan.mockResolvedValueOnce(plan);

      const response = await request(app)
        .patch("/api/plans/plan-1/complete")
        .set("Authorization", authHeader)
        .set("If-Match", "etag-old");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(plan);
      expect(planService.completePlan).toHaveBeenCalledWith(
        "plan-1",
        "user-123",
        "etag-old"
      );
    });

    test("debe actualizar fecha del plan", async () => {
      const plan = {
        _id: "plan-1",
        status: "proposed"
      };

      planService.updatePlanDate.mockResolvedValueOnce(plan);

      const response = await request(app)
        .patch("/api/plans/plan-1/date")
        .set("Authorization", authHeader)
        .set("If-Match", "etag-old")
        .send({
          proposedDate: "2026-06-01T18:00:00.000Z"
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(plan);
      expect(planService.updatePlanDate).toHaveBeenCalledWith(
        "plan-1",
        "user-123",
        "2026-06-01T18:00:00.000Z",
        "etag-old"
      );
    });

    test("debe devolver 400 si la fecha nueva es inválida", async () => {
      const response = await request(app)
        .patch("/api/plans/plan-1/date")
        .set("Authorization", authHeader)
        .send({
          proposedDate: "fecha-mala"
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("debe invitar participantes al plan", async () => {
      const plan = {
        _id: "plan-1",
        participants: [
          {
            userId: "friend-1",
            status: "pending"
          }
        ]
      };

      planService.inviteParticipants.mockResolvedValueOnce(plan);

      const response = await request(app)
        .post("/api/plans/plan-1/invite")
        .set("Authorization", authHeader)
        .send({
          participantIds: ["friend-1"]
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(plan);
      expect(planService.inviteParticipants).toHaveBeenCalledWith(
        "plan-1",
        "user-123",
        ["friend-1"]
      );
    });

    test("debe devolver 400 si no se mandan participantes al invitar", async () => {
      const response = await request(app)
        .post("/api/plans/plan-1/invite")
        .set("Authorization", authHeader)
        .send({
          participantIds: []
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("debe eliminar participante del plan usando If-Match", async () => {
      const plan = {
        _id: "plan-1",
        participants: []
      };

      planService.removeParticipant.mockResolvedValueOnce(plan);

      const response = await request(app)
        .delete("/api/plans/plan-1/participants/friend-1")
        .set("Authorization", authHeader)
        .set("If-Match", "etag-old");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(plan);
      expect(planService.removeParticipant).toHaveBeenCalledWith(
        "plan-1",
        "user-123",
        "friend-1",
        "etag-old"
      );
    });
  });
});