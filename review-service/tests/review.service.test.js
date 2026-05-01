jest.mock("../src/config/db", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn()
  }
}));

jest.mock("../src/utils/broker.util", () => ({
  publishReviewCreated: jest.fn(),
  publishInteractionEvent: jest.fn()
}));

const { pool } = require("../src/config/db");
const {
  publishReviewCreated,
  publishInteractionEvent
} = require("../src/utils/broker.util");
const service = require("../src/services/review.service");

describe("Review service", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.USER_SERVICE_URL = "http://user-service:3001";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        "user-123": {
          name: "Usuario Test",
          avatar: "avatar.png"
        },
        "actor-123": {
          name: "Actor Test",
          avatar: "actor.png"
        }
      })
    });
  });

  describe("storeRestaurant", () => {
    test("debe guardar o actualizar restaurante localmente", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.storeRestaurant({
        id: 1,
        name: "Restaurante Test"
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO restaurants"),
        [1, "Restaurante Test"]
      );
    });
  });

  describe("createReview", () => {
    test("debe lanzar error si el restaurante no existe", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.createReview({
        restaurantId: 1,
        stars: 5,
        comment: "Excelente"
      }, "user-123")).rejects.toThrow("Restaurante no encontrado");
    });

    test("debe lanzar error si ya reseñó ese restaurante recientemente", async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 99 }] });

      await expect(service.createReview({
        restaurantId: 1,
        stars: 5,
        comment: "Excelente"
      }, "user-123")).rejects.toThrow(
        "Solo puedes reseñar este restaurante una vez por semana"
      );
    });

    test("debe crear una reseña con media y publicar evento", async () => {
      const review = {
        id: 10,
        restaurant_id: 1,
        user_id: "user-123",
        stars: 5,
        comment: "Excelente"
      };

      const media = {
        id: 1,
        review_id: 10,
        url: "https://example.com/foto.jpg",
        media_type: "image",
        filename: "foto.jpg"
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [review] })
        .mockResolvedValueOnce({ rows: [media] });

      const result = await service.createReview({
        restaurantId: 1,
        stars: 5,
        comment: "Excelente",
        context: { moment: "lunch" },
        planId: "plan-1",
        media: [
          {
            url: "https://example.com/foto.jpg",
            media_type: "image",
            filename: "foto.jpg"
          }
        ]
      }, "user-123");

      expect(result).toEqual({
        ...review,
        media: [media]
      });

      expect(publishReviewCreated).toHaveBeenCalledWith({
        restaurantId: 1,
        stars: 5,
        userId: "user-123",
        reviewId: 10,
        context: { moment: "lunch" }
      });
    });
  });

  describe("getSegmentedScores", () => {
    test("debe devolver scores segmentados", async () => {
      const scores = [
        {
          moment: "lunch",
          company: "friends",
          avg_score: "4.5",
          review_count: 2
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: scores });

      const result = await service.getSegmentedScores(1);

      expect(result).toEqual(scores);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("ROUND(AVG(stars)"),
        [1]
      );
    });
  });

  describe("getReviews", () => {
    test("debe obtener reseñas y enriquecerlas con datos de usuario", async () => {
      const reviews = [
        {
          id: 1,
          user_id: "user-123",
          restaurant_id: 1,
          stars: 5
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: reviews });

      const result = await service.getReviews({
        restaurantId: 1,
        userId: null
      }, "viewer-123");

      expect(result[0].user_name).toBe("Usuario Test");
      expect(result[0].user_avatar).toBe("avatar.png");
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test("debe devolver reseñas sin enriquecer si user-service falla", async () => {
      const reviews = [
        {
          id: 1,
          user_id: "user-123",
          restaurant_id: 1,
          stars: 5
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: reviews });
      global.fetch.mockRejectedValueOnce(new Error("User service down"));

      const result = await service.getReviews({
        restaurantId: 1,
        userId: null
      });

      expect(result).toEqual(reviews);
    });
  });

  describe("addVote", () => {
    test("debe agregar voto nuevo tipo up", async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn()
      };

      pool.connect.mockResolvedValueOnce(client);

      client.query.mockImplementation(async (sql) => {
        if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };

        if (sql.includes("SELECT vote_type")) {
          return { rows: [] };
        }

        if (sql.includes("SELECT * FROM reviews")) {
          return {
            rows: [
              {
                id: 1,
                user_id: "user-123",
                restaurant_id: 1,
                upvotes: 1,
                downvotes: 0
              }
            ]
          };
        }

        return { rows: [] };
      });

      const result = await service.addVote(1, "user-123", "up");

      expect(result.upvotes).toBe(1);
      expect(client.query).toHaveBeenCalledWith("BEGIN");
      expect(client.query).toHaveBeenCalledWith("COMMIT");
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    test("debe hacer rollback si el usuario ya votó igual", async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn()
      };

      pool.connect.mockResolvedValueOnce(client);

      client.query.mockImplementation(async (sql) => {
        if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };

        if (sql.includes("SELECT vote_type")) {
          return { rows: [{ vote_type: "up" }] };
        }

        return { rows: [] };
      });

      await expect(service.addVote(1, "user-123", "up"))
        .rejects
        .toThrow("Ya votaste de esta forma");

      expect(client.query).toHaveBeenCalledWith("ROLLBACK");
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  describe("reportReview", () => {
    test("debe reportar una reseña", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.reportReview(1, "user-123", "Spam");

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO reports"),
        [1, "user-123", "Spam"]
      );
    });
  });

  describe("getReportedReviews", () => {
    test("debe devolver reseñas reportadas", async () => {
      const reported = [
        { id: 1, report_count: "3" }
      ];

      pool.query.mockResolvedValueOnce({ rows: reported });

      const result = await service.getReportedReviews();

      expect(result).toEqual(reported);
    });
  });

  describe("hideReview", () => {
    test("debe ocultar una reseña", async () => {
      const hiddenReview = {
        id: 1,
        hidden: true
      };

      pool.query.mockResolvedValueOnce({ rows: [hiddenReview] });

      const result = await service.hideReview(1);

      expect(result).toEqual(hiddenReview);
    });

    test("debe lanzar error si la reseña no existe", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.hideReview(999))
        .rejects
        .toThrow("Reseña no encontrada");
    });
  });

  describe("deleteReview", () => {
    test("debe eliminar votos, reportes y reseña", async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await service.deleteReview(1);

      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    test("debe lanzar error si la reseña no existe", async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(service.deleteReview(999))
        .rejects
        .toThrow("Reseña no encontrada");
    });
  });

  describe("toggleLike", () => {
    test("debe agregar like si no existe", async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn()
      };

      pool.connect.mockResolvedValueOnce(client);

      client.query.mockImplementation(async (sql) => {
        if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };

        if (sql.includes("SELECT id FROM likes")) {
          return { rows: [] };
        }

        if (sql.includes("SELECT user_id, restaurant_id, likes_count")) {
          return {
            rows: [
              {
                user_id: "user-123",
                restaurant_id: 1,
                likes_count: 1
              }
            ]
          };
        }

        return { rows: [] };
      });

      const result = await service.toggleLike(1, "user-123");

      expect(result).toEqual({
        liked: true,
        likes_count: 1
      });

      expect(client.query).toHaveBeenCalledWith("COMMIT");
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    test("debe quitar like si ya existe", async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn()
      };

      pool.connect.mockResolvedValueOnce(client);

      client.query.mockImplementation(async (sql) => {
        if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };

        if (sql.includes("SELECT id FROM likes")) {
          return { rows: [{ id: 1 }] };
        }

        if (sql.includes("SELECT user_id, restaurant_id, likes_count")) {
          return {
            rows: [
              {
                user_id: "user-123",
                restaurant_id: 1,
                likes_count: 0
              }
            ]
          };
        }

        return { rows: [] };
      });

      const result = await service.toggleLike(1, "user-123");

      expect(result).toEqual({
        liked: false,
        likes_count: 0
      });
    });
  });

  describe("comments", () => {
    test("debe devolver comentarios vacíos", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getComments(1);

      expect(result).toEqual([]);
    });

    test("debe devolver comentarios enriquecidos con usuario", async () => {
      const comments = [
        {
          id: 1,
          review_id: 1,
          user_id: "user-123",
          text: "Buen lugar"
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: comments });

      const result = await service.getComments(1);

      expect(result[0].user_name).toBe("Usuario Test");
      expect(result[0].user_avatar).toBe("avatar.png");
    });

    test("debe lanzar error si la reseña no existe al comentar", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.addComment(1, "user-123", "Comentario"))
        .rejects
        .toThrow("Reseña no encontrada");
    });

    test("debe agregar comentario", async () => {
      const comment = {
        id: 1,
        review_id: 1,
        user_id: "user-123",
        text: "Buen lugar"
      };

      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              user_id: "user-123",
              restaurant_id: 1
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [comment] });

      const result = await service.addComment(1, "user-123", "Buen lugar");

      expect(result).toEqual(comment);
    });

    test("debe eliminar comentario", async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await service.deleteComment(1, "user-123");

      expect(pool.query).toHaveBeenCalledWith(
        "DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id",
        [1, "user-123"]
      );
    });

    test("debe lanzar error si no puede eliminar comentario", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.deleteComment(1, "user-123"))
        .rejects
        .toThrow("Comentario no encontrado o no tienes permiso");
    });
  });
});