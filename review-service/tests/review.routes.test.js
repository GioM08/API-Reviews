const request = require("supertest");

jest.mock("../src/utils/jwt.util", () => ({
  verifyToken: jest.fn()
}));

jest.mock("../src/services/review.service", () => ({
  createReview: jest.fn(),
  getReviews: jest.fn(),
  getSegmentedScores: jest.fn(),
  addVote: jest.fn(),
  reportReview: jest.fn(),
  getReportedReviews: jest.fn(),
  hideReview: jest.fn(),
  deleteReview: jest.fn(),
  toggleLike: jest.fn(),
  getComments: jest.fn(),
  addComment: jest.fn(),
  deleteComment: jest.fn()
}));

const app = require("../src/app");
const service = require("../src/services/review.service");
const { verifyToken } = require("../src/utils/jwt.util");

const authHeader = "Bearer fake-token";

describe("Review routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    verifyToken.mockReturnValue({
      id: "user-123",
      role: "user"
    });
  });

  describe("GET /api/reviews/health", () => {
    test("debe devolver status ok", async () => {
      const response = await request(app)
        .get("/api/reviews/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("GET /api/reviews", () => {
    test("debe devolver 400 si no se manda restaurantId ni userId", async () => {
      const response = await request(app)
        .get("/api/reviews");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Se requiere restaurantId o userId");
    });

    test("debe consultar reseñas por restaurantId sin usuario autenticado", async () => {
      const reviews = [
        { id: 1, restaurant_id: 10, stars: 5 }
      ];

      service.getReviews.mockResolvedValueOnce(reviews);

      const response = await request(app)
        .get("/api/reviews")
        .query({ restaurantId: "10" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(reviews);
      expect(service.getReviews).toHaveBeenCalledWith(
        { restaurantId: 10, userId: null },
        null
      );
    });

    test("debe consultar reseñas con viewerId si se manda token", async () => {
      service.getReviews.mockResolvedValueOnce([]);

      const response = await request(app)
        .get("/api/reviews")
        .set("Authorization", authHeader)
        .query({ userId: "user-123" });

      expect(response.status).toBe(200);
      expect(service.getReviews).toHaveBeenCalledWith(
        { restaurantId: null, userId: "user-123" },
        "user-123"
      );
    });

    test("debe devolver 500 si ocurre error al consultar reseñas", async () => {
      service.getReviews.mockRejectedValueOnce(new Error("Error interno"));

      const response = await request(app)
        .get("/api/reviews")
        .query({ restaurantId: "10" });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Error interno");
    });
  });

  describe("POST /api/reviews", () => {
    test("debe devolver 401 si no se manda token", async () => {
      const response = await request(app)
        .post("/api/reviews")
        .send({
          restaurantId: 1,
          stars: 5,
          comment: "Excelente"
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No autorizado");
    });

    test("debe crear una reseña válida", async () => {
      const review = {
        id: 1,
        restaurant_id: 1,
        user_id: "user-123",
        stars: 5,
        comment: "Excelente"
      };

      service.createReview.mockResolvedValueOnce(review);

      const response = await request(app)
        .post("/api/reviews")
        .set("Authorization", authHeader)
        .send({
          restaurantId: 1,
          stars: 5,
          comment: "Excelente",
          context: {
            moment: "lunch",
            company: "friends",
            when: "weekend",
            price_range: "100-200"
          },
          media: [
            {
              url: "https://example.com/foto.jpg",
              media_type: "image",
              filename: "foto.jpg"
            }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(review);
      expect(service.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: 1,
          stars: 5,
          comment: "Excelente"
        }),
        "user-123"
      );
    });

    test("debe devolver 400 si la reseña no es válida", async () => {
      const response = await request(app)
        .post("/api/reviews")
        .set("Authorization", authHeader)
        .send({
          restaurantId: 1,
          stars: 10
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/reviews/restaurant/:id/segmented", () => {
    test("debe devolver 400 si el restaurantId es inválido", async () => {
      const response = await request(app)
        .get("/api/reviews/restaurant/abc/segmented");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "restaurantId inválido");
    });

    test("debe devolver scores segmentados", async () => {
      const scores = [
        { moment: "lunch", avg_score: "4.5", review_count: 2 }
      ];

      service.getSegmentedScores.mockResolvedValueOnce(scores);

      const response = await request(app)
        .get("/api/reviews/restaurant/1/segmented");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(scores);
      expect(service.getSegmentedScores).toHaveBeenCalledWith(1);
    });
  });

  describe("POST /api/reviews/:id/vote", () => {
    test("debe votar una reseña", async () => {
      const updatedReview = {
        id: 1,
        upvotes: 1,
        downvotes: 0
      };

      service.addVote.mockResolvedValueOnce(updatedReview);

      const response = await request(app)
        .post("/api/reviews/1/vote")
        .set("Authorization", authHeader)
        .send({ voteType: "up" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedReview);
      expect(service.addVote).toHaveBeenCalledWith(1, "user-123", "up");
    });

    test("debe devolver 400 si el voto es inválido", async () => {
      const response = await request(app)
        .post("/api/reviews/1/vote")
        .set("Authorization", authHeader)
        .send({ voteType: "invalid" });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/reviews/:id/report", () => {
    test("debe reportar una reseña", async () => {
      service.reportReview.mockResolvedValueOnce();

      const response = await request(app)
        .post("/api/reviews/1/report")
        .set("Authorization", authHeader)
        .send({ reason: "Contenido inapropiado" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Reseña reportada" });
      expect(service.reportReview).toHaveBeenCalledWith(
        1,
        "user-123",
        "Contenido inapropiado"
      );
    });
  });

  describe("POST /api/reviews/:id/like", () => {
    test("debe alternar like de una reseña", async () => {
      service.toggleLike.mockResolvedValueOnce({
        liked: true,
        likes_count: 1
      });

      const response = await request(app)
        .post("/api/reviews/1/like")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        liked: true,
        likes_count: 1
      });
      expect(service.toggleLike).toHaveBeenCalledWith(1, "user-123");
    });
  });

  describe("comments", () => {
    test("debe devolver comentarios de una reseña", async () => {
      const comments = [
        { id: 1, review_id: 1, text: "Buen lugar" }
      ];

      service.getComments.mockResolvedValueOnce(comments);

      const response = await request(app)
        .get("/api/reviews/1/comments");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(comments);
      expect(service.getComments).toHaveBeenCalledWith(1);
    });

    test("debe agregar comentario", async () => {
      const comment = {
        id: 1,
        review_id: 1,
        user_id: "user-123",
        text: "Buen lugar"
      };

      service.addComment.mockResolvedValueOnce(comment);

      const response = await request(app)
        .post("/api/reviews/1/comments")
        .set("Authorization", authHeader)
        .send({ text: "Buen lugar" });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(comment);
      expect(service.addComment).toHaveBeenCalledWith(
        1,
        "user-123",
        "Buen lugar"
      );
    });

    test("debe devolver 400 si el comentario está vacío", async () => {
      const response = await request(app)
        .post("/api/reviews/1/comments")
        .set("Authorization", authHeader)
        .send({ text: "" });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("debe eliminar comentario", async () => {
      service.deleteComment.mockResolvedValueOnce();

      const response = await request(app)
        .delete("/api/reviews/1/comments/5")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Comentario eliminado" });
      expect(service.deleteComment).toHaveBeenCalledWith(5, "user-123");
    });
  });

  describe("admin routes", () => {
    test("debe devolver 403 si el usuario no es admin", async () => {
      const response = await request(app)
        .get("/api/reviews/reported")
        .set("Authorization", authHeader);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        "error",
        "Solo administradores pueden realizar esta acción"
      );
    });

    test("debe devolver reseñas reportadas si el usuario es admin", async () => {
      verifyToken.mockReturnValueOnce({
        id: "admin-1",
        role: "admin"
      });

      const reported = [
        { id: 1, report_count: "2" }
      ];

      service.getReportedReviews.mockResolvedValueOnce(reported);

      const response = await request(app)
        .get("/api/reviews/reported")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(reported);
    });

    test("debe ocultar reseña si el usuario es admin", async () => {
      verifyToken.mockReturnValueOnce({
        id: "admin-1",
        role: "admin"
      });

      const hiddenReview = {
        id: 1,
        hidden: true
      };

      service.hideReview.mockResolvedValueOnce(hiddenReview);

      const response = await request(app)
        .patch("/api/reviews/1/hide")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(hiddenReview);
      expect(service.hideReview).toHaveBeenCalledWith(1);
    });

    test("debe eliminar reseña si el usuario es admin", async () => {
      verifyToken.mockReturnValueOnce({
        id: "admin-1",
        role: "admin"
      });

      service.deleteReview.mockResolvedValueOnce();

      const response = await request(app)
        .delete("/api/reviews/1")
        .set("Authorization", authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Reseña eliminada" });
      expect(service.deleteReview).toHaveBeenCalledWith(1);
    });
  });
});