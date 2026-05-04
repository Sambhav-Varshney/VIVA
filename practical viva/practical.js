const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});
app.use(apiLimiter);

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/blogging";
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "access-secret-123";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "refresh-secret-456";

mongoose.connect(MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("DB Connected"))
  .catch(err => console.error("DB connection error:", err));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, unique: true, trim: true },
  content: { type: String, required: true },
  tags: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});
postSchema.index({ title: 1 }, { unique: true });

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  comment: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);
const Comment = mongoose.model("Comment", commentSchema);
const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

const userRegisterSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const userLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const postCreateSchema = Joi.object({
  title: Joi.string().min(5).max(150).required(),
  content: Joi.string().min(20).required(),
  tags: Joi.array().items(Joi.string().min(1).max(30)).default([])
});

const postUpdateSchema = Joi.object({
  title: Joi.string().min(5).max(150),
  content: Joi.string().min(20),
  tags: Joi.array().items(Joi.string().min(1).max(30))
}).min(1);

const commentCreateSchema = Joi.object({
  comment: Joi.string().min(3).max(500).required()
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

function validateBody(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    next();
  };
}

async function createAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
}

async function createRefreshToken(user) {
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

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}

function admin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

async function getPostWithComments(post) {
  const comments = await Comment.find({ postId: post._id })
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return {
    ...post,
    comments: comments.map(c => ({
      id: c._id,
      user: c.userId,
      comment: c.comment,
      createdAt: c.createdAt
    }))
  };
}

async function getTrendingPosts(limit = 5) {
  const trending = await Comment.aggregate([
    { $group: { _id: "$postId", commentCount: { $sum: 1 } } },
    { $sort: { commentCount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "posts",
        localField: "_id",
        foreignField: "_id",
        as: "post"
      }
    },
    { $unwind: "$post" },
    {
      $lookup: {
        from: "users",
        localField: "post.userId",
        foreignField: "_id",
        as: "author"
      }
    },
    { $unwind: "$author" },
    {
      $project: {
        id: "$post._id",
        title: "$post.title",
        content: "$post.content",
        tags: "$post.tags",
        createdAt: "$post.createdAt",
        commentCount: 1,
        author: { id: "$author._id", name: "$author.name", email: "$author.email" }
      }
    }
  ]);

  return trending;
}

app.post("/register", validateBody(userRegisterSchema), async (req, res) => {
  const { name, email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
});

app.post("/login", validateBody(userLoginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const accessToken = await createAccessToken(user);
  const refreshToken = await createRefreshToken(user);
  await saveRefreshToken(user._id, refreshToken);

  res.json({ accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});

app.post("/refresh-token", validateBody(refreshSchema), async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const payload = await verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const accessToken = await createAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post("/logout", validateBody(refreshSchema), async (req, res) => {
  await revokeRefreshToken(req.body.refreshToken);
  res.json({ message: "Logged out" });
});

app.post("/posts", auth, validateBody(postCreateSchema), async (req, res) => {
  const { title, content, tags } = req.body;
  const existing = await Post.findOne({ title });
  if (existing) {
    return res.status(409).json({ error: "A post with that title already exists" });
  }

  const post = await Post.create({ userId: req.user.id, title, content, tags });
  res.status(201).json(post);
});

app.get("/posts", async (req, res) => {
  const posts = await Post.find().populate("userId", "name email").sort({ createdAt: -1 }).lean();
  const postsWithComments = await Promise.all(posts.map(async post => {
    const comments = await Comment.find({ postId: post._id }).populate("userId", "name email").sort({ createdAt: -1 }).lean();
    return {
      id: post._id,
      title: post.title,
      content: post.content,
      tags: post.tags,
      author: post.userId,
      createdAt: post.createdAt,
      comments: comments.map(comment => ({
        id: comment._id,
        comment: comment.comment,
        user: comment.userId,
        createdAt: comment.createdAt
      }))
    };
  }));

  res.json(postsWithComments);
});

app.get("/posts/trending", async (req, res) => {
  const trending = await getTrendingPosts(10);
  res.json(trending);
});

app.get("/posts/:id", async (req, res) => {
  const post = await Post.findById(req.params.id).populate("userId", "name email").lean();
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  const comments = await Comment.find({ postId: post._id }).populate("userId", "name email").sort({ createdAt: -1 }).lean();
  res.json({
    id: post._id,
    title: post.title,
    content: post.content,
    tags: post.tags,
    author: post.userId,
    createdAt: post.createdAt,
    comments: comments.map(comment => ({
      id: comment._id,
      comment: comment.comment,
      user: comment.userId,
      createdAt: comment.createdAt
    }))
  });
});

app.put("/posts/:id", auth, validateBody(postUpdateSchema), async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }
  if (post.userId.toString() !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You are not allowed to update this post" });
  }

  if (req.body.title && req.body.title !== post.title) {
    const duplicate = await Post.findOne({ title: req.body.title });
    if (duplicate) {
      return res.status(409).json({ error: "A post with that title already exists" });
    }
  }

  Object.assign(post, req.body);
  await post.save();
  res.json(post);
});

app.delete("/posts/:id", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }
  if (post.userId.toString() !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You are not allowed to delete this post" });
  }

  await Comment.deleteMany({ postId: post._id });
  await post.deleteOne();
  res.json({ message: "Post deleted" });
});

app.post("/posts/:id/comments", auth, validateBody(commentCreateSchema), async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  const comment = await Comment.create({
    postId: post._id,
    userId: req.user.id,
    comment: req.body.comment
  });

  res.status(201).json(comment);
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: "Duplicate value detected" });
  }
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));