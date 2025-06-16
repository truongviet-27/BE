import aqp from "api-query-params";
import mongoose from "mongoose";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import Attribute from "../model/attribute.js";
import CartItem from "../model/cartItem.js";
import Order from "../model/order.js";
import OrderDetail from "../model/orderDetail.js";
import OrderStatus from "../model/orderStatus.js";
import generateOrderCode from "../utils/generateOrderCode.js";
import {
    errorResponse400,
    errorResponse500,
    successResponse,
    successResponseList,
} from "../utils/responseHandler.js";
import {
    amountYearService,
    cancelOrderService,
    cancelOrderService2,
    countOrderByCategoryNameService,
    countOrderService,
    createOrderService,
    getAllOrderService,
    getAllOrderStatusService,
    getAllOrdersWithPagination,
    getOrderByIdService,
    getOrderByOrderYearAndMonthService,
    getOrderDetailByOrderIdService,
    getOrdersByProductService,
    getOrdersByStatusAndDateService,
    reportAmountYearService,
    reportByProductByYearService,
    reportByProductService,
    reportRevenueByMonthService,
    updateOrderRefundService,
    updateOrderReturnService,
    updateOrderShipmentService,
    updateOrderStatusService,
    updateOrderSuccessService,
} from "../service/order.service.js";
import validateMongoDbId from "../utils/validateMongodbId.js";

