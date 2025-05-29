import express from "express";
import {
    createCategory,
    deleteCategory,
    getAllCategories,
    getCategoryAdmin,
    getCategoryById,
    updateCategory,
} from "../controller/category.controller.js";
import { authIsAdminMiddleware, authIsManagerMiddleware } from "../middleware/authMiddlewares.js";
import validate from "../middleware/validate.js";
import categorySchemaJoi from "../validation/category.validation.js";

const router = express.Router();

router.get("/list", getAllCategories);
router.get("/list-admin", authIsManagerMiddleware, getCategoryAdmin);
router.get("/detail", authIsManagerMiddleware, getCategoryById);
router.post(
    "/create",
    validate(categorySchemaJoi),
    authIsManagerMiddleware,
    createCategory
);
router.put(
    "/update",
    validate(categorySchemaJoi),
    authIsManagerMiddleware,
    updateCategory
);
router.delete("/delete", authIsAdminMiddleware, deleteCategory);

export default router;
