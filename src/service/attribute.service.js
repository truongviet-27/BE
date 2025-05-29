import aqp from "api-query-params";
import Attribute from "../model/attribute.js";
import validateMongoDbId from "../utils/validateMongodbId.js";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import UserReviewAttribute from "../model/user_review_attribute.js";
import mongoose from "mongoose";

const getAttributesByProductAndSize = async (query) => {
    const { filter } = aqp(query);
    const { productId, size } = filter;

    validateMongoDbId(productId);

    const attributes = await Attribute.findOne({
        product: productId,
        size,
    });

    return attributes;
};

const getAttributeByIdService = async (id) => {
    validateMongoDbId(id);
    const attribute = await Attribute.findById(id);
    if (!attribute) {
        throw new ErrorCustom("Không tìm thấy thuộc tính với ID đã cho.");
    }

    return attribute;
};

const reviewAttributeService = async ({
    userId,
    rating,
    description,
    attributeId,
    orderDetailId,
    productId,
}) => {
    validateMongoDbId(userId);
    validateMongoDbId(attributeId);
    validateMongoDbId(orderDetailId);

    await UserReviewAttribute.create({
        user: userId,
        rating,
        description,
        attribute: attributeId,
        orderDetail: orderDetailId,
        product: productId,
    });
};

const getAllReviewsByProductIdService = async (
    productId,
    page = 0,
    size = 10
) => {
    validateMongoDbId(productId);

    page = parseInt(page);
    size = parseInt(size);

    const [reviews, total] = await Promise.all([
        UserReviewAttribute.aggregate([
            {
                $match: {
                    product: new mongoose.Types.ObjectId(productId),
                },
            },
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
                $lookup: {
                    from: "userdetails",
                    localField: "user._id",
                    foreignField: "userId",
                    as: "userDetail",
                },
            },
            {
                $unwind: {
                    path: "$userDetail",
                    preserveNullAndEmptyArrays: true,
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
                    localField: "product",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: "$product" },
            {
                $project: {
                    _id: 1,
                    comment: 1,
                    rating: 1,
                    description: 1,
                    createdAt: 1,
                    user: {
                        _id: "$user._id",
                        username: "$user.username",
                        avatar: "$userDetail.avatar",
                    },
                    attribute: {
                        _id: "$attribute._id",
                        size: "$attribute.size",
                    },
                    product: {
                        _id: "$product._id",
                        name: "$product.name",
                    },
                },
            },
            { $skip: page * size },
            { $limit: size },
        ]),
        UserReviewAttribute.countDocuments({ product: productId }),
    ]);

    return {
        reviews,
        pagination: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const getReviewByOrderDetailIdService = async (orderDetailId) => {
    validateMongoDbId(orderDetailId);

    const review = await UserReviewAttribute.findOne({
        orderDetail: orderDetailId,
    });

    if (!review) {
        throw new ErrorCustom("");
    }

    return review;
};

export {
    getAttributesByProductAndSize,
    getAttributeByIdService,
    reviewAttributeService,
    getAllReviewsByProductIdService,
    getReviewByOrderDetailIdService,
};
