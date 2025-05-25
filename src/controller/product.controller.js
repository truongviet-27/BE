import aqp from "api-query-params";
import mongoose from "mongoose";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import Product from "../model/product.js";
import Product_Category from "../model/product_category.js";
import ProductUserLike from "../model/product_user_like.js";
import {
    errorResponse400,
    errorResponse500,
    notFoundResponse,
    successResponse,
    successResponseList,
} from "../utils/responseHandler.js";
import validateMongoDbId from "../utils/validateMongodbId.js";
import Attribute from "../model/attribute.js";
import cloudinary from "../config/cloudinary.js";
import Image from "../model/image.js";
import getRecommendationsService from "../service/recomendation.service.js";

export const getAllProduct = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const { page, size, isActive, userId } = filter;
        let products = [];
        let result = [];

        products = await Product.aggregate([
            {
                $match: { isActive: isActive },
            },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: "brands",
                    localField: "brand",
                    foreignField: "_id",
                    as: "brand",
                },
            },

            {
                $unwind: {
                    path: "$brand",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "sales",
                    localField: "sale",
                    foreignField: "_id",
                    as: "sale",
                },
            },
            {
                $unwind: {
                    path: "$sale",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "product_categories",
                    localField: "_id",
                    foreignField: "product",
                    as: "productCategories",
                },
            },

            {
                $lookup: {
                    from: "categories",
                    localField: "productCategories.category",
                    foreignField: "_id",
                    as: "categories",
                },
            },
            {
                $lookup: {
                    from: "attributes",
                    let: { productId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$product", "$$productId"] },
                            },
                        },
                        {
                            $lookup: {
                                from: "orderdetails",
                                let: { attributeId: "$_id" },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $eq: [
                                                    "$attribute",
                                                    "$$attributeId",
                                                ],
                                            },
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
                                    {
                                        $unwind: {
                                            path: "$order",
                                            preserveNullAndEmptyArrays: false,
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
                                    {
                                        $unwind: {
                                            path: "$orderStatus",
                                            preserveNullAndEmptyArrays: false,
                                        },
                                    },
                                    {
                                        $match: {
                                            $expr: {
                                                $eq: [
                                                    "$orderStatus.code",
                                                    "DELIVERED",
                                                ],
                                            },
                                        },
                                    },
                                ],
                                as: "orders",
                            },
                        },
                        {
                            $addFields: {
                                sumOrder: { $sum: "$orders.quantity" },
                            },
                        },
                        {
                            $project: {
                                _id: 1,
                                price: 1,
                                size: 1,
                                stock: 1,
                                cache: 1,
                                sumOrder: 1,
                            },
                        },
                    ],
                    as: "attributes",
                },
            },
            {
                $lookup: {
                    from: "product_user_likes",
                    localField: "_id",
                    foreignField: "product",
                    as: "likeQuantity",
                },
            },
            {
                $lookup: {
                    from: "images",
                    localField: "_id",
                    foreignField: "product",
                    as: "imageUrls",
                },
            },
            {
                $lookup: {
                    from: "user_review_attributes",
                    localField: "_id",
                    foreignField: "product",
                    as: "reviews",
                },
            },
            {
                $skip: page * size,
            },
            {
                $limit: size,
            },
            {
                $project: {
                    name: 1,
                    code: 1,
                    rating: { $avg: "$reviews.rating" },
                    brand: {
                        _id: 1,
                        name: 1,
                    },
                    sale: {
                        _id: 1,
                        isActive: 1,
                        discount: 1,
                        description: 1,
                        name: 1,
                    },
                    view: 1,
                    categories: {
                        _id: 1,
                        name: 1,
                        code: 1,
                    },
                    attributes: {
                        _id: 1,
                        price: 1,
                        size: 1,
                        stock: 1,
                        cache: 1,
                        sumOrder: 1,
                    },
                    likeQuantity: {
                        _id: 1,
                    },
                    imageUrls: {
                        _id: 1,
                        url: 1,
                    },
                },
            },
        ]);
        if (userId !== "undefined") {
            const productUserLike = await ProductUserLike.find({
                user: userId,
            });

            result = products.map((product) => {
                const likedItem = productUserLike.find((item) => {
                    return item.product.equals(product._id);
                });
                return {
                    ...product,
                    liked: likedItem?.liked,
                    sumOrder: product.attributes.reduce((acc, cur) => {
                        return acc + cur.sumOrder;
                    }, 0),
                };
            });
        } else {
            result = products.map((product) => {
                return {
                    ...product,
                    sumOrder: product.attributes.reduce((acc, cur) => {
                        return acc + cur.sumOrder;
                    }, 0),
                };
            });
        }

        const total = await Product.countDocuments({ isActive: true });

        return successResponseList(
            res,
            "Lấy danh sách sản phẩm thành công!",
            result,
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

export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        validateMongoDbId(id);
        await Product.updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $inc: { view: 1 } }
        );
        const product = await Product.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(id),
                },
            },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: "brands",
                    localField: "brand",
                    foreignField: "_id",
                    as: "brand",
                },
            },
            {
                $unwind: {
                    path: "$brand",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "sales",
                    localField: "sale",
                    foreignField: "_id",
                    as: "sale",
                },
            },
            {
                $unwind: {
                    path: "$sale",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "product_categories",
                    localField: "_id",
                    foreignField: "product",
                    as: "product_categories",
                },
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "product_categories.category",
                    foreignField: "_id",
                    as: "categories",
                },
            },
            {
                $lookup: {
                    from: "attributes",
                    let: { productId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$product", "$$productId"] },
                            },
                        },
                        {
                            $lookup: {
                                from: "orderdetails",
                                let: { attributeId: "$_id" },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $eq: [
                                                    "$attribute",
                                                    "$$attributeId",
                                                ],
                                            },
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
                                    {
                                        $unwind: {
                                            path: "$order",
                                            preserveNullAndEmptyArrays: false,
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
                                    {
                                        $unwind: {
                                            path: "$orderStatus",
                                            preserveNullAndEmptyArrays: false,
                                        },
                                    },
                                    {
                                        $match: {
                                            $expr: {
                                                $eq: [
                                                    "$orderStatus.code",
                                                    "DELIVERED",
                                                ],
                                            },
                                        },
                                    },
                                ],
                                as: "orders",
                            },
                        },
                        {
                            $addFields: {
                                sumOrder: { $sum: "$orders.quantity" },
                            },
                        },
                        {
                            $project: {
                                _id: 1,
                                price: 1,
                                size: 1,
                                stock: 1,
                                cache: 1,
                                originPrice: 1,
                                sumOrder: 1,
                            },
                        },
                        {
                            $sort: { size: 1 },
                        },
                    ],
                    as: "attributes",
                },
            },
            {
                $lookup: {
                    from: "product_user_likes",
                    localField: "_id",
                    foreignField: "product",
                    as: "likeQuantity",
                },
            },
            {
                $lookup: {
                    from: "images",
                    localField: "_id",
                    foreignField: "product",
                    as: "imageUrls",
                },
            },
            {
                $lookup: {
                    from: "user_review_attributes",
                    localField: "_id",
                    foreignField: "product",
                    as: "reviews",
                },
            },
            {
                $project: {
                    _id: 1,
                    code: 1,
                    name: 1,
                    description: 1,
                    isActive: 1,
                    rating: { $avg: "$reviews.rating" },
                    brand: {
                        _id: 1,
                        name: 1,
                    },
                    sale: {
                        _id: 1,
                        name: 1,
                        discount: 1,
                    },
                    view: 1,
                    categories: {
                        _id: 1,
                        name: 1,
                    },
                    attributes: {
                        _id: 1,
                        originPrice: 1,
                        price: 1,
                        size: 1,
                        stock: 1,
                        cache: 1,
                        sumOrder: 1,
                    },
                    likeQuantity: {
                        _id: 1,
                    },
                    imageUrls: {
                        _id: 1,
                        url: 1,
                    },
                },
            },
        ]);

        if (!product || product.deletedAt) {
            return successResponse(res, "Không tìm thấy sản phẩm");
        }

        return successResponse(res, "Lấy sản phẩm thành công!", product[0]);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const createProduct = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let { categories, attributes, images, ...productData } = req.body;

        const newProduct = await Product.create([productData], { session });
        const product = newProduct[0];

        const urls = await Promise.all(
            images.map(async (base64) => {
                const result = await cloudinary.uploader.upload(base64, {
                    folder: "products",
                    transformation: [
                        {
                            width: 600,
                            height: 600,
                            crop: "limit",
                            quality: "auto",
                        },
                    ],
                });
                return {
                    url: result.secure_url,
                    name: result.original_filename,
                    product: product._id,
                    isActive: true,
                };
            })
        );

        if (urls && urls.length > 0) {
            await Image.insertMany(urls, { session });
        }

        if (Array.isArray(categories) && categories.length > 0) {
            const relations = categories.map((item) => ({
                category: item,
                product: product._id,
            }));

            await Product_Category.insertMany(relations, { session });
        }

        if (Array.isArray(attributes) && attributes.length > 0) {
            const relations = attributes.map((item) => ({
                originPrice: item.originPrice,
                price: item.price,
                size: item.size,
                stock: item.stock,
                cache: item.stock,
                product: product._id,
            }));

            await Attribute.insertMany(relations, { session });
        }

        await session.commitTransaction();
        session.endSession();

        return successResponse(res, "Tạo sản phẩm thành công!", true);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return errorResponse500(res, "Lỗi khi tạo sản phẩm", error.message);
    }
};