const createOrder = async (req, res) => {
    try {
        const user = req.user;
        const body = req.body;

        const newOrder = await createOrderService(user, body);

        return successResponse(res, "Tạo đơn hàng thành công!", newOrder);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getOrderById = async (req, res) => {
    try {
        const { id } = req.query;

        const order = await getOrderByIdService(id);

        if (!order) {
            return errorResponse400(res, "Không tìm thấy đơn hàng");
        }

        return successResponse(res, "Lấy đơn hàng thành công", order);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getOrderDetailByOrderId = async (req, res) => {
    try {
        const { orderId } = req.query;
        const orderDetail = await getOrderDetailByOrderIdService(orderId);

        if (!orderDetail || orderDetail.length === 0) {
            return errorResponse400(res, "Không tìm thấy chi tiết đơn hàng");
        }

        return successResponseList(
            res,
            "Lấy chi tiết đơn hàng thành công",
            orderDetail
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getAllOrderStatus = async (req, res) => {
    try {
        const orderStatus = await getAllOrderStatusService();

        return successResponseList(
            res,
            "Lấy danh sách trạng thái đơn hàng thành công!",
            orderStatus
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getAllOrder = async (req, res) => {
    try {
        const { accountId, statusCode, page = 0, size = 10 } = req.query;

        const { orders, total } = await getAllOrderService(
            accountId,
            statusCode,
            page,
            size
        );

        if (!orders) {
            return errorResponse400(res, "Không tìm thấy đơn hàng");
        }

        return successResponseList(
            res,
            "Lấy danh sách đơn hàng thành công",
            orders,
            {
                total,
                page: +page,
                size: +size,
                totalPages: Math.ceil(total / +size),
            }
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const cancelOrder = async (req, res) => {
    try {
        const result = await cancelOrderService(req.body);
        return successResponse(res, "Hủy đơn hàng thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const countOrderByCategoryName = async (req, res) => {
    try {
        const { year } = req.query;
        const result = await countOrderByCategoryNameService(year);
        return successResponseList(
            res,
            "Thống kê danh mục theo doanh thu",
            result
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const countOrder = async (req, res) => {
    try {
        const result = await countOrderService();
        return successResponse(
            res,
            "Thống kê đơn hàng theo trạng thái",
            result
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const reportAmountYear = async (req, res) => {
    try {
        const result = await reportAmountYearService();
        return successResponse(res, "Báo cáo doanh thu theo năm", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const amountYear = async (req, res) => {
    try {
        const result = await amountYearService();
        return successResponse(res, "Tổng doanh thu theo năm", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const reportByProduct = async (req, res) => {
    try {
        const { page = 0, size = 10, year } = req.query;

        const result = await reportByProductService({ page, size, year });

        return successResponseList(res, "Thống kê sản phẩm theo năm", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const reportByProductByYear = async (req, res) => {
    try {
        const { page = 0, size = 10, sort = "totalQuantity", year } = req.query;

        const result = await reportByProductByYearService({
            page,
            size,
            sort,
            year,
        });

        return successResponseList(res, "Thống kê sản phẩm theo năm", result);
    } catch (error) {
        if (
            error instanceof ErrorCustom ||
            error.message === "Thiếu tham số year"
        ) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getOrderByOrderStatusAndYearAndMonth = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const { page = 0, size = 10, status = "ALL", payment = "ALL" } = filter;
        const { month, year } = req.query;

        const { orders, pagination } = await getOrdersByStatusAndDateService({
            page,
            size,
            status,
            payment,
            month,
            year,
        });

        return successResponseList(
            res,
            "Lấy danh sách đơn hàng thành công",
            orders,
            pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getOrderByOrderYearAndMonth = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const { page = 0, size = 10 } = filter;
        const { month, year, statusCode } = req.query;

        const { orders, pagination } = await getOrderByOrderYearAndMonthService(
            {
                page,
                size,
                month,
                year,
                statusCode,
            }
        );

        return successResponseList(
            res,
            "Lấy danh sách đơn hàng thành công",
            orders,
            pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getOrderByProduct = async (req, res) => {
    try {
        const { page = 0, size = 10, id, year } = req.query;

        validateMongoDbId(id);

        if (!year || isNaN(Number(year))) {
            throw new ErrorCustom("Năm không hợp lệ");
        }

        const { orders, pagination } = await getOrdersByProductService({
            page,
            size,
            productId: id,
            year,
        });

        return successResponseList(
            res,
            "Lấy danh sách đơn hàng thành công",
            orders,
            pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const reportAmountMonth = async (req, res) => {
    try {
        const { year } = req.query;

        if (!year || isNaN(Number(year))) {
            throw new ErrorCustom("Năm không hợp lệ");
        }

        const result = await reportRevenueByMonthService(Number(year));

        return successResponseList(
            res,
            `Báo cáo doanh thu theo tháng năm ${year}`,
            result
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateOrderReturn = async (req, res) => {
    const { orderId, status } = req.body;

    try {
        if (!orderId || !status) {
            throw new ErrorCustom("Thiếu thông tin đơn hàng hoặc trạng thái");
        }

        await updateOrderReturnService(orderId, status);
        return successResponse(res, "Cập nhật hoàn trả thành công!", true);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateOrderRefund = async (req, res) => {
    const { orderId, status } = req.body;

    try {
        if (!orderId || !status) {
            return errorResponse400(res, "Thiếu orderId hoặc status!", false);
        }

        await updateOrderRefundService(orderId, status);

        return successResponse(
            res,
            "Cập nhật trạng thái hoàn tiền thành công!",
            true
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }

        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateCancel = async (req, res) => {
    try {
        const { id, status, shipDate, shipment, description } = req.body;

        if (!id || !status) {
            return errorResponse400(
                res,
                "Thiếu orderId hoặc trạng thái",
                false
            );
        }

        await cancelOrderService2({
            orderId: id,
            status,
            shipDate,
            shipment,
            reason: description,
        });

        return successResponse(res, "Huỷ đơn hàng thành công!", true);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }

        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateProcess = async (req, res) => {
    try {
        const { id, status } = req.body;

        const result = await updateOrderStatusService(id, status);

        return successResponse(res, "Cập nhật đơn hàng thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateShip = async (req, res) => {
    try {
        const { id, status, shipDate, shipment } = req.body;

        const result = await updateOrderShipmentService(
            id,
            status,
            shipDate,
            shipment
        );

        return successResponse(res, "Cập nhật đơn hàng thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateSuccess = async (req, res) => {
    try {
        const { id, status } = req.body;

        const result = await updateOrderSuccessService(id, status);

        return successResponse(res, "Cập nhật đơn hàng thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getAllOrderAndPagination = async (req, res) => {
    try {
        const { orders, pagination } = await getAllOrdersWithPagination(
            req.query
        );
        return successResponseList(
            res,
            "Lấy danh sách đơn hàng thành công",
            orders,
            pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getOrderByOrderStatusBetweenDate = async (req, res) => {};
const getAllOrdersByPayment = async (req, res) => {};

export {
    cancelOrder,
    countOrder,
    countOrderByCategoryName,
    createOrder,
    getAllOrder,
    getAllOrderAndPagination,
    getAllOrdersByPayment,
    getAllOrderStatus,
    getOrderById,
    getOrderByOrderStatusAndYearAndMonth,
    getOrderByOrderYearAndMonth,
    getOrderByOrderStatusBetweenDate,
    getOrderByProduct,
    getOrderDetailByOrderId,
    reportAmountMonth,
    reportAmountYear,
    amountYear,
    reportByProduct,
    reportByProductByYear,
    updateCancel,
    updateProcess,
    updateShip,
    updateSuccess,
    updateOrderReturn,
    updateOrderRefund,
};
