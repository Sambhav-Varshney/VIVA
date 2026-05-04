const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const validateBody = require("../middleware/validate");
const {
  userRegisterSchema,
  userLoginSchema,
  refreshSchema
} = require("../validators/schemas");
const authController = require("../controllers/authController");

router.post("/register", validateBody(userRegisterSchema), asyncHandler(authController.register));
router.post("/login", validateBody(userLoginSchema), asyncHandler(authController.login));
router.post("/refresh-token", validateBody(refreshSchema), asyncHandler(authController.refreshToken));
router.post("/logout", validateBody(refreshSchema), asyncHandler(authController.logout));

module.exports = router;
