const express = require("express");
const router = express.Router();

const authRoutes = require("./auth");
const postRoutes = require("./posts");

router.use(authRoutes);
router.use(postRoutes);

module.exports = router;
