module.exports = {
  MONGO_URL: process.env.MONGO_URL || "mongodb://127.0.0.1:27017/blogging",
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || "access-secret-123",
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || "refresh-secret-456",
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  RATE_LIMIT_MAX: 120,
  PORT: process.env.PORT || 5000
};
