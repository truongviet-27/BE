import mongoose from "mongoose";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import Attribute from "../model/attribute.js";
import OrderStatus from "../model/orderStatus.js";
import OrderDetail from "../model/orderDetail.js";
import CartItem from "../model/cartItem.js";
import Order from "../model/order.js";
import aqp from "api-query-params";
import generateOrderCode from "../utils/generateOrderCode.js";

export const createOrderService = async (user, body) => {
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
        } = body;

        let orderStatusId = null;

        if (payment) {
            const status = await OrderStatus.findOne({
                code: "PENDING_CONFIRM",
            }).session(session);
            orderStatusId = status?._id;
        }

        const [newOrder] = await Order.create(
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
            order: newOrder._id,
        }));

        await OrderDetail.insertMany(orderDetailsWithOrderId, { session });

        for (const item of orderDetails) {
            await Promise.all([
                CartItem.findOneAndUpdate(
                    { _id: item._id },
                    { $set: { isActive: false } },
                    { session }
                ),
                Attribute.findOneAndUpdate(
                    { _id: item.attributeId },
                    { $inc: { stock: -item.quantity } },
                    { session }
                ),
            ]);
        }

        await session.commitTransaction();
        session.endSession();

        return newOrder;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw new ErrorCustom("Lỗi khi tạo đơn hàng: " + error.message);
    }
};

export const getOrderByIdService = async (id) => {
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

    return order;
};

export const getOrderDetailByOrderIdService = async (orderId) => {
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
            $lookup: {
                from: "user_review_attributes",
                localField: "_id",
                foreignField: "orderDetail",
                as: "userReviewAttributes",
            },
        },
        {
            $unwind: {
                path: "$userReviewAttributes",
                preserveNullAndEmptyArrays: true,
            },
        },
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
                    status: "$order.status",
                    userId: "$order.userId",
                },
                userReviewAttributes: {
                    rating: 1,
                    description: 1,
                },
            },
        },
    ]);

    return orderDetail;
};

export const getAllOrderStatusService = async () => {
    const orderStatuses = await OrderStatus.find({ isActive: true });
    return orderStatuses;
};

export const getAllOrderService = async (accountId, statusCode, page, size) => {
    const matchFilter = {
        user: new mongoose.Types.ObjectId(accountId),
    };

    if (statusCode) {
        const codeArray = Array.isArray(statusCode)
            ? statusCode
            : statusCode.split(",");

        matchFilter["orderStatus.code"] = { $in: codeArray };
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

    return { orders, total };
};

export const cancelOrderService = async ({
    id,
    status,
    shipDate,
    shipment,
    description,
}) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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
            throw new Error("Đơn hàng không tồn tại!");
        }

        if (!orderStatus) {
            throw new Error("Trạng thái đơn hàng không tồn tại!");
        }

        // Hoàn lại hàng
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

        return true;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw new ErrorCustom("Không thể hủy đơn hàng: " + error.message);
    }
};

export const countOrderByCategoryNameService = async (year) => {
    const filter = {
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
        { $match: filter },

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

        { $sort: { totalRevenue: -1 } },
    ]);

    return result;
};

export const countOrderService = async () => {
    const orders = await Order.find({}).populate({
        path: "orderStatus",
        select: "_id code",
    });

    const statusCounters = {
        pendingConfirm: 0,
        processing: 0,
        shipping: 0,
        delivered: 0,
        cancelled: 0,
    };

    for (const order of orders) {
        switch (order.orderStatus.code) {
            case "PENDING_CONFIRM":
                statusCounters.pendingConfirm++;
                break;
            case "PROCESSING":
                statusCounters.processing++;
                break;
            case "SHIPPING":
                statusCounters.shipping++;
                break;
            case "DELIVERED":
                statusCounters.delivered++;
                break;
            case "CANCELLED":
                statusCounters.cancelled++;
                break;
        }
    }

    return {
        total: orders.length,
        ...statusCounters,
    };
};

export const reportAmountYearService = async () => {
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
                                    { $eq: ["$orderStatus.code", "DELIVERED"] },
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
                                    { $eq: ["$orderStatus.code", "REFUND"] },
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
                _id: 0,
            },
        },
        { $sort: { year: 1 } },
    ]);

    return result;
};

export const amountYearService = async () => {
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
                                { "orderStatus.code": { $ne: "REFUND" } },
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

    return result[0];
};

export const reportByProductService = async ({ page, size, year }) => {
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

    return result;
};

