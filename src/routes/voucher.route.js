import express from "express";
import {
    createVoucher,
    deleteVoucher,
    getAllVouchers,
    getAllVouchersAdmin,
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

router.get("/list-admin", authIsManagerMiddleware, getAllVouchersAdmin);
router.get("/list", getAllVouchers);
router.get("/detail", authIsManagerMiddleware, getVoucherById);
router.get("/by-code", authMiddleware, getVoucherByCode);
router.post("/create", authIsManagerMiddleware, createVoucher);
router.put("/update", authIsManagerMiddleware, updateVoucher);
router.delete("/delete/:id", authIsAdminMiddleware, deleteVoucher);

export default router;
