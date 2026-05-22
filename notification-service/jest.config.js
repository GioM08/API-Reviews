module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/server.js",
    "!src/config/db.js",
    "!src/utils/consumer.js",
    "!src/utils/firebase.js",
    "!src/utils/jwt.util.js"
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      functions: 70,
      lines: 70
    }
  }
};