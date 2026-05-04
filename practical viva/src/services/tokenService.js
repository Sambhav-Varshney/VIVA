const jwt = require("jsonwebtoken");
const RefreshToken = require("../models/RefreshToken");
const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = require("../config");

function createAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
}

function createRefreshToken(user) {
  return jwt.sign({ id: user._id }, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
}

async function saveRefreshToken(userId, token) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ token, userId, expiresAt });
}

async function revokeRefreshToken(token) {
  await RefreshToken.deleteOne({ token });
}

async function verifyRefreshToken(token) {
  const stored = await RefreshToken.findOne({ token });
  if (!stored) {
    throw new Error("Refresh token not found");
  }
  if (stored.expiresAt < new Date()) {
    await revokeRefreshToken(token);
    throw new Error("Refresh token expired");
  }
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
  verifyRefreshToken
};
