import { ErrorCustom } from "../helper/ErrorCustom.js";
import {
    getAllReviewsByProductIdService,
    getAttributeByIdService,
    getAttributesByProductAndSize,
    getReviewByOrderDetailIdService,
    reviewAttributeService,
} from "../service/attribute.service.js";
import {
    errorResponse400,
    errorResponse500,
    successResponse,
    successResponseList,
} from "../utils/responseHandler.js";

export const getAttribute = async (req, res) => {
    try {
        const attributes = await getAttributesByProductAndSize(req.query);
        return successResponse(
            res,
            "Lấy danh sách thuộc tính thành công!",
            attributes
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getAttributeById = async (req, res) => {
    try {
        const { id } = req.params;
        const attribute = await getAttributeByIdService(id);
        return successResponse(res, "", attribute);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const reviewAttribute = async (req, res) => {
    try {
        const userId = req.user._id;
        const reviewData = { ...req.body, userId };
        await reviewAttributeService(reviewData);
        return successResponse(res, "Đánh giá sản phẩm thành công!", true);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getAllReviewAttributeByProductId = async (req, res) => {
    try {
        const { productId, page, size } = req.query;

        const { reviews, pagination } = await getAllReviewsByProductIdService(
            productId,
            page,
            size
        );

        return successResponseList(res, "", reviews, pagination);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getReviewAttributeByOrderDetailId = async (req, res) => {
    try {
        const { orderDetailId } = req.query;
        const review = await getReviewByOrderDetailIdService(orderDetailId);

        if (!review) {
            return successResponse(res, "", null);
        }
        return successResponse(res, "", review);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};
