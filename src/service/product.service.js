import aqp from "api-query-params";
import Product from "../model/product.js";
import ProductUserLike from "../model/product_user_like.js";
import mongoose from "mongoose";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import Attribute from "../model/attribute.js";
import Product_Category from "../model/product_category.js";
import cloudinary from "../config/cloudinary.js";
import validateMongoDbId from "../utils/validateMongodbId.js";
import Image from "../model/image.js";

const getAllProductService = async (query) => {
    const { filter } = aqp(query);
    const { page = 0, size = 10, isActive = true, userId } = filter;

    const match = { isActive };
    const skip = page * size;
    const limit = size;

    const pipeline = [
        { $match: match },
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
        { $skip: skip },
        { $limit: limit },
        {
            $project: {
                name: 1,
                code: 1,
                rating: { $avg: "$reviews.rating" },
                brand: { _id: 1, name: 1 },
                sale: { _id: 1, isActive: 1, discount: 1, name: 1 },
                view: 1,
                categories: { _id: 1, name: 1, code: 1 },
                attributes: {
                    _id: 1,
                    price: 1,
                    size: 1,
                    stock: 1,
                    cache: 1,
                    sumOrder: 1,
                },
                likeQuantity: { _id: 1 },
                imageUrls: { _id: 1, url: 1 },
            },
        },
    ];

    let products = await Product.aggregate(pipeline);

    let result = [];

    if (userId && userId !== "undefined") {
        const likes = await ProductUserLike.find({ user: userId });
        result = products.map((product) => {
            const liked = likes.find((item) =>
                item.product.equals(product._id)
            );
            return {
                ...product,
                liked: liked?.liked || false,
                sumOrder: product.attributes.reduce(
                    (acc, cur) => acc + cur.sumOrder,
                    0
                ),
            };
        });
    } else {
        result = products.map((product) => ({
            ...product,
            sumOrder: product.attributes.reduce(
                (acc, cur) => acc + cur.sumOrder,
                0
            ),
        }));
    }

    const total = await Product.countDocuments(match);

    return {
        data: result,
        meta: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const getProductDetailService = async (id) => {
    const objectId = new mongoose.Types.ObjectId(id);

    await Product.updateOne({ _id: objectId }, { $inc: { view: 1 } });

    const product = await Product.aggregate([
        { $match: { _id: objectId } },
        { $sort: { createdAt: -1 } },
        {
            $lookup: {
                from: "brands",
                localField: "brand",
                foreignField: "_id",
                as: "brand",
            },
        },
        { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "sales",
                localField: "sale",
                foreignField: "_id",
                as: "sale",
            },
        },
        { $unwind: { path: "$sale", preserveNullAndEmptyArrays: true } },
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
                    { $sort: { size: 1 } },
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
                brand: { _id: 1, name: 1 },
                sale: { _id: 1, name: 1, discount: 1 },
                view: 1,
                categories: { _id: 1, name: 1 },
                attributes: {
                    _id: 1,
                    originPrice: 1,
                    price: 1,
                    size: 1,
                    stock: 1,
                    cache: 1,
                    sumOrder: 1,
                },
                likeQuantity: { _id: 1 },
                imageUrls: { _id: 1, url: 1 },
            },
        },
    ]);

    return product[0] || null;
};

const createProductService = async (data) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { categories, attributes, images, ...productData } = data;

        const [product] = await Product.create([productData], { session });

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

        if (urls.length > 0) {
            await Image.insertMany(urls, { session });
        }

        if (Array.isArray(categories) && categories.length > 0) {
            const categoryRelations = categories.map((item) => ({
                category: item,
                product: product._id,
            }));
            await Product_Category.insertMany(categoryRelations, { session });
        }

        if (Array.isArray(attributes) && attributes.length > 0) {
            const attributeDocs = attributes.map((item) => ({
                originPrice: item.originPrice,
                price: item.price,
                size: item.size,
                stock: item.stock,
                cache: item.stock,
                product: product._id,
            }));
            await Attribute.insertMany(attributeDocs, { session });
        }

        await session.commitTransaction();
        session.endSession();

        return true;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw new ErrorCustom("Lỗi khi tạo sản phẩm " + err.message);
    }
};

