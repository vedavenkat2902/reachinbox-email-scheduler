import { Router } from "express";
import { createCampaign } from "../services/campaign.service";
import { getCampaignsByUser } from "../services/campaign.service";
const router = Router();

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const {
      subject,
      body,
      startTime,
      delaySeconds,
      hourlyLimit,
    } = req.body;

    if (
      typeof subject !== "string" ||
      typeof body !== "string" ||
      !subject.trim() ||
      !body.trim()
    ) {
      return res.status(400).json({
        error: "Subject and body are required",
      });
    }

    const parsedStartTime = new Date(startTime);
    const parsedDelay = Number(delaySeconds);
    const parsedHourlyLimit = Number(hourlyLimit);

    if (Number.isNaN(parsedStartTime.getTime())) {
      return res.status(400).json({
        error: "Invalid startTime",
      });
    }

    if (!Number.isInteger(parsedDelay) || parsedDelay < 0) {
      return res.status(400).json({
        error: "delaySeconds must be a non-negative integer",
      });
    }

    if (!Number.isInteger(parsedHourlyLimit) || parsedHourlyLimit <= 0) {
      return res.status(400).json({
        error: "hourlyLimit must be a positive integer",
      });
    }

    const campaign = await createCampaign({
      userId: req.user.id,
      subject: subject.trim(),
      body: body.trim(),
      startTime: parsedStartTime,
      delaySeconds: parsedDelay,
      hourlyLimit: parsedHourlyLimit,
    });

    return res.status(201).json({
      campaign,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to create campaign",
    });
  }
});

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const campaigns = await getCampaignsByUser(req.user.id);

    return res.json({
      campaigns,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch campaigns",
    });
  }
});

export default router;