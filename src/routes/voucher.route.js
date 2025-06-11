import express from "express";
import {
    createVoucher,
    deleteVoucher,
    getAllVouchers,
    getVoucherByCode,
    getVoucherById,
    updateVoucher,
} from "../controller/voucher.controller.js";
import {
    authIsAdminMiddleware,
    authIsManagerMiddleware,
    authMiddleware,
} from "../middleware/authMiddlewares.js";

const router = express.Router();

router.get("/list", authIsManagerMiddleware, getAllVouchers);
router.get("/detail", authIsManagerMiddleware, getVoucherById);
router.get("/by-code", authMiddleware, getVoucherByCode);
router.post("/create", authIsManagerMiddleware, createVoucher);
router.put("/update", authIsManagerMiddleware, updateVoucher);
router.delete("/delete/:id", authIsAdminMiddleware, deleteVoucher);

export default router;
