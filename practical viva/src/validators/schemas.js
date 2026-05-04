const Joi = require("joi");

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
  refreshToken: Joi.string().required() });

module.exports = {
  userRegisterSchema,
  userLoginSchema,
  postCreateSchema,
  postUpdateSchema,
  commentCreateSchema,
  refreshSchema
};