const updateProductService = async (data) => {
    const {
        _id,
        categories,
        categoriesOld,
        attributes,
        imageUrls,
        images,
        imagesNew,
        ...productData
    } = data;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (imagesNew?.length > 0) {
            const uploaded = await Promise.all(
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
            if (uploaded.length > 0) {
                await Image.insertMany(uploaded, { session });
            }
        }

        for (const imageUrl of imageUrls || []) {
            const stillExists = images.find((img) => img._id === imageUrl._id);
            if (stillExists) {
                await Image.updateOne(
                    { _id: imageUrl._id },
                    { ...stillExists },
                    { session }
                );
            } else {
                await Image.deleteOne({ _id: imageUrl._id }, { session });
            }
        }

        if (Array.isArray(categories)) {
            if (Array.isArray(categoriesOld) && categoriesOld.length > 0) {
                for (const item of categories) {
                    const found = categoriesOld.find((c) => c._id === item._id);
                    if (found) {
                        await Product_Category.updateOne(
                            { _id: item._id },
                            item,
                            { session }
                        );
                    } else {
                        await Product_Category.create(
                            [{ category: item._id, product: _id }],
                            { session }
                        );
                    }
                }

                for (const item of categoriesOld) {
                    const exists = categories.find((c) => c._id === item._id);
                    if (!exists) {
                        await Product_Category.deleteOne(
                            { category: item._id, product: _id },
                            { session }
                        );
                    }
                }
            } else {
                const newLinks = categories.map((c) => ({
                    category: c._id,
                    product: _id,
                }));
                await Product_Category.insertMany(newLinks, { session });
            }
        }

        for (const attr of attributes || []) {
            const found = await Attribute.findById(attr._id);
            if (found) {
                const cache =
                    attr.stock >= found.stock
                        ? found.cache + (attr.stock - found.stock)
                        : found.cache;

                await Attribute.updateOne(
                    { _id: attr._id },
                    {
                        ...attr,
                        cache,
                        product: _id,
                    },
                    { session }
                );
            } else {
                await Attribute.create([{ ...attr }], { session });
            }
        }

        await Product.updateOne({ _id }, productData, { session });

        await session.commitTransaction();
        session.endSession();

        return true;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw new ErrorCustom("Cập nhật sản phẩm thất bại");
    }
};

const deleteProductService = async (id) => {
    validateMongoDbId(id);

    const deleted = await Product.findByIdAndDelete({
        _id: new mongoose.Types.ObjectId(id),
    });

    return deleted;
};

