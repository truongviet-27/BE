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

const createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            address,
            fullName,
            phone,
            email,
            note,
            total,
            isPayment,
            payment,
            voucherId,
            orderDetails,
            shipment,
            shipDate,
        } = req.body;
        const user = req.user;

        let orderStatusId = null;

        if (payment) {
            const status = await OrderStatus.findOne({
                code: "PENDING_CONFIRM",
            }).session(session);
            orderStatusId = status?._id;
        }

        console.log(orderStatusId, "orderStatusId");

        const newOrder = await Order.create(
            [
                {
                    code: generateOrderCode(),
                    address,
                    fullName,
                    phone,
                    email,
                    note,
                    total,
                    isPayment,
                    shipment,
                    payment,
                    shipDate,
                    user: user._id,
                    orderStatus: orderStatusId,
                    voucher: voucherId,
                },
            ],
            { session }
        );

        const orderDetailsWithOrderId = orderDetails.map((item) => ({
            ...item,
            attribute: item.attributeId,
            order: newOrder[0]._id,
        }));

        await OrderDetail.insertMany(orderDetailsWithOrderId, { session });

        for (const item of orderDetails) {
            await Promise.all([
                CartItem.findOneAndUpdate(
                    { _id: item._id },
                    {
                        $set: {
                            isActive: false,
                        },
                    },
                    { session }
                ),

                Attribute.findOneAndUpdate(
                    {
                        _id: item.attributeId,
                    },
                    {
                        $inc: {
                            stock: -item.quantity,
                        },
                    },
                    { session }
                ),
            ]);
        }


        // Emit real-time notification
        if (req.io) {
            req.io.to("admin-room").emit("new-order", {
                fullName,
                phone,
                total,
                createdAt: newOrder[0]?.createdAt,
                orderId: newOrder[0]?._id,
            });
        } else {
            console.warn("Socket.IO instance not found on req.io");
        }

        await session.commitTransaction();
        session.endSession();

        return successResponse(res, "Tạo đơn hàng thành công!", newOrder[0]);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error("Transaction failed:", error);
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getOrderById = async (req, res) => {
    try {
        const { id } = req.query;
        const order = await Order.findById(id)
            .populate({
                path: "orderStatus",
                select: "_id name code",
            })
            .populate({
                path: "user",
                select: "_id email username",
            })
            .populate({
                path: "voucher",
                select: "_id code name discount",
            });

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

        const orderDetail = await OrderDetail.aggregate([
            {
                $match: {
                    order: new mongoose.Types.ObjectId(orderId),
                },
            },
            {
                $lookup: {
                    from: "attributes",
                    localField: "attribute",
                    foreignField: "_id",
                    as: "attribute",
                },
            },
            { $unwind: "$attribute" },

            {
                $lookup: {
                    from: "products",
                    localField: "attribute.product",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: "$product" },

            {
                $lookup: {
                    from: "images",
                    localField: "product._id",
                    foreignField: "product",
                    as: "imageUrls",
                },
            },
            {
                $lookup: {
                    from: "orders",
                    localField: "order",
                    foreignField: "_id",
                    as: "order",
                },
            },
            { $unwind: "$order" },

            {
                $project: {
                    _id: 1,
                    quantity: 1,
                    sellPrice: 1,
                    originPrice: 1,
                    attribute: {
                        _id: "$attribute._id",
                        size: "$attribute.size",
                        price: "$attribute.price",
                    },
                    product: {
                        _id: "$product._id",
                        code: "$product.code",
                        name: "$product.name",
                    },
                    imageUrls: {
                        _id: 1,
                        url: 1,
                    },
                    order: {
                        _id: "$order._id",
                        status: "$order.status", // hoặc các field bạn muốn lấy
                        userId: "$order.userId",
                    },
                },
            },
        ]);

        if (!orderDetail) {
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
        const orderStatus = await OrderStatus.find({
            isActive: true,
        });

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
        const { accountId, statusCode, page, size } = req.query;
        let matchFilter = {
            user: new mongoose.Types.ObjectId(accountId),
        };

        if (statusCode) {
            const codeArray = Array.isArray(statusCode)
                ? statusCode
                : statusCode.split(",");

            matchFilter["orderStatus.code"] = { $in: codeArray };
        }

        console.log(matchFilter, "matchFiltexxxx");

        const result = await Order.aggregate([
            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            { $unwind: "$orderStatus" },
            {
                $lookup: {
                    from: "shipments",
                    localField: "shipment",
                    foreignField: "_id",
                    as: "shipment",
                },
            },
            {
                $unwind: {
                    path: "$shipment",
                    preserveNullAndEmptyArrays: true,
                },
            },
            { $match: matchFilter },
            {
                $facet: {
                    data: [
                        { $sort: { createdAt: -1 } },
                        { $skip: +page * +size },
                        { $limit: +size },
                        {
                            $project: {
                                _id: 1,
                                code: 1,
                                address: 1,
                                fullName: 1,
                                phone: 1,
                                email: 1,
                                note: 1,
                                total: 1,
                                isPayment: 1,
                                payment: 1,
                                shipDate: 1,
                                createdAt: 1,
                                orderStatus: {
                                    _id: 1,
                                    name: 1,
                                    code: 1,
                                },
                                shipment: {
                                    _id: 1,
                                    name: 1,
                                    code: 1,
                                },
                            },
                        },
                    ],
                    total: [{ $count: "count" }],
                },
            },
        ]);

        const orders = result[0].data;
        const total = result[0].total[0]?.count || 0;

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
        const session = await mongoose.startSession();
        session.startTransaction();
        const { id, status, shipDate, shipment, description } = req.body;

        const [orders, orderStatus] = await Promise.all([
            Order.aggregate([
                { $match: { _id: new mongoose.Types.ObjectId(id) } },
                {
                    $lookup: {
                        from: "orderdetails",
                        localField: "_id",
                        foreignField: "order",
                        as: "orderDetails",
                    },
                },
            ]),

            OrderStatus.findOne({ code: status }),
        ]);

        const order = orders[0];
        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return errorResponse400(res, "Đơn hàng không tồn tại!", false);
        }

        if (!orderStatus) {
            await session.abortTransaction();
            session.endSession();

            return errorResponse400(
                res,
                "Trạng thái đơn hàng không tồn tại!",
                false
            );
        }

        for (const orderDetail of order.orderDetails) {
            await Attribute.updateOne(
                { _id: orderDetail.attribute },
                { $inc: { stock: orderDetail.quantity } },
                { session }
            );
        }

        await Order.updateOne(
            { _id: id },
            {
                orderStatus: orderStatus._id,
                shipDate,
                shipment,
                isPending: null,
                updateAt: new Date(),
                reason: description,
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return successResponse(res, "Hủy đơn hàng thành công!", true);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }

        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const countOrderByCategoryName = async (req, res) => {
    const { year } = req.query;

    let filter = {
        "orderStatus.code": {
            $nin: ["CANCELLED", "REFUND"],
        },
    };

    if (year) {
        const startDate = new Date(`${year}-01-01`);
        const endDate = new Date(`${+year + 1}-01-01`);
        filter["createdAt"] = {
            $gte: startDate,
            $lt: endDate,
            $type: "date",
        };
    }

    console.log(filter, "filter");
    try {
        const result = await Order.aggregate([
            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            { $unwind: "$orderStatus" },
            {
                $match: filter,
            },

            {
                $lookup: {
                    from: "orderdetails",
                    localField: "_id",
                    foreignField: "order",
                    as: "orderDetails",
                },
            },
            { $unwind: "$orderDetails" },

            {
                $lookup: {
                    from: "attributes",
                    localField: "orderDetails.attribute",
                    foreignField: "_id",
                    as: "attribute",
                },
            },
            { $unwind: "$attribute" },

            {
                $lookup: {
                    from: "products",
                    localField: "attribute.product",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: "$product" },

            {
                $lookup: {
                    from: "product_categories",
                    localField: "product._id",
                    foreignField: "product",
                    as: "productCategory",
                },
            },
            { $unwind: "$productCategory" },

            {
                $lookup: {
                    from: "categories",
                    localField: "productCategory.category",
                    foreignField: "_id",
                    as: "category",
                },
            },
            { $unwind: "$category" },

            {
                $group: {
                    _id: "$category._id",
                    categoryName: { $first: "$category.name" },
                    totalQuantity: { $sum: "$orderDetails.quantity" },
                    totalRevenue: {
                        $sum: {
                            $multiply: [
                                "$orderDetails.quantity",
                                "$orderDetails.sellPrice",
                            ],
                        },
                    },
                },
            },

            {
                $sort: { totalRevenue: -1 },
            },
        ]);

        console.log(result, "result");

        return successResponseList(res, "", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const countOrder = async (req, res) => {
    try {
        const orders = await Order.find({}).populate({
            path: "orderStatus",
            select: "_id code",
        });

        console.log(orders, "orders");

        let pendingConfirm = 0;
        let processing = 0;
        let shipping = 0;
        let delivered = 0;
        let cancelled = 0;

        for (const order of orders) {
            if (order.orderStatus.code === "PENDING_CONFIRM") {
                pendingConfirm += 1;
            } else if (order.orderStatus.code === "PROCESSING") {
                processing += 1;
            } else if (order.orderStatus.code === "SHIPPING") {
                shipping += 1;
            } else if (order.orderStatus.code === "DELIVERED") {
                delivered += 1;
            } else if (order.orderStatus.code === "CANCELLED") {
                cancelled += 1;
            }
        }

        return successResponse(res, "", {
            total: orders.length,
            pendingConfirm,
            processing,
            shipping,
            delivered,
            cancelled,
        });
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const reportAmountYear = async (req, res) => {
    try {
        const result = await Order.aggregate([
            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            { $unwind: "$orderStatus" },

            {
                $addFields: {
                    year: {
                        $year: {
                            date: "$updatedAt",
                            timezone: "Asia/Ho_Chi_Minh",
                        },
                    },
                },
            },

            {
                $group: {
                    _id: "$year",
                    realizedRevenue: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        {
                                            $eq: [
                                                "$orderStatus.code",
                                                "DELIVERED",
                                            ],
                                        },
                                        { $eq: ["$isPayment", true] },
                                    ],
                                },
                                "$total",
                                0,
                            ],
                        },
                    },
                    unearnedRevenue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        {
                                            $in: [
                                                "$orderStatus.code",
                                                [
                                                    "PENDING_CONFIRM",
                                                    "PROCESSING",
                                                    "SHIPPING",
                                                ],
                                            ],
                                        },
                                        { $eq: ["$isPayment", false] },
                                    ],
                                },
                                "$total",
                                0,
                            ],
                        },
                    },
                    unsuccessfulRevenue: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$orderStatus.code",
                                                        "CANCELLED",
                                                    ],
                                                },
                                                { $eq: ["$isPayment", false] },
                                            ],
                                        },
                                        {
                                            $eq: [
                                                "$orderStatus.code",
                                                "REFUND",
                                            ],
                                        },
                                    ],
                                },
                                "$total",
                                0,
                            ],
                        },
                    },
                },
            },
            {
                $project: {
                    year: "$_id",
                    realizedRevenue: 1,
                    unearnedRevenue: 1,
                    unsuccessfulRevenue: 1,
                },
            },
            { $sort: { year: 1 } },
        ]);

        return successResponse(res, "", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const amountYear = async (req, res) => {
    try {
        const result = await Order.aggregate([
            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            { $unwind: "$orderStatus" },
            {
                $facet: {
                    isPaymentTrue: [
                        {
                            $match: {
                                $and: [
                                    { isPayment: true },
                                    {
                                        "orderStatus.code": {
                                            $ne: "REFUND",
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            $addFields: {
                                year: {
                                    $year: {
                                        date: "$updatedAt",
                                        timezone: "Asia/Ho_Chi_Minh",
                                    },
                                },
                            },
                        },
                        {
                            $group: {
                                _id: "$year",
                                totalAmount: { $sum: "$total" },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                year: "$_id",
                                totalAmount: 1,
                            },
                        },
                        { $sort: { year: 1 } },
                    ],
                    isPaymentFalseNotDelivered: [
                        {
                            $match: {
                                $and: [
                                    { isPayment: false },
                                    {
                                        "orderStatus.code": {
                                            $in: [
                                                "PENDING_CONFIRM",
                                                "PROCESSING",
                                                "SHIPPING",
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            $addFields: {
                                year: {
                                    $year: {
                                        date: "$updatedAt",
                                        timezone: "Asia/Ho_Chi_Minh",
                                    },
                                },
                            },
                        },
                        {
                            $group: {
                                _id: "$year",
                                totalAmount: { $sum: "$total" },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                year: "$_id",
                                totalAmount: 1,
                            },
                        },
                        { $sort: { year: 1 } },
                    ],
                },
            },
        ]);

        return successResponse(res, "", result[0]);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const reportByProduct = async (req, res) => {
    try {
        const { page, size, sort, year } = req.query;
        let filter = {
            "orderStatus.code": {
                $nin: ["CANCELLED", "REFUND"],
            },
        };

        if (year) {
            const startDate = new Date(`${year}-01-01`);
            const endDate = new Date(`${+year + 1}-01-01`);
            filter["order.createdAt"] = {
                $gte: startDate,
                $lt: endDate,
                $type: "date",
            };
        }

        const result = await OrderDetail.aggregate([
            {
                $lookup: {
                    from: "attributes",
                    localField: "attribute",
                    foreignField: "_id",
                    as: "attribute",
                },
            },
            { $unwind: "$attribute" },

            {
                $addFields: {
                    productId: "$attribute.product",
                },
            },

            {
                $lookup: {
                    from: "orders",
                    localField: "order",
                    foreignField: "_id",
                    as: "order",
                },
            },

            { $unwind: "$order" },

            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "order.orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            { $unwind: "$orderStatus" },
            {
                $match: filter,
            },

            {
                $addFields: {
                    lineTotal: { $multiply: ["$quantity", "$sellPrice"] },
                    orderId: "$order._id",
                },
            },

            {
                $group: {
                    _id: "$productId",
                    totalQuantity: { $sum: "$quantity" },
                    totalRevenue: { $sum: "$lineTotal" },
                    uniqueOrderIds: { $addToSet: "$orderId" },
                    orderDetailIds: { $push: "$_id" },
                    orderDetailLength: { $sum: 1 },
                },
            },

            {
                $addFields: {
                    totalOrders: { $size: "$uniqueOrderIds" },
                },
            },

            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product",
                },
            },

            {
                $lookup: {
                    from: "images",
                    localField: "product._id",
                    foreignField: "product",
                    as: "imageUrls",
                },
            },

            {
                $unwind: {
                    path: "$product",
                    preserveNullAndEmptyArrays: true,
                },
            },

            { $sort: { totalQuantity: -1 } },
            { $skip: +page * +size },
            { $limit: +size },
        ]);

        return successResponseList(res, "", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const reportByProductByYear = async (req, res) => {
    try {
        const { page, size, sort, year } = req.query;
        const startDate = new Date(`${year}-01-01`);
        const endDate = new Date(`${+year + 1}-01-01`);

        const result = await OrderDetail.aggregate([
            {
                $lookup: {
                    from: "attributes",
                    localField: "attribute",
                    foreignField: "_id",
                    as: "attribute",
                },
            },
            { $unwind: "$attribute" },

            {
                $addFields: {
                    productId: "$attribute.product",
                },
            },

            {
                $lookup: {
                    from: "orders",
                    localField: "order",
                    foreignField: "_id",
                    as: "order",
                },
            },

            { $unwind: "$order" },

            {
                $match: {
                    "order.createdAt": {
                        $gte: startDate,
                        $lt: endDate,
                        $type: "date",
                    },
                },
            },

            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "order.orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            { $unwind: "$orderStatus" },
            {
                $match: {
                    "orderStatus.code": {
                        $nin: ["CANCELLED", "REFUND"],
                    },
                },
            },

            {
                $addFields: {
                    lineTotal: { $multiply: ["$quantity", "$sellPrice"] },
                    orderId: "$order._id",
                },
            },

            {
                $group: {
                    _id: "$productId",
                    totalQuantity: { $sum: "$quantity" },
                    totalRevenue: { $sum: "$lineTotal" },
                    uniqueOrderIds: { $addToSet: "$orderId" },
                    orderDetailIds: { $push: "$_id" },
                    orderDetailLength: { $sum: 1 },
                },
            },

            {
                $addFields: {
                    totalOrders: { $size: "$uniqueOrderIds" },
                },
            },

            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product",
                },
            },

            {
                $lookup: {
                    from: "images",
                    localField: "product._id",
                    foreignField: "product",
                    as: "imageUrls",
                },
            },

            {
                $unwind: {
                    path: "$product",
                    preserveNullAndEmptyArrays: true,
                },
            },

            { $sort: { [sort]: -1 } },
            { $skip: +page * +size },
            { $limit: +size },
        ]);

        return successResponseList(res, "", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getOrderByOrderStatusAndYearAndMonth = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const { page, size, status, payment } = filter;
        const { month, year } = req.query;

        let matchFilter = {};

        if (status !== "ALL") {
            matchFilter["orderStatus.code"] = status;
        }
        if (payment !== "ALL") {
            matchFilter["payment"] = payment;
        }

        let dateFilter = [];

        if (month) {
            dateFilter.push({ $eq: [{ $month: "$createdAt" }, Number(month)] });
        }

        if (year) {
            dateFilter.push({ $eq: [{ $year: "$createdAt" }, Number(year)] });
        }

        if (dateFilter.length > 0) {
            matchFilter.$expr = { $and: dateFilter };
        }

        console.log(matchFilter, "matchFilter");

        const result = await Order.aggregate([
            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            {
                $unwind: "$orderStatus",
            },

            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "user",
                },
            },
            {
                $unwind: "$user",
            },

            {
                $match: matchFilter,
            },

            {
                $sort: { createdAt: -1 },
            },
            {
                $project: {
                    _id: 1,
                    code: 1,
                    address: 1,
                    fullName: 1,
                    phone: 1,
                    email: 1,
                    note: 1,
                    total: 1,
                    isPayment: 1,
                    payment: 1,
                    user: {
                        _id: 1,
                        email: 1,
                        username: 1,
                    },
                    orderStatus: {
                        _id: 1,
                        name: 1,
                        code: 1,
                    },
                    voucher: 1,
                    createdAt: 1,
                },
            },
            {
                $facet: {
                    data: [
                        { $sort: { createdAt: -1 } },
                        { $skip: +page * +size },
                        { $limit: +size },
                    ],
                    total: [{ $count: "count" }],
                },
            },
        ]);

        const orders = result[0]?.data || [];
        const total = result[0]?.total[0]?.count || 0;

        if (!orders) {
            return errorResponse400(res, "Không tìm thấy đơn hàng");
        }

        return successResponseList(
            res,
            "Lấy danh sách đơn hàng thành công",
            orders,
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

const getOrderByOrderYearAndMonth = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const { page, size } = filter;
        const { month, year, statusCode } = req.query;

        let matchFilter = {};

        let dateFilter = [];

        if (statusCode) {
            const codeArray = Array.isArray(statusCode)
                ? statusCode
                : statusCode.split(",");

            matchFilter["orderStatus.code"] = { $in: codeArray };
        }

        if (month) {
            dateFilter.push({ $eq: [{ $month: "$updatedAt" }, Number(month)] });
        }

        if (year) {
            dateFilter.push({ $eq: [{ $year: "$updatedAt" }, Number(year)] });
        }

        if (dateFilter.length > 0) {
            matchFilter.$expr = { $and: dateFilter };
        }

        const result = await Order.aggregate([
            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            {
                $unwind: "$orderStatus",
            },

            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "user",
                },
            },
            {
                $unwind: "$user",
            },

            {
                $match: matchFilter,
            },

            {
                $sort: { createdAt: -1 },
            },
            {
                $project: {
                    _id: 1,
                    code: 1,
                    address: 1,
                    fullName: 1,
                    phone: 1,
                    email: 1,
                    note: 1,
                    total: 1,
                    isPayment: 1,
                    payment: 1,
                    user: {
                        _id: 1,
                        email: 1,
                        username: 1,
                    },
                    orderStatus: {
                        _id: 1,
                        name: 1,
                        code: 1,
                    },
                    voucher: 1,
                    createdAt: 1,
                },
            },
            {
                $facet: {
                    data: [
                        { $sort: { createdAt: -1 } },
                        { $skip: +page * +size },
                        { $limit: +size },
                    ],
                    total: [{ $count: "count" }],
                },
            },
        ]);

        const orders = result[0]?.data || [];
        const total = result[0]?.total[0]?.count || 0;

        if (!orders) {
            return errorResponse400(res, "Không tìm thấy đơn hàng");
        }

        return successResponseList(
            res,
            "Lấy danh sách đơn hàng thành công",
            orders,
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

const getOrderByProduct = async (req, res) => {
    try {
        const { page, size, id, year } = req.query;
        const startDate = new Date(`${year}-01-01`);
        const endDate = new Date(`${+year + 1}-01-01`);

        const result = await Order.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: startDate,
                        $lt: endDate,
                        $type: "date",
                    },
                },
            },
            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            {
                $unwind: "$orderStatus",
            },
            {
                $lookup: {
                    from: "orderdetails",
                    localField: "_id",
                    foreignField: "order",
                    as: "orderDetail",
                },
            },
            {
                $unwind: "$orderDetail",
            },
            {
                $lookup: {
                    from: "attributes",
                    localField: "orderDetail.attribute",
                    foreignField: "_id",
                    as: "attribute",
                },
            },
            {
                $unwind: "$attribute",
            },
            {
                $lookup: {
                    from: "products",
                    localField: "attribute.product",
                    foreignField: "_id",
                    as: "product",
                },
            },
            {
                $unwind: "$product",
            },
            {
                $match: {
                    "product._id": new mongoose.Types.ObjectId(id),
                    "orderStatus.code": {
                        $nin: ["CANCELLED", "REFUND"],
                    },
                },
            },
            {
                $group: {
                    _id: "$_id",
                    code: { $first: "$code" },
                    fullName: { $first: "$fullName" },
                    phone: { $first: "$phone" },
                    address: { $first: "$address" },
                    orderStatus: { $first: "$orderStatus.code" },
                    createdAt: { $first: "$createdAt" },
                    total: { $first: "$total" },
                },
            },
            {
                $sort: {
                    createdAt: -1,
                },
            },
            {
                $facet: {
                    totalPages: [{ $count: "total" }],
                    data: [{ $skip: +page * +size }, { $limit: +size }],
                },
            },
        ]);

        const orders = result[0].data;
        const total = result[0].totalPages[0]?.total || 0;

        return successResponseList(res, "", orders, {
            total,
            page: +page,
            size: +size,
            totalPages: Math.ceil(total / size),
        });
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const reportAmountMonth = async (req, res) => {
    const { year } = req.query;
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${+year + 1}-01-01`);

    try {
        const result = await Order.aggregate([
            {
                $match: {
                    updatedAt: {
                        $gte: startDate,
                        $lt: endDate,
                        $type: "date",
                    },
                },
            },
            {
                $lookup: {
                    from: "orderdetails",
                    localField: "_id",
                    foreignField: "order",
                    as: "orderDetails",
                },
            },
            { $unwind: "$orderDetails" },

            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            { $unwind: "$orderStatus" },

            {
                $addFields: {
                    total: {
                        $multiply: [
                            "$orderDetails.quantity",
                            "$orderDetails.sellPrice",
                        ],
                    },
                    month: { $month: "$updatedAt" },
                },
            },

            {
                $group: {
                    _id: "$month",
                    realizedRevenue: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        {
                                            $eq: [
                                                "$orderStatus.code",
                                                "DELIVERED",
                                            ],
                                        },
                                        { $eq: ["$isPayment", true] },
                                    ],
                                },
                                "$total",
                                0,
                            ],
                        },
                    },
                    unearnedRevenue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        {
                                            $in: [
                                                "$orderStatus.code",
                                                [
                                                    "PENDING_CONFIRM",
                                                    "PROCESSING",
                                                    "SHIPPING",
                                                ],
                                            ],
                                        },
                                        { $eq: ["$isPayment", false] },
                                    ],
                                },
                                "$total",
                                0,
                            ],
                        },
                    },
                    unsuccessfulRevenue: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$orderStatus.code",
                                                        "CANCELLED",
                                                    ],
                                                },
                                                { $eq: ["$isPayment", false] },
                                            ],
                                        },
                                        {
                                            $eq: [
                                                "$orderStatus.code",
                                                "REFUND",
                                            ],
                                        },
                                    ],
                                },
                                "$total",
                                0,
                            ],
                        },
                    },
                },
            },

            {
                $project: {
                    month: "$_id",
                    realizedRevenue: 1,
                    unearnedRevenue: 1,
                    unsuccessfulRevenue: 1,
                },
            },
            {
                $sort: { month: 1 },
            },
        ]);

        return successResponseList(res, "", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};
const updateOrderReturn = async (req, res) => {
    const session = await mongoose.startSession();
    const { orderId, status } = req.body;

    try {
        session.startTransaction();

        const [orders, orderStatus] = await Promise.all([
            Order.aggregate([
                { $match: { _id: new mongoose.Types.ObjectId(orderId) } },
                {
                    $lookup: {
                        from: "orderdetails",
                        localField: "_id",
                        foreignField: "order",
                        as: "orderDetails",
                    },
                },
            ]),

            OrderStatus.findOne({ code: status }),
        ]);

        const order = orders[0];
        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return errorResponse400(res, "Đơn hàng không tồn tại!", false);
        }

        if (!orderStatus) {
            await session.abortTransaction();
            session.endSession();

            return errorResponse400(
                res,
                "Trạng thái đơn hàng không tồn tại!",
                false
            );
        }

        for (const orderDetail of order.orderDetails) {
            await Attribute.updateOne(
                { _id: orderDetail.attribute },
                {
                    $set: { $inc: { stock: orderDetail.quantity } },
                },
                { session }
            );
        }

        await Order.updateOne(
            { _id: orderId },
            {
                orderStatus: orderStatus._id,
                updateAt: new Date(),
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return successResponse(res, "Thành công!", true);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }

        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateOrderRefund = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { orderId, status } = req.body;
        const [orders, orderStatus] = await Promise.all([
            Order.aggregate([
                { $match: { _id: new mongoose.Types.ObjectId(orderId) } },
                {
                    $lookup: {
                        from: "orderdetails",
                        localField: "_id",
                        foreignField: "order",
                        as: "orderDetails",
                    },
                },
            ]),

            OrderStatus.findOne({ code: status }),
        ]);

        const order = orders[0];
        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return errorResponse400(res, "Đơn hàng không tồn tại!", false);
        }

        if (!orderStatus) {
            await session.abortTransaction();
            session.endSession();

            return errorResponse400(
                res,
                "Trạng thái đơn hàng không tồn tại!",
                false
            );
        }

        await Order.updateOne(
            { _id: orderId },
            {
                isPayment: null,
                orderStatus: orderStatus._id,
                updateAt: new Date(),
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return successResponse(res, "Thành công!", true);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }

        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateCancel = async (req, res) => {
    try {
        const session = await mongoose.startSession();
        session.startTransaction();
        const { id, status, shipDate, shipment, description } = req.body;

        const [orders, orderStatus] = await Promise.all([
            Order.aggregate([
                { $match: { _id: new mongoose.Types.ObjectId(id) } },
                {
                    $lookup: {
                        from: "orderdetails",
                        localField: "_id",
                        foreignField: "order",
                        as: "orderDetails",
                    },
                },
            ]),

            OrderStatus.findOne({ code: status }),
        ]);

        const order = orders[0];
        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return errorResponse400(res, "Đơn hàng không tồn tại!", false);
        }

        if (!orderStatus) {
            await session.abortTransaction();
            session.endSession();

            return errorResponse400(
                res,
                "Trạng thái đơn hàng không tồn tại!",
                false
            );
        }

        for (const orderDetail of order.orderDetails) {
            await Attribute.updateOne(
                { _id: orderDetail.attribute },
                { $inc: { stock: orderDetail.quantity } },
                { session }
            );
        }

        await Order.updateOne(
            { _id: id },
            {
                orderStatus: orderStatus._id,
                shipDate,
                shipment,
                updateAt: new Date(),
                reason: description,
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return successResponse(res, "Hủy đơn hàng thành công!", true);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }

        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateProcess = async (req, res) => {
    try {
        const { id, status } = req.body;

        const [order, orderStatus] = await Promise.all([
            await Order.findOne({
                _id: id,
            }),
            await OrderStatus.findOne({
                code: status,
            }),
        ]);

        if (!order) {
            return errorResponse400(res, "Đơn hàng không tồn tại!", false);
        }

        if (!orderStatus) {
            return errorResponse400(
                res,
                "Trạng thái đơn hàng không tồn tại!",
                false
            );
        }

        await Order.updateOne(
            {
                _id: id,
            },
            {
                ...order.toObject(),
                orderStatus: orderStatus._id,
                updateAt: new Date(),
            }
        );

        console.log(order, orderStatus, "orderxxx");

        return successResponse(res, "Cập nhật đơn hàng thành công!", true);
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

        const [order, orderStatus] = await Promise.all([
            await Order.findOne({
                _id: id,
            }),
            await OrderStatus.findOne({
                code: status,
            }),
        ]);

        if (!order) {
            return errorResponse400(res, "Đơn hàng không tồn tại!", false);
        }

        if (!orderStatus) {
            return errorResponse400(
                res,
                "Trạng thái đơn hàng không tồn tại!",
                false
            );
        }

        await Order.updateOne(
            {
                _id: id,
            },
            {
                ...order.toObject(),
                orderStatus: orderStatus._id,
                shipDate,
                shipment,
                updateAt: new Date(),
            }
        );

        return successResponse(res, "Cập nhật đơn hàng thành công!", true);
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

        const [order, orderStatus] = await Promise.all([
            await Order.findOne({
                _id: id,
            }),
            await OrderStatus.findOne({
                code: status,
            }),
        ]);

        if (!order) {
            return errorResponse400(res, "Đơn hàng không tồn tại!", false);
        }

        if (!orderStatus) {
            return errorResponse400(
                res,
                "Trạng thái đơn hàng không tồn tại!",
                false
            );
        }

        await Order.updateOne(
            {
                _id: id,
            },
            {
                ...order.toObject(),
                orderStatus: orderStatus._id,
                isPayment: true,
                updateAt: new Date(),
            }
        );

        console.log(order, orderStatus, "orderxxx");

        return successResponse(res, "Cập nhật đơn hàng thành công!", true);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getAllOrderAndPagination = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const { page, size, status, payment } = filter;
        const { from, to, month, year } = req.query;

        console.log(filter, "filter");

        let matchFilter = {};

        if (status !== "ALL") {
            matchFilter["orderStatus.code"] = status;
        }
        if (payment !== "ALL") {
            matchFilter["payment"] = payment;
        }

        if (from && !to) {
            const fromDate = new Date(from);
            const startOfDay = new Date(fromDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(fromDate.setHours(23, 59, 59, 999));

            matchFilter["createdAt"] = {
                $gte: startOfDay,
                $lte: endOfDay,
            };
        }
        if (to && !from) {
            const date = new Date(to);
            const startOfDay = new Date(date.setHours(0, 0, 0, 0));
            const endOfDay = new Date(date.setHours(23, 59, 59, 999));

            matchFilter["createdAt"] = {
                $gte: startOfDay,
                $lte: endOfDay,
            };
        }

        if (from && to) {
            const fromDate = new Date(from);
            const toDate = new Date(to);

            if (fromDate > toDate) {
                return errorResponse400(
                    res,
                    "Ngày bắt đầu không được lớn hơn ngày kết thúc"
                );
            }

            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);

            matchFilter["createdAt"] = {
                $gte: fromDate,
                $lte: toDate,
            };
        }

        const result = await Order.aggregate([
            {
                $lookup: {
                    from: "orderstatuses",
                    localField: "orderStatus",
                    foreignField: "_id",
                    as: "orderStatus",
                },
            },
            {
                $unwind: "$orderStatus",
            },

            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "user",
                },
            },
            {
                $unwind: "$user",
            },

            {
                $match: matchFilter,
            },

            {
                $sort: { createdAt: -1 },
            },
            {
                $project: {
                    _id: 1,
                    code: 1,
                    address: 1,
                    fullName: 1,
                    phone: 1,
                    email: 1,
                    note: 1,
                    total: 1,
                    isPayment: 1,
                    payment: 1,
                    user: {
                        _id: 1,
                        email: 1,
                        username: 1,
                    },
                    orderStatus: {
                        _id: 1,
                        name: 1,
                        code: 1,
                    },
                    voucher: 1,
                    createdAt: 1,
                },
            },
            {
                $facet: {
                    data: [
                        { $sort: { createdAt: -1 } },
                        { $skip: +page * +size },
                        { $limit: +size },
                    ],
                    total: [{ $count: "count" }],
                },
            },
        ]);

        const orders = result[0]?.data || [];
        const total = result[0]?.total[0]?.count || 0;

        if (!orders) {
            return errorResponse400(res, "Không tìm thấy đơn hàng");
        }

        return successResponseList(
            res,
            "Lấy danh sách đơn hàng thành công",
            orders,
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
