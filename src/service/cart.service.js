import mongoose from "mongoose";
import CartItem from "../model/cartItem.js";
import Attribute from "../model/attribute.js";
import { ErrorCustom } from "../helper/ErrorCustom.js";

const modifyCartItemFromNotUserFromDetailService = async (
    user,
    cartsNotUser
) => {
    try {
        for (const item of cartsNotUser) {
            const cartAttribute = await CartItem.findOne({
                userId: user._id,
                attributeId: new mongoose.Types.ObjectId(item.attributeId),
                isActive: true,
            });

            if (!cartAttribute) {
                await CartItem.create({
                    userId: user._id,
                    attributeId: item.attributeId,
                    quantity: item.quantity,
                    lastPrice: item.lastPrice,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                return {
                    success: true,
                    message: "Đã thêm vào giỏ hàng",
                    data: true,
                };
            } else {
                const attribute = await Attribute.findById(item.attributeId);
                const newQuantity = cartAttribute.quantity + item.quantity;

                if (newQuantity > attribute.stock) {
                    await CartItem.findByIdAndUpdate(cartAttribute._id, {
                        $set: {
                            quantity: attribute.stock,
                            updatedAt: new Date(),
                        },
                    });
                    return {
                        success: true,
                        message:
                            "Số lượng vượt quá tồn kho, đã cập nhật số lượng tối đa",
                        data: null,
                    };
                }

                await CartItem.findByIdAndUpdate(cartAttribute._id, {
                    $set: {
                        quantity: newQuantity,
                        updatedAt: new Date(),
                    },
                });

                return {
                    success: true,
                    message: "Cập nhật số lượng thành công",
                    data: null,
                };
            }
        }
    } catch (error) {
        throw new ErrorCustom(error.message);
    }
};

const isEnoughCartItemService = async (user, filter) => {
    const { id, quantity } = filter;

    const cartAttribute = await CartItem.findOne({
        userId: user._id,
        attributeId: new mongoose.Types.ObjectId(id),
        isActive: true,
    });

    const attribute = await Attribute.findOne({
        _id: new mongoose.Types.ObjectId(id),
    });

    if (!cartAttribute) {
        if (attribute.stock >= quantity) {
            return {
                success: true,
                message: "",
                data: null,
            };
        }
        return {
            success: false,
            message: "Vượt quá số lượng!",
            data: null,
        };
    }

    if (!attribute) {
        return {
            success: false,
            message: "Không tìm thấy sản phẩm nào!",
            data: null,
        };
    }

    return {
        success: true,
        message: "",
        data: true,
    };
};

export { modifyCartItemFromNotUserFromDetailService, isEnoughCartItemService };
