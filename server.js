// server/server.js
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception 💥 Shutting down!");
  console.error(err);
  process.exit(1);
});

const mongoose = require("mongoose");

const DB = process.env.DATABASE.replace(
  "<password>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB Atlas!"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err.message);
  });

const app = require("./app");
const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`🚀 App running on port:${port}`);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection 💥 Shutting down!");
  console.error(err);
  process.exit(1);
});
