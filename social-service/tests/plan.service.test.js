jest.mock("../src/utils/broker.util", () => ({
  publishFriendshipEvent: jest.fn(),
  publishPlanEvent: jest.fn()
}));

const Friendship = require("../src/models/friendship.model");
const Plan = require("../src/models/plan.model");
const planService = require("../src/services/plan.service");
const { publishPlanEvent } = require("../src/utils/broker.util");

describe("Plan service", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.USER_SERVICE_URL = "http://user-service:3001";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        "user-1": {
          name: "Usuario Uno",
          avatar: "user1.png"
        },
        "user-2": {
          name: "Usuario Dos",
          avatar: "user2.png"
        },
        "user-3": {
          name: "Usuario Tres",
          avatar: "user3.png"
        }
      })
    });
  });

  const createFriendship = async (userA = "user-1", userB = "user-2") => {
    return Friendship.create({
      requesterId: userA,
      recipientId: userB,
      status: "accepted"
    });
  };

  describe("getETag", () => {
    test("debe devolver updatedAt como string ISO", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2" }],
        proposedDate: new Date()
      });

      const etag = planService.getETag(plan);

      expect(etag).toBe(plan.updatedAt.toISOString());
    });
  });

  describe("createPlan", () => {
    test("debe lanzar error si un participante no es amigo", async () => {
      await expect(planService.createPlan({
        restaurantId: 1,
        restaurantName: "Restaurante",
        participantIds: ["user-2"],
        proposedDate: "2026-05-01T18:00:00.000Z",
        context: {}
      }, "user-1")).rejects.toThrow("El usuario user-2 no es tu amigo");
    });

    test("debe crear plan y publicar evento", async () => {
      await createFriendship("user-1", "user-2");

      const plan = await planService.createPlan({
        restaurantId: 1,
        restaurantName: "Restaurante",
        participantIds: ["user-2"],
        proposedDate: "2026-05-01T18:00:00.000Z",
        context: {
          moment: "dinner",
          when: "weekend"
        }
      }, "user-1");

      expect(plan.restaurantId).toBe(1);
      expect(plan.proposerId).toBe("user-1");
      expect(plan.participants).toHaveLength(1);
      expect(plan.participants[0].userId).toBe("user-2");
      expect(plan.status).toBe("proposed");

      expect(publishPlanEvent).toHaveBeenCalledWith(
        "plan_proposed",
        expect.objectContaining({
          restaurantId: 1,
          proposerId: "user-1",
          participantIds: ["user-2"]
        })
      );
    });
  });

  describe("respondToPlan", () => {
    test("debe lanzar error si el plan no existe", async () => {
      await expect(planService.respondToPlan(
        "507f1f77bcf86cd799439011",
        "user-2",
        "accepted"
      )).rejects.toThrow("Plan no encontrado");
    });

    test("debe lanzar error si el usuario no está invitado", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      await expect(planService.respondToPlan(
        plan._id.toString(),
        "user-3",
        "accepted"
      )).rejects.toThrow("No estás invitado a este plan");
    });

    test("debe aceptar plan si todos aceptaron", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "pending" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      const result = await planService.respondToPlan(
        plan._id.toString(),
        "user-2",
        "accepted"
      );

      expect(result.participants[0].status).toBe("accepted");
      expect(result.status).toBe("accepted");

      expect(publishPlanEvent).toHaveBeenCalledWith(
        "plan_accepted",
        expect.objectContaining({
          userId: "user-2",
          planStatus: "accepted"
        })
      );
    });

    test("debe rechazar plan si algún participante rechaza", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "pending" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      const result = await planService.respondToPlan(
        plan._id.toString(),
        "user-2",
        "rejected"
      );

      expect(result.participants[0].status).toBe("rejected");
      expect(result.status).toBe("rejected");

      expect(publishPlanEvent).toHaveBeenCalledWith(
        "plan_rejected",
        expect.objectContaining({
          userId: "user-2",
          planStatus: "rejected"
        })
      );
    });

    test("debe lanzar error si ya respondió", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "accepted" }],
        proposedDate: new Date(),
        status: "accepted"
      });

      await expect(planService.respondToPlan(
        plan._id.toString(),
        "user-2",
        "accepted"
      )).rejects.toThrow("Ya respondiste a este plan");
    });

    test("debe lanzar ETagMismatchError si el ETag no coincide", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "pending" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      await expect(planService.respondToPlan(
        plan._id.toString(),
        "user-2",
        "accepted",
        "etag-viejo"
      )).rejects.toThrow(planService.ETagMismatchError);
    });
  });

  describe("completePlan", () => {
    test("debe lanzar error si el plan no existe", async () => {
      await expect(planService.completePlan(
        "507f1f77bcf86cd799439011",
        "user-1"
      )).rejects.toThrow("Plan no encontrado");
    });

    test("debe lanzar error si no es el proponente", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "accepted" }],
        proposedDate: new Date(),
        status: "accepted"
      });

      await expect(planService.completePlan(
        plan._id.toString(),
        "user-2"
      )).rejects.toThrow("Solo el proponente puede completar el plan");
    });

    test("debe lanzar error si el plan no está aceptado", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "pending" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      await expect(planService.completePlan(
        plan._id.toString(),
        "user-1"
      )).rejects.toThrow("El plan debe estar aceptado para completarse");
    });

    test("debe completar plan y publicar evento", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "accepted" }],
        proposedDate: new Date(),
        status: "accepted",
        context: {
          moment: "dinner",
          when: "weekend"
        }
      });

      const result = await planService.completePlan(
        plan._id.toString(),
        "user-1"
      );

      expect(result.status).toBe("completed");
      expect(result.completedAt).not.toBeNull();

      expect(publishPlanEvent).toHaveBeenCalledWith(
        "plan_completed",
        expect.objectContaining({
          restaurantId: 1,
          participants: ["user-1", "user-2"]
        })
      );
    });
  });

  describe("updatePlanDate", () => {
    test("debe actualizar fecha si el usuario es proponente", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        restaurantName: "Restaurante Test",
        proposerId: "user-1",
        participants: [
          { userId: "user-2", status: "accepted" },
          { userId: "user-3", status: "rejected" }
        ],
        proposedDate: new Date("2026-05-01T18:00:00.000Z"),
        status: "accepted"
      });

      const result = await planService.updatePlanDate(
        plan._id.toString(),
        "user-1",
        "2026-06-01T18:00:00.000Z"
      );

      expect(result.status).toBe("proposed");
      expect(result.proposedDate.toISOString()).toBe("2026-06-01T18:00:00.000Z");
      expect(result.participants.every((p) => p.status === "pending")).toBe(true);

      expect(publishPlanEvent).toHaveBeenCalledWith(
        "plan_date_changed",
        expect.objectContaining({
          callerName: "Usuario Uno",
          recipientIds: ["user-2", "user-3"]
        })
      );
    });

    test("debe actualizar fecha si el usuario es participante activo", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [
          { userId: "user-2", status: "accepted" },
          { userId: "user-3", status: "accepted" }
        ],
        proposedDate: new Date("2026-05-01T18:00:00.000Z"),
        status: "accepted"
      });

      const result = await planService.updatePlanDate(
        plan._id.toString(),
        "user-2",
        "2026-06-02T18:00:00.000Z"
      );

      const self = result.participants.find((p) => p.userId === "user-2");
      const other = result.participants.find((p) => p.userId === "user-3");

      expect(result.status).toBe("proposed");
      expect(self.status).toBe("accepted");
      expect(other.status).toBe("pending");

      expect(publishPlanEvent).toHaveBeenCalledWith(
        "plan_date_changed",
        expect.objectContaining({
          callerName: "Usuario Dos",
          recipientIds: ["user-1", "user-3"]
        })
      );
    });

    test("debe lanzar error si el usuario no tiene acceso", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "accepted" }],
        proposedDate: new Date(),
        status: "accepted"
      });

      await expect(planService.updatePlanDate(
        plan._id.toString(),
        "user-4",
        "2026-06-01T18:00:00.000Z"
      )).rejects.toThrow("No tienes acceso a este plan");
    });

    test("debe lanzar error si el plan está completado", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "accepted" }],
        proposedDate: new Date(),
        status: "completed"
      });

      await expect(planService.updatePlanDate(
        plan._id.toString(),
        "user-1",
        "2026-06-01T18:00:00.000Z"
      )).rejects.toThrow("No se puede modificar un plan completado");
    });
  });

  describe("inviteParticipants", () => {
    test("debe invitar nuevos participantes si son amigos", async () => {
      await createFriendship("user-1", "user-3");

      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "pending" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      const result = await planService.inviteParticipants(
        plan._id.toString(),
        "user-1",
        ["user-3"]
      );

      expect(result.participants.map((p) => p.userId)).toEqual(
        expect.arrayContaining(["user-2", "user-3"])
      );
    });

    test("no debe duplicar participante ya invitado", async () => {
      await createFriendship("user-1", "user-2");

      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "pending" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      const result = await planService.inviteParticipants(
        plan._id.toString(),
        "user-1",
        ["user-2"]
      );

      expect(result.participants).toHaveLength(1);
    });

    test("debe lanzar error si no es proponente", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "pending" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      await expect(planService.inviteParticipants(
        plan._id.toString(),
        "user-2",
        ["user-3"]
      )).rejects.toThrow("Solo el proponente puede invitar participantes");
    });

    test("debe lanzar error si el nuevo participante no es amigo", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "pending" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      await expect(planService.inviteParticipants(
        plan._id.toString(),
        "user-1",
        ["user-3"]
      )).rejects.toThrow("El usuario user-3 no es tu amigo");
    });
  });

  describe("removeParticipant", () => {
    test("debe eliminar participante si el usuario es proponente", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [
          { userId: "user-2", status: "accepted" },
          { userId: "user-3", status: "accepted" }
        ],
        proposedDate: new Date(),
        status: "accepted"
      });

      const result = await planService.removeParticipant(
        plan._id.toString(),
        "user-1",
        "user-3"
      );

      expect(result.participants.map((p) => p.userId)).not.toContain("user-3");
      expect(result.status).toBe("accepted");
    });

    test("debe cambiar a proposed si se queda sin participantes", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "accepted" }],
        proposedDate: new Date(),
        status: "accepted"
      });

      const result = await planService.removeParticipant(
        plan._id.toString(),
        "user-1",
        "user-2"
      );

      expect(result.participants).toHaveLength(0);
      expect(result.status).toBe("proposed");
    });

    test("debe lanzar error si no es proponente", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "pending" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      await expect(planService.removeParticipant(
        plan._id.toString(),
        "user-2",
        "user-2"
      )).rejects.toThrow("Solo el proponente puede eliminar participantes");
    });

    test("debe lanzar error si el participante no existe", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2", status: "pending" }],
        proposedDate: new Date(),
        status: "proposed"
      });

      await expect(planService.removeParticipant(
        plan._id.toString(),
        "user-1",
        "user-3"
      )).rejects.toThrow("Participante no encontrado en el plan");
    });
  });

  describe("getMyPlans", () => {
    test("debe devolver planes donde soy proponente o participante", async () => {
      await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2" }],
        proposedDate: new Date()
      });

      await Plan.create({
        restaurantId: 2,
        proposerId: "user-3",
        participants: [{ userId: "user-1" }],
        proposedDate: new Date()
      });

      const plans = await planService.getMyPlans("user-1");

      expect(plans).toHaveLength(2);
    });
  });

  describe("getPlanById", () => {
    test("debe lanzar error si no existe", async () => {
      await expect(planService.getPlanById(
        "507f1f77bcf86cd799439011",
        "user-1"
      )).rejects.toThrow("Plan no encontrado");
    });

    test("debe lanzar error si el usuario no está involucrado", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2" }],
        proposedDate: new Date()
      });

      await expect(planService.getPlanById(
        plan._id.toString(),
        "user-3"
      )).rejects.toThrow("No tienes acceso a este plan");
    });

    test("debe devolver plan si el usuario está involucrado", async () => {
      const plan = await Plan.create({
        restaurantId: 1,
        proposerId: "user-1",
        participants: [{ userId: "user-2" }],
        proposedDate: new Date()
      });

      const result = await planService.getPlanById(
        plan._id.toString(),
        "user-2"
      );

      expect(result._id.toString()).toBe(plan._id.toString());
    });
  });
});