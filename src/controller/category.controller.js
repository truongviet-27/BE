import aqp from "api-query-params";
import Category from "../model/category.js";
import {
    errorResponse400,
    errorResponse500,
    successResponse,
    successResponseList,
} from "../utils/responseHandler.js";
import validateMongoDbId from "../utils/validateMongodbId.js";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import { createCategoryService, deleteCategoryService, getAllCategoriesService, getCategoryAdminService, getCategoryByIdService, updateCategoryService } from "../service/category.service.js";

export const getAllCategories = async (req, res) => {
    try {
        const { categories, pagination } = await getAllCategoriesService(req.query);
        return successResponseList(
            res,
            "Lấy danh sách danh mục thành công!",
            categories,
            pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getCategoryAdmin = async (req, res) => {
    try {
        const { categories, pagination } = await getCategoryAdminService(req.query);

        return successResponseList(
            res,
            "Lấy danh sách danh mục thành công!",
            categories,
            pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getCategoryById = async (req, res) => {
    try {
        const { id } = req.query;
        const category = await getCategoryByIdService(id);

        if (!category) {
            return successResponse(res, "Không tìm thấy danh mục");
        }

        return successResponse(res, "Lấy danh mục thành công!", category);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const createCategory = async (req, res) => {
    try {
        const newCategory = await createCategoryService(req.body);
        return res.status(200).json({ success: true, data: newCategory });
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};


export const updateCategory = async (req, res) => {
    try {
        const updatedCategory = await updateCategoryService(req.body);

        if (!updatedCategory) {
            return successResponse(res, "Không tìm thấy danh mục");
        }

        return res.json({ success: true, data: updatedCategory });
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await deleteCategoryService(id);

        return successResponse(res, result.message, result.success);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};
