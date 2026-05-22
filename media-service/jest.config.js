module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/server.js"
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      functions: 70,
      lines: 70
    }
  }
};