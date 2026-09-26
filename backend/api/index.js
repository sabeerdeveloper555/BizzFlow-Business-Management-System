// Vercel Serverless entry point for the existing Express app.
// Imports src/server.js, which builds the full app (middleware, CORS, JWT
// auth, all /api/... routes) and exports it without listening when
// NODE_ENV=production. `@vercel/node` supports passing an Express app
// directly as the handler, so no app code is duplicated here.
//
// connectDB() returns the already-in-flight (or completed) connection
// promise started by server.js at module load, so awaiting it here gives the
// database a chance to come online (warm containers reuse the same
// connection) before the first request is served. It is intentionally NOT a
// hard gate: the Express app is always forwarded to, so DB-independent routes
// like GET /api/health keep responding even when the database is
// unavailable. That matches the original server behavior; routes that do need
// the database surface their own error through the shared error middleware.
import app from "../src/server.js";
import connectDB from "../src/config/db.js";

export default async function handler(request, response) {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
    }
  } catch (_error) {
    console.error("Database unavailable for this invocation:", _error.message);
  }

  return app(request, response);
}
