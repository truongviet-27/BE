import { ErrorCustom } from "../helper/ErrorCustom.js";
import { getAllShipmentsService } from "../service/shipment.service.js";
import {
    errorResponse400,
    errorResponse500,
    successResponseList,
} from "../utils/responseHandler.js";

export const getAllShipments = async (req, res) => {
    try {
        const { isActive = true } = req.query;

        const shipments = await getAllShipmentsService(isActive);

        return successResponseList(
            res,
            "Lấy danh sách đơn vị vận chuyển thành công",
            shipments
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};
