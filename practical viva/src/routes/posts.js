const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const { auth } = require("../middleware/auth");
const validateBody = require("../middleware/validate");
const {
  postCreateSchema,
  postUpdateSchema,
  commentCreateSchema
} = require("../validators/schemas");
const postController = require("../controllers/postController");
const commentController = require("../controllers/commentController");

router.post("/posts", auth, validateBody(postCreateSchema), asyncHandler(postController.createPost));
router.get("/posts", asyncHandler(postController.listPosts));
router.get("/posts/trending", asyncHandler(postController.getTrendingPosts));
router.get("/posts/:id", asyncHandler(postController.getPost));
router.put("/posts/:id", auth, validateBody(postUpdateSchema), asyncHandler(postController.updatePost));
router.delete("/posts/:id", auth, asyncHandler(postController.deletePost));
router.post("/posts/:id/comments", auth, validateBody(commentCreateSchema), asyncHandler(commentController.addComment));

module.exports = router;
