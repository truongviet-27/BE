import express from "express";
import multer from "multer";
import {
    countProduct,
    createProduct,
    deleteProduct,
    filterProducts,
    getAllProduct,
    getAllProductByBrand,
    getAllProductWishList,
    getListHot,
    getProductById,
    getRecommendationById,
    relateProduct,
    searchByKeyword,
    toggleLikeProduct,
    updateProduct,
} from "../controller/product.controller.js";
import {
    authIsAdminMiddleware,
    authIsManagerMiddleware,
    authMiddleware,
} from "../middleware/authMiddlewares.js";

const upload = multer();

const router = express.Router();

router.get("/get-all", getAllProduct);
router.get("/wish-list", authMiddleware, getAllProductWishList);
router.put("/like", authMiddleware, toggleLikeProduct);
router.post("/get-all/filter", filterProducts);
router.get("/by-brand", authIsManagerMiddleware, getAllProductByBrand);
router.get("/relate", relateProduct);
router.get("/recommendation", getRecommendationById);
router.get("/list/hot", getListHot);
router.get("/search", searchByKeyword);
router.get("/count", authIsManagerMiddleware, countProduct);
router.post(
    "/create",
    // validate(productSchemaJoi),
    authIsManagerMiddleware,
    createProduct
);
router.put(
    "/modify",
    // validate(productSchemaJoi),
    authIsManagerMiddleware,
    updateProduct
);
router.delete("/delete/:id", authIsAdminMiddleware, deleteProduct);
router.get("/:id", getProductById);

export default router;