export const reportByProductByYearService = async ({
    page = 0,
    size = 10,
    sort = "totalQuantity",
    year,
}) => {
    if (!year) {
        throw new ErrorCustom("Dữ liệu năm không được để trống!");
    }

    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${+year + 1}-01-01`);

    const pipeline = [
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
            $unwind: {
                path: "$product",
                preserveNullAndEmptyArrays: true,
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

        { $sort: { [sort]: -1 } },
        { $skip: +page * +size },
        { $limit: +size },
    ];

    const result = await OrderDetail.aggregate(pipeline);
    return result;
};

export const getOrdersByStatusAndDateService = async ({
    page = 0,
    size = 10,
    status,
    payment,
    month,
    year,
}) => {
    const matchFilter = {};

    if (status && status !== "ALL") {
        matchFilter["orderStatus.code"] = status;
    }

    if (payment && payment !== "ALL") {
        matchFilter["payment"] = payment;
    }

    const dateExpr = [];

    if (month) {
        dateExpr.push({ $eq: [{ $month: "$createdAt" }, Number(month)] });
    }

    if (year) {
        dateExpr.push({ $eq: [{ $year: "$createdAt" }, Number(year)] });
    }

    if (dateExpr.length > 0) {
        matchFilter.$expr = { $and: dateExpr };
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
        { $unwind: "$orderStatus" },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user",
            },
        },
        { $unwind: "$user" },

        {
            $match: matchFilter,
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
                voucher: 1,
                createdAt: 1,
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

    return {
        orders,
        total,
        pagination: {
            total,
            page: Number(page),
            size: Number(size),
            totalPages: Math.ceil(total / size),
        },
    };
};

export const getOrderByOrderYearAndMonthService = async ({
    page = 0,
    size = 10,
    month,
    year,
    statusCode,
}) => {
    const matchFilter = {};
    const dateExpr = [];

    if (statusCode) {
        const codeArray = Array.isArray(statusCode)
            ? statusCode
            : statusCode.split(",");
        matchFilter["orderStatus.code"] = { $in: codeArray };
    }

    if (month) {
        dateExpr.push({ $eq: [{ $month: "$updatedAt" }, Number(month)] });
    }

    if (year) {
        dateExpr.push({ $eq: [{ $year: "$updatedAt" }, Number(year)] });
    }

    if (dateExpr.length > 0) {
        matchFilter.$expr = { $and: dateExpr };
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
        { $unwind: "$orderStatus" },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user",
            },
        },
        { $unwind: "$user" },

        { $match: matchFilter },

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
                voucher: 1,
                createdAt: 1,
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
            },
        },

        {
            $facet: {
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: Number(page) * Number(size) },
                    { $limit: Number(size) },
                ],
                total: [{ $count: "count" }],
            },
        },
    ]);

    const orders = result[0]?.data || [];
    const total = result[0]?.total?.[0]?.count || 0;

    return {
        orders,
        pagination: {
            total,
            page: Number(page),
            size: Number(size),
            totalPages: Math.ceil(total / size),
        },
    };
};

export const getOrdersByProductService = async ({
    page = 0,
    size = 10,
    productId,
    year,
}) => {
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
        { $unwind: "$orderStatus" },

        {
            $lookup: {
                from: "orderdetails",
                localField: "_id",
                foreignField: "order",
                as: "orderDetail",
            },
        },
        { $unwind: "$orderDetail" },

        {
            $lookup: {
                from: "attributes",
                localField: "orderDetail.attribute",
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
            $match: {
                "product._id": new mongoose.Types.ObjectId(productId),
                "orderStatus.code": { $nin: ["CANCELLED", "REFUND"] },
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

        { $sort: { createdAt: -1 } },

        {
            $facet: {
                data: [
                    { $skip: Number(page) * Number(size) },
                    { $limit: Number(size) },
                ],
                total: [{ $count: "total" }],
            },
        },
    ]);

    const orders = result[0]?.data || [];
    const total = result[0]?.total?.[0]?.total || 0;

    return {
        orders,
        pagination: {
            total,
            page: Number(page),
            size: Number(size),
            totalPages: Math.ceil(total / size),
        },
    };
};

export const reportRevenueByMonthService = async (year) => {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${+year + 1}-01-01`);

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
                                    { $eq: ["$orderStatus.code", "DELIVERED"] },
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
                                    { $eq: ["$orderStatus.code", "REFUND"] },
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
                _id: 0,
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

    return result;
};

export const updateOrderReturnService = async (orderId, status) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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
            throw new ErrorCustom("Đơn hàng không tồn tại!");
        }

        if (!orderStatus) {
            throw new ErrorCustom("Trạng thái đơn hàng không tồn tại!");
        }

        for (const orderDetail of order.orderDetails) {
            await Attribute.updateOne(
                { _id: orderDetail.attribute },
                { $inc: { stock: orderDetail.quantity } },
                { session }
            );
        }

        await Order.updateOne(
            { _id: orderId },
            {
                orderStatus: orderStatus._id,
                updatedAt: new Date(),
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return true;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw new ErrorCustom(
            "Không thể cập nhật trạng thái hoàn trả đơn hàng: " + error.message
        );
    }
};

export const updateOrderRefundService = async (orderId, status) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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
            throw new ErrorCustom("Đơn hàng không tồn tại!");
        }

        if (!orderStatus) {
            throw new ErrorCustom("Trạng thái đơn hàng không tồn tại!");
        }

        await Order.updateOne(
            { _id: orderId },
            {
                isPayment: null,
                orderStatus: orderStatus._id,
                updatedAt: new Date(),
            },
            { session }
        );

        await session.commitTransaction();
        return true;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw new ErrorCustom(
            "Không thể cập nhật trạng thái hoàn tiền đơn hàng: " + error.message
        );
    }
};

