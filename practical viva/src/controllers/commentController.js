const Comment = require("../models/Comment");
const Post = require("../models/Post");

async function addComment(req, res) {
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
}

module.exports = { addComment };
