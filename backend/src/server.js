import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import connectDB from "./config/db.js";
import errorMiddleware from "./middleware/errorMiddleware.js";
import notFoundMiddleware from "./middleware/notFoundMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// CORS: in production, restrict cross-origin access to the known frontend
// origin(s) supplied through CORS_ALLOWED_ORIGIN (comma-separated). When the
// variable is unset the permissive default is preserved so local development
// keeps working without extra configuration.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

if (process.env.MONGODB_URI) {
  // Kick off the connection at module load. In serverless the request handler
  // (api/index.js) awaits the same cached connection before serving DB routes,
  // so a cold-start failure here is non-fatal and is retried per invocation.
  // Attach a no-op catch so a rejected initial attempt never surfaces as an
  // unhandled promise rejection that could crash the container.
  connectDB().catch(() => {});
} else {
  console.log(
    "MongoDB URI not configured; skipping database connection for this architecture step.",
  );
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", message: "BizFlow API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Only start a listening HTTP server for traditional (local/long-running)
// execution. Under tests no server is started, and on Vercel (NODE_ENV=production)
// the exported `app` is invoked directly by the serverless handler in
// api/index.js, so it must NOT bind a port here.
if (process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`BizFlow API listening on port ${port}`);
  });
}

export default app;
