import aqp from "api-query-params";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import Attribute from "../model/attribute.js";
import Image from "../model/image.js";
import Product from "../model/product.js";
import Product_Category from "../model/product_category.js";
import ProductUserLike from "../model/product_user_like.js";
import getRecommendationsService from "../service/recomendation.service.js";
import {
    errorResponse400,
    errorResponse500,
    notFoundResponse,
    successResponse,
    successResponseList,
} from "../utils/responseHandler.js";
import validateMongoDbId from "../utils/validateMongodbId.js";
import { countProductService, createProductService, deleteProductService, filterProductsService, getAllProductByBrandService, getAllProductService, getAvgReviewProductService, getProductDetailService, getRelatedProductsService, getWishlistProductsService, searchByKeywordService, toggleProductLikeService, updateProductService } from "../service/product.service.js";

export const getAllProduct = async (req, res) => {
    try {
        const result = await getAllProductService(req.query);
        return successResponseList(res, "Lấy danh sách sản phẩm thành công!", result.data, result.meta);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};


export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        validateMongoDbId(id);

        const product = await getProductDetailService(id);

        if (!product || product.deletedAt) {
            return successResponse(res, "Không tìm thấy sản phẩm");
        }

        return successResponse(res, "Lấy sản phẩm thành công!", product);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const createProduct = async (req, res) => {
    try {
        const result = await createProductService(req.body);
        return successResponse(res, "Tạo sản phẩm thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const updateProduct = async (req, res) => {
    try {
        const result = await updateProductService(req.body);
        return successResponse(res, "Chỉnh sửa sản phẩm thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await deleteProductService(id);

        if (!result) {
            return notFoundResponse(res, "Không tìm thấy sản phẩm", false);
        }

        return successResponse(res, "Sản phẩm đã được xóa", true);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getAllProductByBrand = async (req, res) => {
    try {
        const data = await getAllProductByBrandService(req.query);
        return successResponseList(
            res,
            "Lấy danh sách sản phẩm thành công!",
            data.result,
            data.pagination
        );
    } catch (error) {
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const countProduct = async (req, res) => {
    try {
        const count = await countProductService();
        return successResponse(res, "Lấy số lượng sản phẩm thành công!", count);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const searchByKeyword = async (req, res) => {
    try {
        const { result, pagination } = await searchByKeywordService(req.query);
        return successResponseList(
            res,
            "Lấy danh sách sản phẩm thành công!",
            result,
            pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getListHot = async (req, res) => {};

export const getRecommendationById = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const { productId = req.params.productId, page = 0, size = 5 } = filter;

        validateMongoDbId(productId);

        const result = await getRecommendationsService(
            productId,
            parseInt(page),
            parseInt(size)
        );
        return successResponseList(res, "", result.data, result.pagination);
    } catch (error) {
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const relateProduct = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const {
            page,
            size,
            isActive = true,
            brandId,
            categoryId,
            id,
            userId,
        } = filter;

        const { products, pagination } = await getRelatedProductsService({
            page,
            size,
            isActive,
            brandId,
            categoryId,
            id,
            userId,
        });

        return successResponseList(
            res,
            "Lấy danh sách sản phẩm thành công!",
            products,
            pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const toggleLikeProduct = async (req, res) => {
    const userId = req.user._id;
    const { productId } = req.query;

    try {
        const liked = await toggleProductLikeService(userId, productId);

        return successResponse(
            res,
            liked
                ? "Yêu thích sản phẩm thành công!"
                : "Bỏ yêu thích sản phẩm thành công!"
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getAllProductWishList = async (req, res) => {
    try {
        const userId = req.user._id;
        const { filter } = aqp(req.query);

        const { products, pagination } = await getWishlistProductsService(userId, filter);

        return successResponseList(res, "Lấy danh sách sản phẩm thành công!", products, pagination);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const filterProducts = async (req, res) => {
    try {
        const products = await filterProductsService(req.body);

        return successResponseList(res, "Lọc danh sách thành công!", products);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};


export const getAvgReviewProduct = async (req, res) => {
    try {
        const result = await getAvgReviewProductService();
        return successResponse(res, "Lấy đánh giá trung bình sản phẩm thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};
