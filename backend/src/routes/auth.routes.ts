import { Router } from "express";

import passport from "../config/passport";

const router = Router();

// Start Google OAuth
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
);

// Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
  }),
  (_req, res) => {
  return res.redirect("http://localhost:5173/");
}
  
);

// Get currently authenticated user
router.get("/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      authenticated: false,
    });
  }

  return res.json({
    authenticated: true,
    user: req.user,
  });
});

// Log out the current user
router.post("/logout", (req, res) => {
  req.logout((logoutError) => {
    if (logoutError) {
      console.error("Logout error:", logoutError);
      return res.status(500).json({ error: "Failed to log out" });
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        console.error("Session destroy error:", sessionError);
        return res.status(500).json({ error: "Failed to clear session" });
      }

      res.clearCookie("connect.sid");

      return res.json({
        message: "Logged out successfully",
      });
    });
  });
});

export default router;