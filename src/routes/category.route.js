import express from "express";
import {
    createCategory,
    deleteCategory,
    getAllCategories,
    getCategoryAdmin,
    getCategoryById,
    updateCategory,
} from "../controller/category.controller.js";
import {
    authIsAdminMiddleware,
    authIsManagerMiddleware,
} from "../middleware/authMiddlewares.js";

const router = express.Router();

router.get("/list", getAllCategories);
router.get("/list-admin", authIsManagerMiddleware, getCategoryAdmin);
router.get("/detail", authIsManagerMiddleware, getCategoryById);
router.post("/create", authIsManagerMiddleware, createCategory);
router.put("/update", authIsManagerMiddleware, updateCategory);
router.delete("/delete/:id", authIsAdminMiddleware, deleteCategory);

export default router;
