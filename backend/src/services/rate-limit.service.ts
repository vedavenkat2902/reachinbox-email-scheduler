import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (error) => {
  console.error("Rate limit Redis error:", error);
});

let connected = false;

async function getRedisClient() {
  if (!connected) {
    await redisClient.connect();
    connected = true;
  }

  return redisClient;
}

/**
 * Reserve one email slot in the current hourly window.
 *
 * The operation is performed atomically in Redis so that
 * multiple concurrent workers cannot exceed the limit.
 */
export async function reserveHourlyCapacity(
  senderEmail: string,
  hourlyLimit: number
) {
  const client = await getRedisClient();

  if (hourlyLimit <= 0) {
    return {
      allowed: true,
      retryAt: null,
    };
  }

  /*
   * Use Redis server time so that all workers/instances
   * use the same clock.
   */
  const redisTime = await client.time();

  const seconds = Number(redisTime[0]);

  const currentHour = new Date(seconds * 1000);
  currentHour.setUTCMinutes(0, 0, 0);

  const hourKey = currentHour.toISOString();

  const key = `email-rate:${senderEmail}:${hourKey}`;

  /*
   * Atomically:
   *
   * 1. Increment the counter.
   * 2. Check the limit.
   * 3. If the limit is exceeded, undo the increment.
   *
   * This prevents race conditions between concurrent workers.
   */
  const script = `
    local count = redis.call("INCR", KEYS[1])

    if count == 1 then
      redis.call("EXPIRE", KEYS[1], 7200)
    end

    if count <= tonumber(ARGV[1]) then
      return count
    end

    redis.call("DECR", KEYS[1])

    return 0
  `;

  const result = await client.eval(script, {
    keys: [key],
    arguments: [String(hourlyLimit)],
  });

  const count = Number(result);

  if (count > 0) {
    console.log("Hourly capacity reserved:", {
      senderEmail,
      hourlyLimit,
      count,
      hourKey,
    });

    return {
      allowed: true,
      retryAt: null,
    };
  }

  /*
   * Current hour is full.
   * Schedule the email for the beginning of the next hour.
   */
  const nextHour = new Date(currentHour);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);

  console.log("Hourly limit reached:", {
    senderEmail,
    hourlyLimit,
    currentHour: currentHour.toISOString(),
    retryAt: nextHour.toISOString(),
  });

  return {
    allowed: false,
    retryAt: nextHour,
  };
}

/**
 * Reserve the next available sending slot for a sender.
 *
 * Redis makes this safe across multiple workers/instances.
 *
 * Example with a 2 second delay:
 *
 * Email 1 -> now
 * Email 2 -> now + 2 sec
 * Email 3 -> now + 4 sec
 */
export async function reserveSendSlot(
  senderEmail: string,
  delayMs: number
) {
  const client = await getRedisClient();

  const key = `email-delay:${senderEmail}`;

  const script = `
    local now = redis.call("TIME")

    local nowMs =
      (tonumber(now[1]) * 1000) +
      math.floor(tonumber(now[2]) / 1000)

    local previousSlot =
      tonumber(redis.call("GET", KEYS[1]) or "0")

    local slot = math.max(nowMs, previousSlot)

    local nextSlot =
      slot + tonumber(ARGV[1])

    redis.call(
      "SET",
      KEYS[1],
      nextSlot,
      "EX",
      86400
    )

    return math.max(0, slot - nowMs)
  `;

  const result = await client.eval(script, {
    keys: [key],
    arguments: [String(Math.max(0, delayMs))],
  });

  const waitMs = Math.max(0, Number(result));

  console.log("Sending slot reserved:", {
    senderEmail,
    delayMs,
    waitMs,
  });

  return waitMs;
}