import { ErrorCustom } from "../helper/ErrorCustom.js";
import OrderStatus from "../model/orderStatus.js";
import { createOrderStatusService, deleteOrderStatusService, getAllOrderStatusService, getOrderStatusByIdService, updateOrderStatusService } from "../service/orderStatus.service.js";
import validateMongoDbId from "../utils/validateMongodbId";

export const getAllOrderStatus = async (req, res) => {
    try {
        const orderStatus = await getAllOrderStatusService();
        return successResponse(
            res,
            "Lấy danh sách trạng thái đơn hàng thành công!",
            orderStatus
        );
    } catch (error) {
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getOrderStatusById = async (req, res) => {
    try {
        const { id } = req.params;
        const orderStatus = await getOrderStatusByIdService(id);
        return successResponse(
            res,
            "Lấy trạng thái đơn hàng thành công!",
            orderStatus
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const createOrderStatus = async (req, res) => {
    try {
        const newOrderStatus = await createOrderStatusService(req.body);
        return successResponse(
            res,
            "Tạo trạng thái đơn hàng thành công!",
            newOrderStatus
        );
    } catch (error) {
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await updateOrderStatusService(id, req.body);

        return successResponse(
            res,
            "Cập nhật trạng thái đơn hàng thành công!",
            updated
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const deleteOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await deleteOrderStatusService(id);

        if (!result.success) {
            return notFoundResponse(res, result.message, null, 404);
        }

        return successResponse(res, result.message, true);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};
