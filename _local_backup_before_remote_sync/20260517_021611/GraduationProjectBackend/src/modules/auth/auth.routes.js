import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { auth } from "../../middlewares/auth.middleware.js";

import {
  loginSchema,
  registerSchema,
  sendVerificationSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema,
  oauthCompleteSchema,
  changePasswordSchema,
  setupTwoFactorSchema,
  confirmTwoFactorSchema,
  disableTwoFactorSchema,
  verifyTwoFactorLoginSchema,
} from "./auth.schema.js";

import {
  login,
  me,
  register,
  sendVerification,
  verifyEmail,
  googleAuth,
  googleCallback,
  githubAuth,
  githubCallback,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  oauthComplete,
  changePassword,
  setupTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
  verifyTwoFactorLogin,
} from "./auth.controller.js";
import {
  registerLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  otpLimiter,
  oauthCompleteLimiter,
} from "../../middlewares/rateLimit.middleware.js";

const router = Router();

// local auth
// local auth
router.post("/register", registerLimiter, validate(registerSchema), register);
router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/2fa/login", otpLimiter, validate(verifyTwoFactorLoginSchema), verifyTwoFactorLogin);
router.get("/me", auth, me);
router.post("/change-password", auth, validate(changePasswordSchema), changePassword);
router.post("/2fa/setup", auth, validate(setupTwoFactorSchema), setupTwoFactor);
router.post("/2fa/confirm", auth, validate(confirmTwoFactorSchema), confirmTwoFactor);
router.post("/2fa/disable", auth, validate(disableTwoFactorSchema), disableTwoFactor);

router.post("/send-verification", otpLimiter, validate(sendVerificationSchema), sendVerification);
router.post("/verify-email", otpLimiter, validate(verifyEmailSchema), verifyEmail);

// password reset
router.post("/forgot-password", forgotPasswordLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/verify-reset-code", otpLimiter, validate(verifyResetCodeSchema), verifyResetCode);
router.post("/reset-password", otpLimiter, validate(resetPasswordSchema), resetPassword);

// oauth complete (needs auth + validate)
router.post("/oauth-complete", oauthCompleteLimiter, auth, validate(oauthCompleteSchema), oauthComplete);


// oauth routes (no validate)
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

router.get("/github", githubAuth);
router.get("/github/callback", githubCallback);

export default router;
