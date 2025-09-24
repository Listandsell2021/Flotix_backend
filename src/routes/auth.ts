import { Router } from "express";
import {
  authenticate,
  generateTokens,
  verifyRefreshToken,
  validate,
  loginSchema,
  refreshTokenSchema,
  asyncHandler,
  auditLog,
  getClientIP,
} from "../middleware";
import { User, AuditLog } from "../models";
import { AuditAction, AuditModule, AuditStatus } from "@fleetflow/types";
import type {
  LoginRequest,
  LoginResponse,
  ApiResponse,
  AuthTokens,
  JWTPayload,
} from "@fleetflow/types";

const router = Router();

// POST /api/auth/login
router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password }: LoginRequest = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordHash"
    );
    console.log("Login attempt for email:", email, "User found:", !!user);
    if (!user || user.status !== "ACTIVE") {
      // Log failed login attempt (only if user exists but inactive)
      if (user && user.status !== "ACTIVE") {
        try {
          await AuditLog.create({
            timestamp: new Date(),
            userId: user._id,
            role: user.role,
            companyId: user.companyId,
            action: AuditAction.LOGIN,
            module: AuditModule.AUTH,
            referenceIds: {
              email: email.toLowerCase(),
            },
            status: AuditStatus.FAILED,
            details: `Failed login attempt: ${email.toLowerCase()} - Account inactive`,
            ipAddress: getClientIP(req),
            userAgent: req.headers["user-agent"],
          });
        } catch (error) {
          console.error("Failed login audit logging failed:", error);
        }
      }

      return res.status(401).json({
        success: false,
        message: "Invalid credentials or account inactive",
      } as ApiResponse);
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Log failed password attempt
      try {
        await AuditLog.create({
          timestamp: new Date(),
          userId: user._id,
          role: user.role,
          companyId: user.companyId,
          action: AuditAction.LOGIN,
          module: AuditModule.AUTH,
          referenceIds: {
            email: user.email,
          },
          status: AuditStatus.FAILED,
          details: `Failed login attempt: ${user.email} - Invalid password`,
          ipAddress: getClientIP(req),
          userAgent: req.headers["user-agent"],
        });
      } catch (error) {
        console.error("Failed password audit logging failed:", error);
      }

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      } as ApiResponse);
    }

    // Generate tokens
    const tokenPayload: JWTPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId?.toString(),
    };

    const tokens = generateTokens(tokenPayload);

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Log successful login
    try {
      await AuditLog.create({
        timestamp: new Date(),
        userId: user._id,
        role: user.role,
        companyId: user.companyId,
        action: AuditAction.LOGIN,
        module: AuditModule.AUTH,
        referenceIds: {
          email: user.email,
        },
        status: AuditStatus.SUCCESS,
        details: `User login: ${user.email}`,
        ipAddress: getClientIP(req),
        userAgent: req.headers["user-agent"],
      });
    } catch (error) {
      console.error("Login audit logging failed:", error);
    }

    // Return user data without password
    const userData = user.toObject();
    delete userData.passwordHash;

    const response: LoginResponse = {
      user: userData,
      tokens,
    };

    res.json({
      success: true,
      data: response,
      message: "Login successful",
    } as ApiResponse<LoginResponse>);
  })
);

// POST /api/auth/refresh
router.post(
  "/refresh",
  validate(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Check if user still exists and is active
      const user = await User.findById(decoded.userId);
      if (!user || user.status !== "ACTIVE") {
        return res.status(401).json({
          success: false,
          message: "User not found or inactive",
        } as ApiResponse);
      }

      // Generate new tokens
      const tokenPayload: JWTPayload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        companyId: user.companyId?.toString(),
      };

      const tokens = generateTokens(tokenPayload);

      // Update last active
      user.lastActive = new Date();
      await user.save();

      const response: AuthTokens = tokens;

      res.json({
        success: true,
        data: response,
        message: "Token refreshed successfully",
      } as ApiResponse<AuthTokens>);
    } catch (error) {
      res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      } as ApiResponse);
    }
  })
);

// GET /api/auth/me
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req: any, res) => {
    const user = await User.findById(req.user.userId).populate(
      "companyId",
      "name plan status"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: user,
      message: "User data retrieved successfully",
    } as ApiResponse);
  })
);

// POST /api/auth/logout
router.post(
  "/logout",
  authenticate,
  auditLog({
    action: AuditAction.LOGOUT,
    module: AuditModule.AUTH,
    getReferenceIds: (req) => ({
      userId: req.user?.userId,
    }),
    getDetails: (req) => `User logout: ${req.user?.email}`,
  }),
  asyncHandler(async (req, res) => {
    // In a more sophisticated setup, you might maintain a blacklist of tokens
    // For now, we'll just return success since JWT tokens are stateless
    res.json({
      success: true,
      message: "Logged out successfully",
    } as ApiResponse);
  })
);

export { router as authRoutes };
