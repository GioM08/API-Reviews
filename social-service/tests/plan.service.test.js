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
  });

  const createFriendship = async (userA = "user-1", userB = "user-2") => {
    return Friendship.create({
      requesterId: userA,
      recipientId: userB,
      status: "accepted"
    });
  };

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