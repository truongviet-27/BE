import aqp from "api-query-params";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import Brand from "../model/brand.js";
import {
    errorResponse400,
    errorResponse500,
    successResponse,
    successResponseList,
} from "../utils/responseHandler.js";
import validateMongoDbId from "../utils/validateMongodbId.js";
import { createBrandService, deleteBrandService, getAllBrandAdminService, getAllBrandsService, getBrandByIdService, updateBrandService } from "../service/brand.service.js";

const getAllBrand = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const { page = 0, size = 10 } = filter;

        const { brands, pagination } = await getAllBrandsService({ page, size });

        return successResponseList(
            res,
            "Lấy danh sách thương hiệu thành công!",
            brands,
            pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getBrandById = async (req, res) => {
    try {
        const { id } = req.query;
        const brand = await getBrandByIdService(id);

        if (!brand) {
            return notFoundResponse(
                res,
                "Không tìm thấy thương hiệu",
                null,
                404
            );
        }

        return successResponse(res, "Lấy thương hiệu thành công!", brand);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const createBrand = async (req, res) => {
    try {
        const { name, description } = req.body;
        const brand = await createBrandService({ name, description });

        return successResponse(res, "Thêm thương hiệu thành công!", brand);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateBrand = async (req, res) => {
    try {
        const brand = await updateBrandService(req.body);

        if (!brand) {
            return notFoundResponse(
                res,
                "Không tìm thấy thương hiệu",
                null,
                404
            );
        }

        return successResponse(res, "Cập nhật thương hiệu thành công!", brand);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const brand = await deleteBrandService(id);

        if (!brand) {
            return notFoundResponse(
                res,
                "Không tìm thấy thương hiệu",
                null,
                404
            );
        }

        return successResponse(res, "Xóa thương hiệu thành công!", true);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getAllBrandAdmin = async (req, res) => {
    try {
        const { brands, pagination } = await getAllBrandAdminService(req.query);

        return successResponseList(
            res,
            "Lấy danh sách thương hiệu thành công!",
            brands,
            pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export {
    getAllBrand,
    getBrandById,
    createBrand,
    updateBrand,
    deleteBrand,
    getAllBrandAdmin,
};