const getAllProductByBrandService = async (queryParams) => {
    const { filter } = aqp(queryParams);
    let { page = 0, size = 10, brandId } = filter;
    const { query, search } = queryParams;

    page = parseInt(page);
    size = parseInt(size);

    let matchFilter = {};

    if (brandId && mongoose.Types.ObjectId.isValid(brandId)) {
        matchFilter.brand = new mongoose.Types.ObjectId(brandId);
    }

    let sort = { createdAt: -1 };

    if (query) {
        let [key, value] = query.split("-");

        if (key === "name") {
            sort = { name: value === "asc" ? 1 : -1 };
        } else if (key && value) {
            matchFilter[key] = value === "true";
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
        { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "sales",
                localField: "sale",
                foreignField: "_id",
                as: "sale",
            },
        },
        { $unwind: { path: "$sale", preserveNullAndEmptyArrays: true } },
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
                totalStock: { $sum: "$attributes.stock" },
                totalCache: { $sum: "$attributes.cache" },
            },
        },
        {
            $project: {
                _id: 1,
                name: 1,
                code: 1,
                description: 1,
                isActive: 1,
                brand: { _id: 1, name: 1, code: 1 },
                sale: { _id: 1, name: 1, code: 1 },
                view: 1,
                categories: { _id: 1, name: 1, code: 1 },
                imageUrls: { _id: 1, url: 1 },
                totalStock: 1,
                totalCache: 1,
            },
        },
        { $skip: page * size },
        { $limit: size },
    ]);

    const total = await Product.countDocuments(matchFilter);

    return {
        result,
        pagination: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const countProductService = async () => {
    const count = await Product.countDocuments();
    return count;
};

const searchByKeywordService = async (query) => {
    let { page = 0, size = 10, userId, search } = query;

    page = parseInt(page);
    size = parseInt(size);

    const filter = { isActive: true };

    if (search) {
        filter["$or"] = [
            { name: { $regex: search, $options: "i" } },
            { code: { $regex: search, $options: "i" } },
        ];
    }

    const aggregationPipeline = [
        { $sort: { createdAt: -1 } },
        {
            $lookup: {
                from: "brands",
                localField: "brand",
                foreignField: "_id",
                as: "brand",
            },
        },
        { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "sales",
                localField: "sale",
                foreignField: "_id",
                as: "sale",
            },
        },
        { $unwind: { path: "$sale", preserveNullAndEmptyArrays: true } },
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
        { $match: filter },
        { $skip: page * size },
        { $limit: size },
        {
            $project: {
                _id: 1,
                name: 1,
                code: 1,
                brand: { _id: 1, name: 1 },
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
                likeQuantity: { _id: 1 },
            },
        },
    ];

    const products = await Product.aggregate(aggregationPipeline);

    let result = products;

    if (mongoose.Types.ObjectId.isValid(userId)) {
        const productUserLike = await ProductUserLike.find({ user: userId });

        result = products.map((product) => {
            const likedItem = productUserLike.find((item) =>
                item.product.equals(product._id)
            );
            return {
                ...product,
                liked: likedItem?.liked || false,
            };
        });
    }

    const total = await Product.countDocuments(filter);

    return {
        result,
        pagination: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const getRelatedProductsService = async ({
    page = 0,
    size = 10,
    isActive = true,
    brandId,
    categoryId,
    userId,
}) => {
    const matchConditions = [
        { isActive },
        ...(brandId ? [{ brand: new mongoose.Types.ObjectId(brandId) }] : []),
        ...(categoryId ? [{ "categories._id": categoryId }] : []),
    ];

    const products = await Product.aggregate([
        { $match: { $and: matchConditions } },
        { $sort: { createdAt: -1 } },
        {
            $lookup: {
                from: "user_review_attributes",
                localField: "_id",
                foreignField: "product",
                as: "reviews",
            },
        },
        { $unwind: { path: "$reviews", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "brands",
                localField: "brand",
                foreignField: "_id",
                as: "brand",
            },
        },
        { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "sales",
                localField: "sale",
                foreignField: "_id",
                as: "sale",
            },
        },
        { $unwind: { path: "$sale", preserveNullAndEmptyArrays: true } },
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
                                    $match: {
                                        "orderStatus.code": "DELIVERED",
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
                from: "images",
                localField: "_id",
                foreignField: "product",
                as: "imageUrls",
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
        { $skip: page * size },
        { $limit: size },
        {
            $project: {
                name: 1,
                code: 1,
                brand: { _id: 1, name: 1 },
                sale: { _id: 1, discount: 1 },
                view: 1,
                categories: { _id: 1, name: 1 },
                attributes: {
                    _id: 1,
                    price: 1,
                    size: 1,
                    stock: 1,
                    sumOrder: 1,
                },
                likeQuantity: { _id: 1 },
                imageUrls: { _id: 1, url: 1 },
                rating: { $avg: "$reviews.rating" },
            },
        },
    ]);

    // Like status và tổng số đơn
    let finalResult = [];
    if (userId !== "undefined") {
        const likedList = await ProductUserLike.find({ user: userId });
        finalResult = products.map((product) => {
            const likedItem = likedList.find((item) =>
                item.product.equals(product._id)
            );
            return {
                ...product,
                liked: likedItem?.liked,
                sumOrder: product.attributes.reduce(
                    (acc, cur) => acc + (cur.sumOrder || 0),
                    0
                ),
            };
        });
    } else {
        finalResult = products.map((product) => ({
            ...product,
            sumOrder: product.attributes.reduce(
                (acc, cur) => acc + (cur.sumOrder || 0),
                0
            ),
        }));
    }

    const total = await Product.countDocuments({ $and: matchConditions });

    return {
        products: finalResult,
        pagination: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const toggleProductLikeService = async (userId, productId) => {
    validateMongoDbId(productId);

    const existing = await ProductUserLike.findOne({
        user: userId,
        product: productId,
    });

    let liked = false;

    if (!existing) {
        await ProductUserLike.create({
            user: userId,
            product: productId,
            liked: true,
        });
        liked = true;
    } else {
        await ProductUserLike.deleteOne({
            user: new mongoose.Types.ObjectId(userId),
            product: new mongoose.Types.ObjectId(productId),
        });
        liked = false;
    }

    return liked;
};

const getWishlistProductsService = async (
    userId,
    { page = 0, size = 10, isActive = true }
) => {
    const products = await Product.aggregate([
        { $match: { isActive } },
        { $sort: { createdAt: -1 } },
        {
            $lookup: {
                from: "brands",
                localField: "brand",
                foreignField: "_id",
                as: "brand",
            },
        },
        { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "sales",
                localField: "sale",
                foreignField: "_id",
                as: "sale",
            },
        },
        { $unwind: { path: "$sale", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "images",
                localField: "_id",
                foreignField: "product",
                as: "imageUrls",
            },
        },
        { $skip: page * size },
        { $limit: size },
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
                view: 1,
                imageUrls: {
                    _id: 1,
                    url: 1,
                },
            },
        },
    ]);

    const productUserLike = await ProductUserLike.find({ user: userId });

    const likedProducts = products.filter((product) =>
        productUserLike.some(
            (item) => item.product.equals(product._id) && item.liked
        )
    );

    const total = await Product.countDocuments({ isActive });

    return {
        products: likedProducts,
        pagination: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const filterProductsService = async ({
    brandIds = [],
    categoryIds = [],
    max = 0,
    min = 0,
    size = 10,
    page = 0,
    userId = null,
}) => {
    const brandIdsNew = brandIds.map((id) => new mongoose.Types.ObjectId(id));
    const categoryIdsNew = categoryIds.map(
        (id) => new mongoose.Types.ObjectId(id)
    );

    const filter = {};
    if (brandIdsNew.length > 0) {
        filter.brand = { $in: brandIdsNew };
    }

    const products = await Product.aggregate([
        { $match: filter },
        {
            $lookup: {
                from: "brands",
                localField: "brand",
                foreignField: "_id",
                as: "brand",
            },
        },
        { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "sales",
                localField: "sale",
                foreignField: "_id",
                as: "sale",
            },
        },
        { $unwind: { path: "$sale", preserveNullAndEmptyArrays: true } },
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
        { $skip: page * size },
        { $limit: size },
        {
            $project: {
                name: 1,
                code: 1,
                brand: { _id: 1, name: 1 },
                sale: {
                    _id: 1,
                    isActive: 1,
                    discount: 1,
                    description: 1,
                    name: 1,
                },
                view: 1,
                categories: { _id: 1, name: 1, code: 1 },
                attributes: {
                    _id: 1,
                    price: 1,
                    size: 1,
                    stock: 1,
                    cache: 1,
                },
                likeQuantity: { _id: 1 },
            },
        },
        { $sort: { createdAt: -1 } },
    ]);

    let result = [];

    if (userId && userId !== "undefined" && userId !== "null") {
        const productUserLike = await ProductUserLike.find({ user: userId });

        result = products.map((product) => {
            const likedItem = productUserLike.find((item) =>
                item.product.equals(product._id)
            );
            return {
                ...product,
                liked: likedItem?.liked || false,
            };
        });
    } else {
        result = products;
    }

    result = result.filter((product) =>
        product.attributes.every((attr) => {
            const discount = product.sale?.discount || 0;
            const finalPrice = attr.price - (attr.price * discount) / 100;

            const isMinValid = min ? finalPrice > min : true;
            const isMaxValid = max ? finalPrice < max : true;

            return isMinValid && isMaxValid;
        })
    );

    return result;
};

const getAvgReviewProductService = async () => {
    const result = await Product.aggregate([
        {
            $lookup: {
                from: "attributes",
                localField: "_id",
                foreignField: "product",
                as: "attributes",
            },
        },
        { $unwind: "$attributes" },
        {
            $lookup: {
                from: "user_review_attributes",
                localField: "attributes._id",
                foreignField: "attribute",
                as: "reviews",
            },
        },
        { $unwind: "$reviews" },
        {
            $group: {
                _id: {
                    productId: "$_id",
                    attributeId: "$attributes._id",
                },
                avgReviewAttribute: { $avg: "$reviews.review" },
            },
        },
        {
            $group: {
                _id: "$_id.productId",
                avgReviewProduct: { $avg: "$avgReviewAttribute" },
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
        { $unwind: "$product" },
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

    return result;
};

export {
    getAllProductService,
    getProductDetailService,
    createProductService,
    updateProductService,
    deleteProductService,
    getAllProductByBrandService,
    countProductService,
    searchByKeywordService,
    getRelatedProductsService,
    toggleProductLikeService,
    getWishlistProductsService,
    filterProductsService,
    getAvgReviewProductService,
};
