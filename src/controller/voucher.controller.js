import { ErrorCustom } from "../helper/ErrorCustom.js";
import Voucher from "../model/voucher.js";
import {
    createVoucherService,
    deleteVoucherService,
    getAllVouchersService,
    getVoucherByCodeService,
    getVoucherByIdService,
    updateVoucherService,
} from "../service/voucher.service.js";
import {
    errorResponse400,
    errorResponse500,
    successResponse,
    successResponseList,
} from "../utils/responseHandler.js";
import validateMongoDbId from "../utils/validateMongodbId.js";

export const getAllVouchers = async (req, res) => {
    try {
        const { vouchers, pagination } = await getAllVouchersService(req.query);

        return successResponseList(
            res,
            "Lấy danh sách voucher thành công!",
            vouchers,
            pagination
        );
    } catch (error) {
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getVoucherById = async (req, res) => {
    try {
        const { id } = req.query;
        const voucher = await getVoucherByIdService(id);

        if (!voucher) {
            return successResponse(res, "Không tìm thấy voucher");
        }

        return successResponse(res, "Lấy voucher thành công!", voucher);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const createVoucher = async (req, res) => {
    try {
        const newVoucher = await createVoucherService(req.body);
        return successResponse(res, "Tạo voucher thành công!", newVoucher);
    } catch (error) {
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const updateVoucher = async (req, res) => {
    try {
        const updatedVoucher = await updateVoucherService(req.body);
        return successResponse(
            res,
            "Cập nhật voucher thành công!",
            updatedVoucher
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const deleteVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await deleteVoucherService(id);

        if (result) {
            return successResponse(
                res,
                "Voucher đã được xóa thành công!",
                true
            );
        }

        return errorResponse400(
            res,
            "Voucher đã được xóa không thành công!",
            false
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getVoucherByCode = async (req, res) => {
    try {
        const { code } = req.query;
        const voucher = await getVoucherByCodeService(code);

        return successResponse(res, "Lấy voucher thành công!", voucher);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};
