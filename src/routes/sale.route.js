import express from "express";
import {
    createSale,
    deleteSale,
    getAllSale,
    getAllSaleAdmin,
    getSaleById,
    updateSale,
} from "../controller/sale.controller.js";
import { authIsAdminMiddleware, authIsManagerMiddleware } from "../middleware/authMiddlewares.js";

const router = express.Router();

router.get("/list", authIsManagerMiddleware, getAllSale);
router.get("/list-admin", authIsManagerMiddleware, getAllSaleAdmin);

router.get("/detail", authIsManagerMiddleware, getSaleById);
router.post("/create", authIsManagerMiddleware, createSale);
router.put("/update", authIsManagerMiddleware, updateSale);
router.delete("/delete", authIsAdminMiddleware, deleteSale);

export default router;
