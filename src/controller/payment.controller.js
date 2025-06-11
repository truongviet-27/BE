import crypto from "crypto";
import dotenv from "dotenv";
import moment from "moment";
import Order from "../model/order.js";
import OrderStatus from "../model/orderStatus.js";
import {
    errorResponse400,
    errorResponse500,
    successResponse,
} from "../utils/responseHandler.js";
import validateMongoDbId from "../utils/validateMongodbId.js";
dotenv.config();

export const generatePaymentUrl = async (req, res) => {
    process.env.TZ = "Asia/Ho_Chi_Minh";

    const { orderId } = req.body;

    validateMongoDbId(orderId);

    const order = await Order.findById(orderId);
    if (!order) {
        return errorResponse400(res, "Không tìm thấy đơn hàng!", false);
    }

    let date = new Date();
    let createDate = moment(date).format("YYYYMMDDHHmmss");
    let expireDate = moment(date).add(15, "minutes").format("YYYYMMDDHHmmss");

    let ipAddr = process.env.IP_ADDR;
    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_SECRET_KEY;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;

    let locale = "vn";
    let currCode = "VND";

    let vnp_Params = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: tmnCode,
        vnp_Locale: locale,
        vnp_CurrCode: currCode,
        vnp_TxnRef: orderId,
        vnp_OrderInfo: `Payment for ${orderId}`,
        vnp_OrderType: "other",
        vnp_Amount: order.total * 100,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate,
    };

    const sortedParams = sortParams(vnp_Params);

    const urlParams = new URLSearchParams();
    for (let [key, value] of Object.entries(sortedParams)) {
        urlParams.append(key, value);
    }

    const querystring = urlParams.toString();

    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(querystring).digest("hex");

    urlParams.append("vnp_SecureHash", signed);

    const paymentUrl = `${vnpUrl}?${urlParams.toString()}`;

    return successResponse(res, "", paymentUrl);
};

function sortParams(obj) {
    const sortedObj = Object.entries(obj)
        .filter(
            ([key, value]) =>
                value !== "" && value !== undefined && value !== null
        )
        .sort(([key1], [key2]) =>
            key1.toString().localeCompare(key2.toString())
        )
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {});

    return sortedObj;
}

export const handlePaymentResponse = async (req, res) => {
    const { vnp_ResponseCode, vnp_TxnRef } = req.query;
    try {
        if (!vnp_ResponseCode || !vnp_TxnRef) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        const order = await Order.findOne({ _id: vnp_TxnRef });
        if (!order) {
            return errorResponse400(res, "Không tìm thấy đơn hàng", false);
        }
        let redirectUrl = "";
        if (vnp_ResponseCode == "00") {
            const orderStatus = await OrderStatus.findOne({
                code: "PROCESSING",
            });
            order.orderStatus = orderStatus._id;
            order.isPayment = true;
            redirectUrl = `http://localhost:5173/order`;
        } else {
            order.isPayment = false;
            redirectUrl = `http://localhost:5173/order/detail/${vnp_TxnRef}`;
        }
        await order.save();
        res.redirect(redirectUrl);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};
