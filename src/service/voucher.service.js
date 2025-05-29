import aqp from "api-query-params";
import Voucher from "../model/voucher.js";
import validateMongoDbId from "../utils/validateMongodbId.js";

const getAllVouchersService = async (queryParams) => {
    const { filter } = aqp(queryParams);
    let { page = 0, size = 10 } = filter;
    const { query, search } = queryParams;

    page = parseInt(page);
    size = parseInt(size);

    let matchFilter = {};
    let sort = { createdAt: -1 };

    if (query) {
        let [key, value] = query.split("-");

        if (key === "code") {
            sort = { code: value === "asc" ? 1 : -1 };
        } else {
            if (key && value) {
                matchFilter[key] = value === "true";
            }
        }
    }

    if (search) {
        matchFilter["$or"] = [
            {
                code: { $regex: search, $options: "i" },
            },
        ];
    }

    const [vouchers, total] = await Promise.all([
        Voucher.aggregate([
            { $match: matchFilter },
            { $sort: sort },
            { $skip: page * size },
            { $limit: size },
        ]),
        Voucher.countDocuments(matchFilter),
    ]);

    return {
        vouchers,
        pagination: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const getVoucherByIdService = async (id) => {
    validateMongoDbId(id);

    const voucher = await Voucher.findById(id).select(
        "-updatedAt -__v -createdAt"
    );

    if (!voucher || voucher.deletedAt) {
        return null;
    }

    return voucher;
};

const createVoucherService = async (data) => {
    if (!data || !data.code) {
        throw new ErrorCustom("Thông tin voucher không hợp lệ.");
    }

    const exists = await Voucher.findOne({ code: data.code });
    if (exists) {
        throw new ErrorCustom("Mã voucher đã tồn tại.");
    }

    const newVoucher = await Voucher.create(data);
    return newVoucher;
};

const updateVoucherService = async (data) => {
    const { _id } = data;
    if (!_id) {
        throw new ErrorCustom("Thiếu ID voucher cần cập nhật.");
    }

    validateMongoDbId(_id);

    const updatedVoucher = await Voucher.findByIdAndUpdate(_id, data, {
        new: true,
    });

    if (!updatedVoucher) {
        throw new ErrorCustom("Không tìm thấy voucher để cập nhật.");
    }

    return updatedVoucher;
};

const deleteVoucherService = async (id) => {
    validateMongoDbId(id);

    const voucher = await Voucher.findById(id);
    if (!voucher) {
        throw new ErrorCustom("Không tìm thấy voucher");
    }

    await Voucher.deleteOne({ _id: id });

    return true;
};

const getVoucherByCodeService = async (code) => {
    if (!code) {
        throw new ErrorCustom("Mã giảm giá không hợp lệ!");
    }

    const voucher = await Voucher.findOne({ code }).select(
        "-updatedAt -__v -createdAt -isActive"
    );

    if (!voucher) {
        throw new ErrorCustom("Không tìm thấy voucher");
    }

    if (voucher.expireDate && new Date(voucher.expireDate) < new Date()) {
        throw new ErrorCustom("Voucher đã hết hạn");
    }

    if (!!voucher.count && voucher.count <= 0) {
        throw new ErrorCustom("Voucher đã hết lượt sử dụng");
    }

    const result = voucher.toObject();
    delete result.count;

    return result;
};

export {
    getAllVouchersService,
    getVoucherByIdService,
    createVoucherService,
    updateVoucherService,
    deleteVoucherService,
    getVoucherByCodeService,
};