export const updateProduct = async (req, res) => {
    try {
        const {
            _id,
            categories, // category mới
            categoriesOld, // category cũ
            attributes,
            imageUrls, // ban đầu
            images, // đã xóa những ảnh ban đầu
            imagesNew, // những ảnh mới được thêm
            ...productData
        } = req.body;
        console.log("xxxxxxxxxxxxx1");

        const session = await mongoose.startSession();
        session.startTransaction();

        if (imagesNew && imagesNew.length > 0) {
            const result = await Promise.all(
                imagesNew.map(async (base64) => {
                    const result = await cloudinary.uploader.upload(base64, {
                        folder: "products",
                        transformation: [
                            {
                                width: 700,
                                height: 700,
                                crop: "limit",
                                quality: "auto",
                            },
                        ],
                    });
                    return {
                        url: result.secure_url,
                        name: result.original_filename,
                        product: _id,
                        isActive: true,
                    };
                })
            );

            if (result && result.length > 0) {
                await Image.insertMany(result, { session });
            }
        }

        if (images.length > 0) {
            for (const imageUrl of imageUrls) {
                const result = images.find(
                    (item) =>
                        JSON.stringify(item._id) == JSON.stringify(imageUrl._id)
                );

                if (result) {
                    await Image.updateOne(
                        {
                            _id: imageUrl._id,
                        },
                        {
                            ...result,
                        },
                        { session }
                    );
                } else {
                    await Image.deleteOne(
                        {
                            _id: imageUrl._id,
                        },
                        { session }
                    );
                }
            }
        } else {
        }

        console.log("xxxxxxxxxxxxx2");

        if (categories && categories.length > 0) {
            console.log(categoriesOld, "categoriesOld");
            if (categoriesOld && categoriesOld.length > 0) {
                if (categories.length > categoriesOld.length) {
                    for (const item of categories) {
                        const matchedCategory = categoriesOld.find(
                            (item2) =>
                                JSON.stringify(item2._id) ===
                                JSON.stringify(item._id)
                        );
                        console.log(matchedCategory, "matchedCategory");
                        if (matchedCategory) {
                            await Product_Category.updateOne(
                                { _id: item._id },
                                { ...item },
                                { session }
                            );
                        } else {
                            await Product_Category.create(
                                {
                                    category: item._id,
                                    product: _id,
                                },
                                { session }
                            );
                        }
                    }
                } else {
                    for (const item of categoriesOld) {
                        const matchedCategory = categories.find(
                            (item2) =>
                                JSON.stringify(item._id) ===
                                JSON.stringify(item2._id)
                        );
                        console.log(matchedCategory, "matchedCategory");
                        if (matchedCategory) {
                            await Product_Category.updateOne(
                                { _id: item._id },
                                { ...matchedCategory },
                                { session }
                            );
                        } else {
                            console.log(item, item._id, "xxxxxxxxxxxxxx");
                            await Product_Category.deleteOne(
                                { category: item._id, product: _id },
                                { session }
                            );
                        }
                    }
                }
            } else {
                const convertCategories = categories.map((item) => ({
                    category: item._id,
                    product: _id,
                }));
                await Product_Category.insertMany(convertCategories, {
                    session,
                });
            }
        }

        if (attributes && attributes.length > 0) {
            for (const item of attributes) {
                console.log(item, "attributeItem");
                const attribute = await Attribute.findOne({ _id: item._id });

                if (attribute) {
                    if (item.stock >= attribute.stock) {
                        await Attribute.updateOne(
                            { _id: item._id },
                            {
                                originPrice: item.originPrice,
                                price: item.price,
                                size: item.size,
                                stock: item.stock,
                                cache:
                                    attribute.cache +
                                    (item.stock - attribute.stock),
                                product: _id,
                            },
                            { session }
                        );
                    } else {
                        await Attribute.updateOne(
                            { _id: item._id },
                            {
                                originPrice: item.originPrice,
                                price: item.price,
                                size: item.size,
                                stock: item.stock,
                                cache: attribute.cache,
                                product: _id,
                            },
                            { session }
                        );
                    }
                } else {
                    await Attribute.create([{ ...item }], {
                        session,
                    });
                }
            }
        }

        console.log("xxxxxxxxxxxxx3");

        await Product.updateOne(
            {
                _id,
            },
            productData
        );

        console.log("xxxxxxxxxxxxx4");

        await session.commitTransaction();
        session.endSession();

        return successResponse(res, "Chỉnh sửa sản phẩm thành công!", true);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (validateMongoDbId(id)) {
            return successResponse(res, "Không tìm thấy sản phẩm");
        }

        const category = await Product.findById(id);
        if (!category || category.deletedAt) {
            return successResponse(res, "Không tìm thấy sản phẩm");
        }

        category.deletedAt = new Date();
        await category.save();

        return res.json({ success: true, message: "sản phẩm đã được xóa mềm" });
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getAllProductByBrand = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        let { page = 0, size = 10, brandId } = filter;
        const { query, search } = req.query;

        page = parseInt(page);
        size = parseInt(size);

        let matchFilter = {};
        matchFilter = {
            ...(brandId && mongoose.Types.ObjectId.isValid(brandId)
                ? { brand: new mongoose.Types.ObjectId(brandId) }
                : {}),
        };
        let sort = { createdAt: -1 };

        if (query) {
            let [key, value] = query.split("-");

            if (key === "name") {
                sort = { name: value === "asc" ? 1 : -1 };
            } else {
                if (key && value) {
                    matchFilter[key] = value === "true" ? true : false;
                }
            }
        }

        if (search) {
            matchFilter["$or"] = [
                { name: { $regex: search, $options: "i" } },
                { code: { $regex: search, $options: "i" } },
            ];
        }

        const result = await Product.aggregate([
            { $match: matchFilter },
            { $sort: sort },
            {
                $lookup: {
                    from: "brands",
                    localField: "brand",
                    foreignField: "_id",
                    as: "brand",
                },
            },
            {
                $unwind: {
                    path: "$brand",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "sales",
                    localField: "sale",
                    foreignField: "_id",
                    as: "sale",
                },
            },
            {
                $unwind: {
                    path: "$sale",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "product_categories",
                    localField: "_id",
                    foreignField: "product",
                    as: "productCategories",
                },
            },

            {
                $lookup: {
                    from: "categories",
                    localField: "productCategories.category",
                    foreignField: "_id",
                    as: "categories",
                },
            },
            {
                $lookup: {
                    from: "images",
                    localField: "_id",
                    foreignField: "product",
                    as: "imageUrls",
                },
            },
            {
                $lookup: {
                    from: "attributes",
                    localField: "_id",
                    foreignField: "product",
                    as: "attributes",
                },
            },
            {
                $addFields: {
                    totalStock: {
                        $sum: "$attributes.stock",
                    },
                },
            },
            {
                $addFields: {
                    totalCache: {
                        $sum: "$attributes.cache",
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    code: 1,
                    description: 1,
                    isActive: 1,
                    brand: {
                        _id: 1,
                        name: 1,
                        code: 1,
                    },
                    sale: {
                        _id: 1,
                        name: 1,
                        code: 1,
                    },
                    view: 1,
                    categories: {
                        _id: 1,
                        name: 1,
                        code: 1,
                    },
                    imageUrls: {
                        _id: 1,
                        url: 1,
                    },
                    totalStock: 1,
                    totalCache: 1,
                },
            },

            { $skip: page * size },
            { $limit: size },
        ]);

        const total = await Product.countDocuments(matchFilter);

        return successResponseList(
            res,
            "Lấy danh sách sản phẩm thành công!",
            result,
            {
                total,
                page,
                size,
                totalPages: Math.ceil(total / size),
            }
        );
    } catch (error) {
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const countProduct = async (req, res) => {
    try {
        const products = await Product.find({});

        return successResponse(res, "", products.length);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const searchByKeyword = async (req, res) => {
    try {
        let { page, size, isActive, userId, search } = req.query;
        let products = [];
        let result = [];
        let filter = {
            isActive: true,
        };

        console.log(typeof userId, userId, "userIdxxxxx");

        page = parseInt(page);
        size = parseInt(size);

        if (search) {
            filter["$or"] = [
                {
                    name: { $regex: search, $options: "i" },
                },
                {
                    code: { $regex: search, $options: "i" },
                },
            ];
        }

        console.log(filter, "filter");

        products = await Product.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: "brands",
                    localField: "brand",
                    foreignField: "_id",
                    as: "brand",
                },
            },
            {
                $unwind: {
                    path: "$brand",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "sales",
                    localField: "sale",
                    foreignField: "_id",
                    as: "sale",
                },
            },
            {
                $unwind: {
                    path: "$sale",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "product_categories",
                    localField: "_id",
                    foreignField: "product",
                    as: "productCategories",
                },
            },

            {
                $lookup: {
                    from: "categories",
                    localField: "productCategories.category",
                    foreignField: "_id",
                    as: "categories",
                },
            },
            {
                $lookup: {
                    from: "attributes",
                    localField: "_id",
                    foreignField: "product",
                    as: "attributes",
                },
            },
            {
                $lookup: {
                    from: "product_user_likes",
                    localField: "_id",
                    foreignField: "product",
                    as: "likeQuantity",
                },
            },
            {
                $match: filter,
            },
            {
                $skip: page * size,
            },
            {
                $limit: size,
            },
            {
                $match: filter,
            },
            {
                $project: {
                    name: 1,
                    code: 1,
                    brand: {
                        _id: 1,
                        name: 1,
                    },
                    sale: {
                        _id: 1,
                        isActive: 1,
                        discount: 1,
                        description: 1,
                        name: 1,
                    },
                    view: 1,
                    categories: {
                        _id: 1,
                        name: 1,
                        code: 1,
                    },
                    attributes: {
                        _id: 1,
                        price: 1,
                        size: 1,
                        stock: 1,
                        cache: 1,
                    },
                    likeQuantity: {
                        _id: 1,
                    },
                },
            },
        ]);

        if (userId == "undefined" || userId == "null") {
            result = products;
        } else {
            const productUserLike = await ProductUserLike.find({
                user: userId,
            });

            result = products.map((product) => {
                const likedItem = productUserLike.find((item) => {
                    return item.product.equals(product._id);
                });
                return {
                    ...product,
                    liked: likedItem?.liked,
                };
            });
        }

        const total = await Product.countDocuments(filter);

        return successResponseList(
            res,
            "Lấy danh sách sản phẩm thành công!",
            result,
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

export const getListHot = async (req, res) => {};

export const getRecommendationById = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const { productId = req.params.productId, page = 0, size = 5 } = filter;

        validateMongoDbId(productId);

        const result = await getRecommendationsService(
            productId,
            parseInt(page),
            parseInt(size)
        );
        return successResponseList(res, "", result.data, result.pagination);
    } catch (error) {
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const relateProduct = async (req, res) => {
    try {
        const { filter } = aqp(req.query);
        const {
            page,
            size,
            isActive = true,
            brandId,
            categoryId,
            id,
            userId,
        } = filter;
        let products = [];
        let result = [];

        products = await Product.aggregate([
            {
                $match: {
                    $and: [
                        { isActive },
                        ...(brandId
                            ? [{ brand: new mongoose.Types.ObjectId(brandId) }]
                            : []),
                        ...(categoryId
                            ? [{ "categories._id": categoryId }]
                            : []),
                    ],
                },
            },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: "brands",
                    localField: "brand",
                    foreignField: "_id",
                    as: "brand",
                },
            },
            {
                $unwind: {
                    path: "$brand",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "sales",
                    localField: "sale",
                    foreignField: "_id",
                    as: "sale",
                },
            },
            {
                $unwind: {
                    path: "$sale",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "product_categories",
                    localField: "_id",
                    foreignField: "product",
                    as: "productCategories",
                },
            },

            {
                $lookup: {
                    from: "categories",
                    localField: "productCategories.category",
                    foreignField: "_id",
                    as: "categories",
                },
            },
            {
                $lookup: {
                    from: "attributes",
                    localField: "_id",
                    foreignField: "product",
                    as: "attributes",
                },
            },
            {
                $lookup: {
                    from: "product_user_likes",
                    localField: "_id",
                    foreignField: "product",
                    as: "likeQuantity",
                },
            },

            {
                $skip: page * size,
            },
            {
                $limit: size,
            },
            {
                $project: {
                    name: 1,
                    code: 1,
                    brand: {
                        _id: 1,
                        name: 1,
                    },
                    sale: {
                        _id: 1,
                        discount: 1,
                    },
                    view: 1,
                    categories: {
                        _id: 1,
                        name: 1,
                    },
                    attributes: {
                        _id: 1,
                        price: 1,
                        size: 1,
                        stock: 1,
                    },
                    likeQuantity: {
                        _id: 1,
                    },
                },
            },
        ]);

        if (userId !== "undefined") {
            const productUserLike = await ProductUserLike.find({
                user: userId,
            });

            result = products.map((product) => {
                const likedItem = productUserLike.find((item) => {
                    return item.product.equals(product._id);
                });

                return {
                    ...product,
                    liked: likedItem?.liked,
                };
            });
        } else {
            result = products;
        }

        const total = await Product.countDocuments({
            $and: [
                { isActive },
                ...(brandId
                    ? [{ brand: new mongoose.Types.ObjectId(brandId) }]
                    : []),
                ...(categoryId ? [{ "categories._id": categoryId }] : []),
            ],
        });

        return successResponseList(
            res,
            "Lấy danh sách sản phẩm thành công!",
            result,
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

export const toggleLikeProduct = async (req, res) => {
    const userId = req.user._id;
    const { productId, liked } = req.query;

    validateMongoDbId(productId);

    try {
        let record = await ProductUserLike.findOne({
            user: userId,
            product: productId,
        });
        let productUserLike;

        if (!record) {
            productUserLike = await ProductUserLike.create({
                user: userId,
                product: productId,
                liked: true,
            });
        } else {
            await ProductUserLike.deleteOne({
                user: new mongoose.Types.ObjectId(userId),
                product: new mongoose.Types.ObjectId(productId),
            });
        }

        return successResponse(
            res,
            productUserLike?.liked
                ? "Yêu thích sản phẩm thành công!"
                : "Bỏ yêu thích sản phẩm thành công!"
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getAllProductWishList = async (req, res) => {
    try {
        const userId = req.user._id;
        const { filter } = aqp(req.query);
        const { page, size, isActive = true } = filter;

        const products = await Product.aggregate([
            {
                $match: { isActive: isActive },
            },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: "brands",
                    localField: "brand",
                    foreignField: "_id",
                    as: "brand",
                },
            },
            {
                $unwind: {
                    path: "$brand",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "sales",
                    localField: "sale",
                    foreignField: "_id",
                    as: "sale",
                },
            },
            {
                $unwind: {
                    path: "$sale",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "images",
                    localField: "_id",
                    foreignField: "product",
                    as: "imageUrls",
                },
            },
            {
                $skip: page * size,
            },
            {
                $limit: size,
            },
            {
                $project: {
                    _id: 1,
                    code: 1,
                    name: 1,
                    description: 1,
                    isActive: 1,
                    brand: {
                        _id: 1,
                        name: 1,
                        isActive: 1,
                    },
                    sale: {
                        _id: 1,
                        isActive: 1,
                        name: 1,
                    },
                    view: 21,
                    imageUrls: {
                        _id: 1,
                        url: 1,
                    },
                },
            },
        ]);

        const productUserLike = await ProductUserLike.find({
            user: userId,
        });

        const result = products.filter((product) => {
            return !!productUserLike.find((item) => {
                return item.product.equals(product._id) && item.liked;
            });
        });

        const total = await Product.countDocuments({ isActive: isActive });

        return successResponseList(
            res,
            "Lấy danh sách sản phẩm thành công!",
            result,
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

export const filterProducts = async (req, res) => {
    try {
        const { brandIds, categoryIds, max, min, size, page, userId } =
            req.body;

        console.log(typeof userId, "userIdxx");

        const brandIdsNew = brandIds.map(
            (id) => new mongoose.Types.ObjectId(id)
        );
        const categoryIdsNew = categoryIds.map(
            (id) => new mongoose.Types.ObjectId(id)
        );

        const filter = {};
        if (brandIdsNew.length > 0) {
            filter.brand = { $in: brandIdsNew };
        }
        const products = await Product.aggregate([
            {
                $match: filter,
            },
            {
                $lookup: {
                    from: "brands",
                    localField: "brand",
                    foreignField: "_id",
                    as: "brand",
                },
            },

            {
                $unwind: {
                    path: "$brand",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "sales",
                    localField: "sale",
                    foreignField: "_id",
                    as: "sale",
                },
            },
            {
                $unwind: {
                    path: "$sale",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "product_categories",
                    localField: "_id",
                    foreignField: "product",
                    as: "productCategories",
                },
            },

            {
                $lookup: {
                    from: "categories",
                    localField: "productCategories.category",
                    foreignField: "_id",
                    as: "categories",
                },
            },
            {
                $lookup: {
                    from: "attributes",
                    localField: "_id",
                    foreignField: "product",
                    as: "attributes",
                },
            },
            {
                $lookup: {
                    from: "product_user_likes",
                    localField: "_id",
                    foreignField: "product",
                    as: "likeQuantity",
                },
            },
            {
                $match: {
                    ...(categoryIdsNew.length > 0 && {
                        categories: {
                            $elemMatch: {
                                _id: { $in: categoryIdsNew },
                            },
                        },
                    }),
                    ...(min !== 0 &&
                        max !== 0 && {
                            attributes: {
                                $elemMatch: {
                                    price: { $gte: min, $lte: max },
                                },
                            },
                        }),
                },
            },
            {
                $skip: page * size,
            },
            {
                $limit: size,
            },
            {
                $project: {
                    name: 1,
                    code: 1,
                    brand: {
                        _id: 1,
                        name: 1,
                    },
                    sale: {
                        _id: 1,
                        isActive: 1,
                        discount: 1,
                        description: 1,
                        name: 1,
                    },
                    view: 1,
                    categories: {
                        _id: 1,
                        name: 1,
                        code: 1,
                    },
                    attributes: {
                        _id: 1,
                        price: 1,
                        size: 1,
                        stock: 1,
                        cache: 1,
                    },
                    likeQuantity: {
                        _id: 1,
                    },
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        let result = [];

        if (userId !== "undefined" || userId !== "null") {
            const productUserLike = await ProductUserLike.find({
                user: userId,
            });

            result = products.map((product) => {
                const likedItem = productUserLike.find((item) => {
                    return item.product.equals(product._id);
                });
                return {
                    ...product,
                    liked: likedItem?.liked,
                };
            });
        } else {
            result = products;
        }

        result = products.filter((product) =>
            product.attributes.every((attr) => {
                const finalPrice =
                    attr.price - (attr.price * product.sale.discount) / 100;

                const isMinValid = !!min ? finalPrice > min : true;
                const isMaxValid = !!max ? finalPrice < max : true;

                return isMinValid && isMaxValid;
            })
        );

        return successResponseList(res, "Lọc danh sách thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export const getAvgReviewProduct = async (req, res) => {
    try {
        db.products.aggregate([
            // Bước 1: Join với attributes
            {
                $lookup: {
                    from: "attributes",
                    localField: "_id",
                    foreignField: "productId",
                    as: "attributes",
                },
            },
            // Bước 2: Unwind attributes
            { $unwind: "$attributes" },

            // Bước 3: Join với user_review_attribute theo attributeId
            {
                $lookup: {
                    from: "user_review_attribute",
                    localField: "attributes._id",
                    foreignField: "attributeId",
                    as: "reviews",
                },
            },
            // Bước 4: Unwind reviews
            { $unwind: "$reviews" },

            // Bước 5: Nhóm lại theo attributeId để tính avgReviewAttribute
            {
                $group: {
                    _id: {
                        productId: "$_id",
                        attributeId: "$attributes._id",
                    },
                    avgReviewAttribute: { $avg: "$reviews.review" },
                },
            },

            // Bước 6: Nhóm lại theo productId để tính avgReviewProduct
            {
                $group: {
                    _id: "$_id.productId",
                    avgReviewProduct: { $avg: "$avgReviewAttribute" },
                },
            },

            // Bước 7: Join lại với products để lấy full thông tin sản phẩm
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: "$product" },

            // Bước 8: Merge kết quả
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: [
                            "$product",
                            { avgReviewProduct: "$avgReviewProduct" },
                        ],
                    },
                },
            },
        ]);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};
