import { Router } from "express";
import {
  createScheduledEmail,
  getScheduledEmailsByCampaign,
} from "../services/email.service";
import { prisma } from "../lib/prisma";
import { emailQueue } from "../lib/queue";

const router = Router();

// Add a scheduled email to a campaign
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const {
      campaignId,
      recipient,
      senderEmail,
      scheduledAt,
    } = req.body;

    if (
      typeof campaignId !== "string" ||
      typeof recipient !== "string" ||
      typeof senderEmail !== "string" ||
      !scheduledAt
    ) {
      return res.status(400).json({
        error:
          "campaignId, recipient, senderEmail and scheduledAt are required",
      });
    }

    // Make sure the campaign belongs to the logged-in user
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.user.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        error: "Campaign not found",
      });
    }

    const parsedScheduledAt = new Date(scheduledAt);

    if (Number.isNaN(parsedScheduledAt.getTime())) {
      return res.status(400).json({
        error: "Invalid scheduledAt",
      });
    }

    const email = await createScheduledEmail({
      campaignId,
      recipient: recipient.trim(),
      senderEmail: senderEmail.trim(),
      scheduledAt: parsedScheduledAt,
    });

    // Create BullMQ delayed job
    const job = await emailQueue.add(
      "send-email",
      {
        scheduledEmailId: email.id,
      },
      {
        delay: Math.max(
          0,
          parsedScheduledAt.getTime() - Date.now()
        ),

        // Deterministic job ID for idempotency
        jobId: email.id,
      }
    );

    // Store BullMQ job ID for persistence/idempotency
    const updatedEmail = await prisma.scheduledEmail.update({
      where: {
        id: email.id,
      },
      data: {
        jobId: job.id,
      },
    });

    return res.status(201).json({
      email: updatedEmail,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to create scheduled email",
    });
  }
});

// Get scheduled emails for a campaign
router.get("/:campaignId", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const { campaignId } = req.params;

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.user.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        error: "Campaign not found",
      });
    }

    const emails = await getScheduledEmailsByCampaign(campaignId);

    return res.json({
      emails,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch scheduled emails",
    });
  }
});

export default router;