export const cancelOrderService2 = async ({
    orderId,
    status,
    shipDate,
    shipment,
    reason,
}) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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
        if (!order) throw new ErrorCustom("Đơn hàng không tồn tại!");

        if (!orderStatus)
            throw new ErrorCustom("Trạng thái đơn hàng không hợp lệ!");

        // const validStatus = ["PENDING_CONFIRM"];
        // if (!validStatus.includes(order.orderStatus?.code || "")) {
        //     throw new ErrorCustom(
        //         "Không thể huỷ đơn hàng đã hoàn tất hoặc hoàn tiền!"
        //     );
        // }

        for (const detail of order.orderDetails) {
            await Attribute.updateOne(
                { _id: detail.attribute },
                { $inc: { stock: detail.quantity } },
                { session }
            );
        }

        await Order.updateOne(
            { _id: orderId },
            {
                orderStatus: orderStatus._id,
                shipDate,
                shipment,
                updatedAt: new Date(),
                reason,
            },
            { session }
        );

        await session.commitTransaction();
        return true;
    } catch (error) {
        await session.abortTransaction();
        throw new ErrorCustom("Không thể huỷ đơn hàng: " + error.message);
    } finally {
        session.endSession();
    }
};

export const updateOrderStatusService = async (orderId, statusCode) => {
    if (!orderId || !statusCode) {
        throw new ErrorCustom("Thiếu thông tin đơn hàng hoặc trạng thái!");
    }

    const [order, status] = await Promise.all([
        Order.findById(orderId),
        OrderStatus.findOne({ code: statusCode }),
    ]);

    if (!order) {
        throw new ErrorCustom("Đơn hàng không tồn tại!");
    }

    if (!status) {
        throw new ErrorCustom("Trạng thái đơn hàng không tồn tại!");
    }

    await Order.updateOne(
        { _id: orderId },
        {
            orderStatus: status._id,
            updatedAt: new Date(),
        }
    );

    return true;
};

export const updateOrderShipmentService = async (
    orderId,
    statusCode,
    shipDate,
    shipment
) => {
    if (!orderId || !statusCode) {
        throw new ErrorCustom("Thiếu thông tin đơn hàng hoặc trạng thái!");
    }

    const [order, status] = await Promise.all([
        Order.findById(orderId),
        OrderStatus.findOne({ code: statusCode }),
    ]);

    if (!order) {
        throw new ErrorCustom("Đơn hàng không tồn tại!");
    }

    if (!status) {
        throw new ErrorCustom("Trạng thái đơn hàng không tồn tại!");
    }

    await Order.updateOne(
        { _id: orderId },
        {
            orderStatus: status._id,
            shipDate,
            shipment,
            updatedAt: new Date(),
        }
    );

    return true;
};

export const updateOrderSuccessService = async (orderId, statusCode) => {
    if (!orderId || !statusCode) {
        throw new ErrorCustom("Thiếu thông tin đơn hàng hoặc trạng thái!");
    }

    const [order, status] = await Promise.all([
        Order.findById(orderId),
        OrderStatus.findOne({ code: statusCode }),
    ]);

    if (!order) {
        throw new ErrorCustom("Đơn hàng không tồn tại!");
    }

    if (!status) {
        throw new ErrorCustom("Trạng thái đơn hàng không tồn tại!");
    }

    await Order.updateOne(
        { _id: orderId },
        {
            orderStatus: status._id,
            isPayment: true,
            updatedAt: new Date(),
        }
    );

    return true;
};

export const getAllOrdersWithPagination = async (query) => {
    const { filter } = aqp(query);
    const { page = 0, size = 10, status, payment } = filter;
    const { from, to } = query;

    let matchFilter = {};

    if (status !== "ALL") {
        matchFilter["orderStatus.code"] = status;
    }
    if (payment !== "ALL") {
        matchFilter["payment"] = payment;
    }

    if (from && !to) {
        const fromDate = new Date(from);
        matchFilter["createdAt"] = {
            $gte: new Date(fromDate.setHours(0, 0, 0, 0)),
            $lte: new Date(fromDate.setHours(23, 59, 59, 999)),
        };
    }

    if (to && !from) {
        const toDate = new Date(to);
        matchFilter["createdAt"] = {
            $gte: new Date(toDate.setHours(0, 0, 0, 0)),
            $lte: new Date(toDate.setHours(23, 59, 59, 999)),
        };
    }

    if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (fromDate > toDate) {
            throw new Error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
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
        { $unwind: "$orderStatus" },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user",
            },
        },
        { $unwind: "$user" },
        { $match: matchFilter },
        { $sort: { createdAt: -1 } },
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
                user: { _id: 1, email: 1, username: 1 },
                orderStatus: { _id: 1, name: 1, code: 1 },
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

    return {
        orders,
        pagination: {
            total,
            page: +page,
            size: +size,
            totalPages: Math.ceil(total / size),
        },
    };
};
