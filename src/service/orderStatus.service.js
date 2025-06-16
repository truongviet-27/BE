import OrderStatus from "../model/orderStatus.js";
import validateMongoDbId from "../utils/validateMongodbId.js";

const getAllOrderStatusService = async () => {
    const orderStatusList = await OrderStatus.find({ deletedAt: null });
    return orderStatusList;
};

const getOrderStatusByIdService = async (id) => {
    validateMongoDbId(id);
    const orderStatus = await OrderStatus.findById(id);
    return orderStatus;
};

const createOrderStatusService = async (data) => {
    const newOrderStatus = await OrderStatus.create(data);
    return newOrderStatus;
};

const updateOrderStatusService = async (id, updateData) => {
    validateMongoDbId(id);

    const updatedOrderStatus = await OrderStatus.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
    );

    return updatedOrderStatus;
};

const deleteOrderStatusService = async (id) => {
    validateMongoDbId(id);

    const orderStatus = await OrderStatus.findById(id);
    if (!orderStatus || orderStatus.deletedAt) {
        return { success: false, message: "Không tìm thấy trạng thái đơn hàng" };
    }

    await OrderStatus.deleteOne({ _id: id });

    return { success: true, message: "Xóa trạng thái đơn hàng thành công!" };
};

export {
    getAllOrderStatusService,
    getOrderStatusByIdService,
    createOrderStatusService,
    updateOrderStatusService,
    deleteOrderStatusService,
};
