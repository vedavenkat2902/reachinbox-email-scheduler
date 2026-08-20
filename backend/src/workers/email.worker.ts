import { Queue, Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import { sendEmail } from "../services/mail.service";
import {
  reserveHourlyCapacity,
  reserveSendSlot,
} from "../services/rate-limit.service";

const connection = {
  host: "localhost",
  port: 6379,
};

const emailQueue = new Queue("email-queue", {
  connection,
});

const concurrency = Number(
  process.env.WORKER_CONCURRENCY || 5
);

const defaultMinimumDelayMs =
  Number(process.env.MIN_EMAIL_DELAY_SECONDS || 2) * 1000;

async function waitForReservedSlot(waitMs: number) {
  if (waitMs <= 0) {
    return;
  }

  console.log(
    `Waiting ${waitMs}ms for the next sending slot`
  );

  await new Promise<void>((resolve) =>
    setTimeout(resolve, waitMs)
  );
}

/**
 * Recover scheduled emails after a backend restart.
 *
 * Rules:
 *
 * 1. Future email + valid future BullMQ job
 *    -> keep existing job.
 *
 * 2. Past-due email + old/non-retry delayed job
 *    -> remove old job and recreate with delay 0.
 *
 * 3. Retry job created because of hourly limit
 *    -> keep it if it is still scheduled for the future.
 *
 * 4. Missing BullMQ job
 *    -> recreate it.
 *
 * 5. SENT emails are never recreated because only
 *    SCHEDULED emails are queried.
 */
async function recoverScheduledEmails() {
  const scheduledEmails =
    await prisma.scheduledEmail.findMany({
      where: {
        status: "SCHEDULED",
      },
      include: {
        campaign: true,
      },
    });

  console.log(
    `Checking ${scheduledEmails.length} scheduled emails for recovery...`
  );

  for (const email of scheduledEmails) {
    try {
      const scheduledTime =
        new Date(email.scheduledAt).getTime();

      const isPastDue =
        scheduledTime <= Date.now();

      let existingJob = null;

      if (email.jobId) {
        existingJob = await emailQueue.getJob(
          email.jobId
        );
      }

      console.log("RECOVERY CHECK:", {
        emailId: email.id,
        jobId: email.jobId,
        jobExists: !!existingJob,
        scheduledAt: email.scheduledAt,
        isPastDue,
      });

      if (existingJob) {
        const state = await existingJob.getState();

        /*
         * BullMQ delayed jobs have:
         *
         * timestamp = job creation timestamp
         * delay     = delay in milliseconds
         *
         * Therefore:
         *
         * runAt = timestamp + delay
         */
        const jobRunAt =
          existingJob.timestamp +
          existingJob.delay;

        const jobIsDue =
          jobRunAt <= Date.now();

        const isRetryJob =
          String(existingJob.id).startsWith("retry-");

        console.log("BULLMQ JOB STATE:", {
          emailId: email.id,
          jobId: existingJob.id,
          state,
          jobTimestamp: existingJob.timestamp,
          jobDelay: existingJob.delay,
          jobRunAt: new Date(jobRunAt),
          jobIsDue,
          isRetryJob,
        });

        /*
         * ACTIVE:
         *
         * The worker is already processing it.
         * Never create another job.
         */
        if (state === "active") {
          continue;
        }

        /*
         * WAITING:
         *
         * BullMQ is ready to process the job.
         * Leave it alone.
         */
        if (state === "waiting") {
          continue;
        }

        /*
         * DELAYED:
         *
         * We need to determine whether the delayed job
         * is actually due.
         */

        if (state === "delayed") {
          /*
           * A retry job is intentionally scheduled for
           * a future time because the hourly limit was reached.
           *
           * Do NOT destroy that retry job simply because
           * the original scheduledAt is already in the past.
           */
          if (isRetryJob && !jobIsDue) {
            console.log(
              `Keeping future retry job ${existingJob.id} for email ${email.id}`
            );

            continue;
          }

          /*
           * If the delayed job itself is already due,
           * remove it and recreate it immediately.
           *
           * This fixes the past-due recovery problem.
           */
          if (jobIsDue) {
            try {
              await existingJob.remove();

              console.log(
                `Removed due delayed job ${existingJob.id} for email ${email.id}`
              );
            } catch (removeError) {
              console.error(
                `Failed to remove old job ${existingJob.id}:`,
                removeError
              );
            }
          } else {
            /*
             * Future delayed job.
             *
             * If the original scheduled time is still in
             * the future, this is exactly what we want.
             *
             * If it is a future retry, it was intentionally
             * rescheduled because of rate limiting.
             */
            console.log(
              `Keeping future delayed job ${existingJob.id} for email ${email.id}`
            );

            continue;
          }
        } else {
          /*
           * COMPLETED / FAILED / UNKNOWN
           *
           * The database still says SCHEDULED but the
           * BullMQ job is no longer usable.
           *
           * Remove it and recreate below.
           */
          console.log(
            `Job ${existingJob.id} is ${state}. Recreating it for email ${email.id}.`
          );

          try {
            await existingJob.remove();
          } catch {
            /*
             * The job may already have disappeared.
             */
          }
        }
      } else {
        console.log(
          `BullMQ job missing for scheduled email ${email.id}. Recreating it.`
        );
      }

      /*
       * Recreate the BullMQ job.
       *
       * Future email:
       *   delay = scheduledAt - now
       *
       * Past-due email:
       *   delay = 0
       */
      const delay = Math.max(
        0,
        scheduledTime - Date.now()
      );

      const job = await emailQueue.add(
        "send-email",
        {
          scheduledEmailId: email.id,
        },
        {
          delay,
          jobId: `recovered-${email.id}-${Date.now()}`,
        }
      );

      await prisma.scheduledEmail.update({
        where: {
          id: email.id,
        },
        data: {
          jobId: job.id,
          status: "SCHEDULED",
        },
      });

      console.log(
        `Recovered email ${email.id} with job ${job.id}. Delay: ${delay}ms`
      );
    } catch (error) {
      console.error(
        `Failed to recover email ${email.id}:`,
        error
      );
    }
  }
}

/**
 * Reschedule a job when the hourly sender limit is reached.
 */
async function rescheduleJob(
  scheduledEmailId: string,
  jobId: string,
  jobName: string,
  jobData: Record<string, unknown>,
  retryAt: Date
) {
  const delay = Math.max(
    1000,
    retryAt.getTime() - Date.now()
  );

  const retryJobId =
    `retry-${scheduledEmailId}-${retryAt.getTime()}`;

  /*
   * Avoid creating a duplicate retry job if one already
   * exists with the same ID.
   */
  const existingRetryJob =
    await emailQueue.getJob(retryJobId);

  if (existingRetryJob) {
    const existingState =
      await existingRetryJob.getState();

    console.log(
      `Retry job already exists: ${retryJobId}`,
      {
        state: existingState,
      }
    );

    await prisma.scheduledEmail.update({
      where: {
        id: scheduledEmailId,
      },
      data: {
        jobId: retryJobId,
        status: "SCHEDULED",
      },
    });

    return;
  }

  const newJob = await emailQueue.add(
    jobName,
    jobData,
    {
      delay,
      jobId: retryJobId,
    }
  );

  await prisma.scheduledEmail.update({
    where: {
      id: scheduledEmailId,
    },
    data: {
      jobId: newJob.id,
      status: "SCHEDULED",
    },
  });

  console.log(
    `Hourly limit reached. Job ${jobId} rescheduled as ${newJob.id} in ${Math.round(
      delay / 1000
    )} seconds`
  );
}

export async function startEmailWorker() {
  /*
   * Recover scheduled emails before starting the worker.
   */
  await recoverScheduledEmails();

  const worker = new Worker(
    "email-queue",
    async (job) => {
      console.log(
        "Processing email job:",
        job.id
      );

      const { scheduledEmailId } = job.data;

      if (!scheduledEmailId) {
        throw new Error(
          "scheduledEmailId is missing from job data"
        );
      }

      const scheduledEmail =
        await prisma.scheduledEmail.findUnique({
          where: {
            id: scheduledEmailId,
          },
          include: {
            campaign: true,
          },
        });

      if (!scheduledEmail) {
        throw new Error(
          "Scheduled email not found"
        );
      }

      /*
       * Idempotency:
       * Never send an email that has already been sent.
       */
      if (scheduledEmail.status === "SENT") {
        console.log(
          "Email already sent:",
          scheduledEmail.id
        );

        return;
      }

      /*
       * Mark email as actively processing.
       */
      await prisma.scheduledEmail.update({
        where: {
          id: scheduledEmail.id,
        },
        data: {
          status: "PROCESSING",
          errorMessage: null,
        },
      });

      try {
        /*
         * Reserve hourly capacity.
         */
        const rateLimit =
          await reserveHourlyCapacity(
            scheduledEmail.senderEmail,
            scheduledEmail.campaign.hourlyLimit
          );

        if (!rateLimit.allowed) {
          /*
           * Return the email to SCHEDULED because
           * it was not actually sent.
           */
          await prisma.scheduledEmail.update({
            where: {
              id: scheduledEmail.id,
            },
            data: {
              status: "SCHEDULED",
            },
          });

          await rescheduleJob(
            scheduledEmail.id,
            job.id!,
            job.name,
            job.data,
            rateLimit.retryAt!
          );

          return;
        }

        /*
         * Campaign-specific delay.
         *
         * If delaySeconds is 0, use the global minimum delay.
         */
        const campaignDelayMs =
          scheduledEmail.campaign.delaySeconds > 0
            ? scheduledEmail.campaign.delaySeconds * 1000
            : defaultMinimumDelayMs;

        /*
         * Reserve globally coordinated sending slot.
         */
        const waitMs = await reserveSendSlot(
          scheduledEmail.senderEmail,
          campaignDelayMs
        );

        await waitForReservedSlot(waitMs);

        /*
         * Send through Ethereal SMTP.
         */
        await sendEmail({
          senderEmail:
            scheduledEmail.senderEmail,
          recipient:
            scheduledEmail.recipient,
          subject:
            scheduledEmail.campaign.subject,
          body:
            scheduledEmail.campaign.body,
        });

        /*
         * Mark as successfully sent.
         */
        await prisma.scheduledEmail.update({
          where: {
            id: scheduledEmail.id,
          },
          data: {
            status: "SENT",
            sentAt: new Date(),
            errorMessage: null,
          },
        });

        console.log(
          "Email sent successfully:",
          scheduledEmail.recipient
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown email sending error";

        /*
         * Persist failure.
         */
        await prisma.scheduledEmail.update({
          where: {
            id: scheduledEmail.id,
          },
          data: {
            status: "FAILED",
            errorMessage,
          },
        });

        console.error(
          `Email sending failed for ${scheduledEmail.id}:`,
          errorMessage
        );

        /*
         * Tell BullMQ that the job failed.
         */
        throw error;
      }
    },
    {
      connection,
      concurrency,
    }
  );

  worker.on("completed", (job) => {
    console.log(
      `Email job ${job.id} completed`
    );
  });

  worker.on("failed", (job, error) => {
    console.error(
      `Email job ${job?.id} failed:`,
      error.message
    );
  });

  worker.on("error", (error) => {
    console.error(
      "Email worker error:",
      error
    );
  });

  console.log(
    `Email worker started with concurrency=${concurrency}, minimumDelay=${defaultMinimumDelayMs}ms`
  );

  return worker;
}