const mongoose = require("mongoose");
const { MONGO_URL } = require("./index");

async function connectDB() {
  return mongoose.connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
}

module.exports = connectDB;
