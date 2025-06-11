import express from "express";
import {
    createBrand,
    deleteBrand,
    getAllBrand,
    getAllBrandAdmin,
    getBrandById,
    updateBrand,
} from "../controller/brand.controller.js";
import {
    authIsAdminMiddleware,
    authIsManagerMiddleware,
} from "../middleware/authMiddlewares.js";

const router = express.Router();

router.get("/list", getAllBrand);
router.get("/list-admin", authIsManagerMiddleware, getAllBrandAdmin);
router.get("/detail", authIsManagerMiddleware, getBrandById);
router.post("/create", authIsManagerMiddleware, createBrand);
router.put("/update", authIsManagerMiddleware, updateBrand);
router.delete("/delete/:id", authIsAdminMiddleware, deleteBrand);

export default router;
