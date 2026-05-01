module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/server.js",
    "!src/config/db.js",
    "!src/models/review.model.js",
    "!src/utils/broker.util.js",
    "!src/utils/consumer.js",
    "!src/utils/jwt.util.js"
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70
    }
  }
};