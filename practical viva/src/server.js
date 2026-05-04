const app = require("./app");
const connectDB = require("./config/database");
const { PORT } = require("./config");

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Unable to start server:", err);
    process.exit(1);
  });
