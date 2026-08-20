import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not configured");
}

const redis = new URL(redisUrl);

const connection = {
  host: redis.hostname,
  port: Number(redis.port || 6379),
  username: redis.username || undefined,
  password: redis.password || undefined,
  tls: redis.protocol === "rediss:" ? {} : undefined,
};

export const emailQueue = new Queue("email-queue", {
  connection,
});