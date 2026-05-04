const Post = require("../models/Post");
const Comment = require("../models/Comment");
const { presentPost, presentTrendingPost } = require("../presenters/postPresenter");

async function createPost(req, res) {
  const { title, content, tags } = req.body;
  const duplicate = await Post.findOne({ title });
  if (duplicate) {
    return res.status(409).json({ error: "A post with that title already exists" });
  }

  const post = await Post.create({ userId: req.user.id, title, content, tags });
  res.status(201).json(post);
}

async function listPosts(req, res) {
  const posts = await Post.find().populate("userId", "name email").sort({ createdAt: -1 }).lean();
  const postsWithComments = await Promise.all(posts.map(async post => {
    const comments = await Comment.find({ postId: post._id }).populate("userId", "name email").sort({ createdAt: -1 }).lean();
    return presentPost(post, comments);
  }));

  res.json(postsWithComments);
}

async function getPost(req, res) {
  const post = await Post.findById(req.params.id).populate("userId", "name email").lean();
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  const comments = await Comment.find({ postId: post._id }).populate("userId", "name email").sort({ createdAt: -1 }).lean();
  res.json(presentPost(post, comments));
}

async function updatePost(req, res) {
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
}

async function deletePost(req, res) {
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
}

async function getTrendingPosts(req, res) {
  const trending = await Comment.aggregate([
    { $group: { _id: "$postId", commentCount: { $sum: 1 } } },
    { $sort: { commentCount: -1 } },
    { $limit: 10 },
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
        _id: "$post._id",
        title: "$post.title",
        content: "$post.content",
        tags: "$post.tags",
        createdAt: "$post.createdAt",
        commentCount: 1,
        author: { id: "$author._id", name: "$author.name", email: "$author.email" }
      }
    }
  ]);

  res.json(trending.map(post => presentTrendingPost(post)));
}

module.exports = {
  createPost,
  listPosts,
  getPost,
  updatePost,
  deletePost,
  getTrendingPosts
};
