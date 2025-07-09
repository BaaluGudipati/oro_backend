import express from "express";
import Url from "../models/Url.js";
import generateShortCode from "../utils/generateShortCode.js";
import { validateUrl } from "../middleware/validation.js";
import {
  createShortUrlLimiter,
  redirectLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();

router.post(
  "/shorten",
  createShortUrlLimiter,
  validateUrl,
  async (req, res) => {
    try {
      const { url, expiresIn } = req.body;

      const existingUrl = await Url.findOne({ originalUrl: url });
      if (existingUrl) {
        return res.json({
          shortUrl: `${process.env.BASE_URL}/${existingUrl.shortCode}`,
          originalUrl: existingUrl.originalUrl,
          createdAt: existingUrl.createdAt,
        });
      }

      let shortCode;
      let isUnique = false;
      while (!isUnique) {
        shortCode = generateShortCode();
        const existingCode = await Url.findOne({ shortCode });
        if (!existingCode) {
          isUnique = true;
        }
      }

      const newUrl = new Url({
        originalUrl: url,
        shortCode,
        expiresAt: expiresIn
          ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
          : null,
      });

      await newUrl.save();

      res.status(201).json({
        shortUrl: `${process.env.BASE_URL}/${shortCode}`,
        originalUrl: url,
        createdAt: newUrl.createdAt,
        expiresAt: newUrl.expiresAt,
      });
    } catch (error) {
      console.error("Error creating short URL:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to create short URL",
      });
    }
  }
);

router.get("/:code", redirectLimiter, async (req, res) => {
  try {
    const { code } = req.params;

    const url = await Url.findOne({
      shortCode: code,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });

    if (!url) {
      return res.status(404).json({
        error: "Not found",
        message: "Short URL not found or expired",
      });
    }

    url.clicks += 1;
    await url.save();

    res.json({
      message: "Short URL resolved successfully",
      redirectTo: url.originalUrl,
      clicks: url.clicks,
    });
  } catch (error) {
    console.error("Error redirecting:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to redirect",
    });
  }
});

router.get("/:code/stats", async (req, res) => {
  try {
    const { code } = req.params;

    const url = await Url.findOne({ shortCode: code });

    if (!url) {
      return res.status(404).json({
        error: "Not found",
        message: "Short URL not found",
      });
    }

    res.json({
      originalUrl: url.originalUrl,
      shortUrl: `${process.env.BASE_URL}/${url.shortCode}`,
      clicks: url.clicks,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get URL statistics",
    });
  }
});

export default router;
