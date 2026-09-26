import mongoose from "mongoose";

// Serverless-safe connection helper.
// - Idempotent: if a warm container already has an open connection (or one is
//   in flight) the existing promise is reused instead of opening a new one.
// - On Vercel the connect promise started at module load is awaited by the
//   request handler (api/index.js) before the first request is served, so a
//   failed attempt can simply be rejected (and retried on the next
//   invocation) rather than killing the process. Outside production the
//   original fail-fast exit is preserved for local development.
// - Bounded timeouts: a serverless function has a hard max duration, so the
//   default 30s server-selection window must be shortened. Otherwise a blocked
//   or unreachable Atlas endpoint hangs every invocation until the platform
//   returns 504. Failing fast lets the handler still serve DB-free routes
//   (e.g. /api/health) and surface a clear per-route error for DB routes.
let connectionPromise = null;

const connectDB = () => {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection);
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    })
    .then(() => mongoose.connection)
    .catch((error) => {
      connectionPromise = null;
      console.error("MongoDB connection failed:", error.message);
      if (process.env.NODE_ENV !== "production") {
        process.exit(1);
      }
      throw error;
    });

  return connectionPromise;
};

export default connectDB;
