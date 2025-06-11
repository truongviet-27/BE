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

const getAllBrand = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const { page, size, isActive } = filter;
        const condition = {
            isActive: true,
        };
        const [brands, total] = await Promise.all([
            Brand.aggregate([
                {
                    $match: condition,
                },
                {
                    $skip: page * size,
                },
                {
                    $limit: size,
                },
            ]),
            Brand.countDocuments({ isActive: true }),
        ]);

        return successResponseList(
            res,
            "Lấy danh sách thương hiệu thành công!",
            brands,
            {
                total,
                page: page,
                size: size,
                totalPages: Math.ceil(total / size),
            }
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
        validateMongoDbId(id);
        const brand = await Brand.findById(id).select(
            "-updatedAt -__v -createdAt"
        );
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
        const brand = await Brand.create({
            name,
            description,
        });
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
        const { _id } = req.body;
        validateMongoDbId(_id);
        const brand = await Brand.findByIdAndUpdate(
            _id,
            {
                ...req.body,
            },
            { new: true }
        );
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
        validateMongoDbId(id);
        const brand = await Brand.findByIdAndDelete({
            _id: id,
        });
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
        const { filter } = aqp(req.query);
        const { page, size } = filter;
        const { query, search } = req.query;

        let matchFilter = {};
        let sort = { createdAt: -1 };

        if (query) {
            let [key, value] = query.split("-");

            if (key === "name") {
                sort = { name: value === "asc" ? 1 : -1 };
            } else {
                if (key && value) {
                    matchFilter[key] = value === "true" ? true : false;
                }
            }
        }

        if (search) {
            matchFilter["$or"] = [{ name: { $regex: search, $options: "i" } }];
        }

        const [brands, total] = await Promise.all([
            Brand.aggregate([
                {
                    $match: matchFilter,
                },
                { $sort: sort },
                {
                    $skip: page * size,
                },
                {
                    $limit: size,
                },
            ]),
            Brand.countDocuments(matchFilter),
        ]);

        return successResponseList(
            res,
            "Lấy danh sách thương hiệu thành công!",
            brands,
            {
                total,
                page: page,
                size: size,
                totalPages: Math.ceil(total / size),
            }
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
