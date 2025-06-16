import express from "express";
import {
    changePassword,
    forgotPassword,
    handleRefreshToken,
    loginUser,
    logout,
    resetPassword,
    sendOtpResetPassword,
    verifyOtp,
} from "../controller/auth.controller.js";
import {
    countAccount,
    createAccount,
    createUser,
    deleteUserById,
    getAccountByRole,
    getAllUser,
    getUserById,
    getUserDetail,
    updateAccountByRoleAdmin,
    updateUserById,
} from "../controller/user.controller.js";
import {
    authIsAdminMiddleware,
    authIsManagerMiddleware,
    authMiddleware,
} from "../middleware/authMiddlewares.js";

const router = express.Router();

router.post("/create", createUser);
router.get("/admin/account/find-all", authIsManagerMiddleware, getAllUser);
router.post("/admin/create", authIsAdminMiddleware, createAccount);
// router.get("/admin/total-page", authIsManagerMiddleware, getTotalPage);
router.get("/admin/count", authIsManagerMiddleware, countAccount);

router.get("/:id", authMiddleware, getUserById);
router.get("/admin/:id", authMiddleware, getUserById);
router.delete("/delete/:id", authIsAdminMiddleware, deleteUserById);

router.put("/admin/update-profile", authIsAdminMiddleware, updateAccountByRoleAdmin);
router.put("/update-profile", authMiddleware, updateUserById);
router.get("/admin/account/by-role", authIsAdminMiddleware, getAccountByRole);

router.get("/detail", authMiddleware, getUserDetail);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password", resetPassword);
router.post("/refresh-token", handleRefreshToken);
router.put("/change-password", changePassword);
// router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/send-otp-reset", sendOtpResetPassword);

export default router;
