import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { findUserByGoogleId } from "./services/user.service";
import authRouter from "./routes/auth.routes";
import campaignRouter from "./routes/campaign.routes";
import session from "express-session";
import passport from "./config/passport";
import { createClient } from "redis";
import { RedisStore } from "connect-redis";
import emailRouter from "./routes/email.routes";
import { startEmailWorker } from "./workers/email.worker";

export const app = express();

const PORT = 5000;

const frontendUrl =
  process.env.FRONTEND_URL || "http://localhost:5173";

// Redis client for persistent sessions
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (error) => {
  console.error("Redis Client Error:", error);
});

async function startServer() {
  // Connect to Redis
  await redisClient.connect();

  // Start BullMQ email worker
  await startEmailWorker();

  const redisStore = new RedisStore({
    client: redisClient,
    prefix: "reachinbox:",
  });

  // Allow the React frontend to communicate with the backend
  app.use(
    cors({
      origin: frontendUrl,
      credentials: true,
    })
  );

  // Session middleware
  app.use(
    session({
      store: redisStore,
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite:
          process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    })
  );

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // JSON body parser
  app.use(express.json());

  // Routes
  app.use("/auth", authRouter);
  app.use("/api/campaigns", campaignRouter);
  app.use("/api/emails", emailRouter);

  // Root
  app.get("/", (_req, res) => {
    return res.json({
      message: "ReachInbox Email Scheduler API is running",
    });
  });

  // Database health check
  app.get("/health/db", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      return res.json({
        database: "connected",
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        database: "disconnected",
      });
    }
  });

  // User health check
  app.get("/health/user", async (_req, res) => {
    try {
      const user = await findUserByGoogleId("test-google-id");

      return res.json({
        found: user !== null,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        error: "Database query failed",
      });
    }
  });

  console.log("Auth router mounted");

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});