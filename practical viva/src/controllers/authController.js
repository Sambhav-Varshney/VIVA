const bcrypt = require("bcryptjs");
const User = require("../models/User");
const {
  createAccessToken,
  createRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
  verifyRefreshToken
} = require("../services/tokenService");
const { presentUser } = require("../presenters/userPresenter");

async function register(req, res) {
  const { name, email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  res.status(201).json(presentUser(user));
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  await saveRefreshToken(user._id, refreshToken);

  res.json({ accessToken, refreshToken, user: presentUser(user) });
}

async function refreshToken(req, res) {
  const { refreshToken } = req.body;
  const payload = await verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.id);
  if (!user) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  const accessToken = createAccessToken(user);
  res.json({ accessToken });
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  await revokeRefreshToken(refreshToken);
  res.json({ message: "Logged out" });
}

module.exports = {
  register,
  login,
  refreshToken,
  logout
};
