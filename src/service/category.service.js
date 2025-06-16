import aqp from "api-query-params";
import Category from "../model/category.js";
import validateMongoDbId from "../utils/validateMongodbId.js";

const getAllCategoriesService = async (reqQuery) => {
    const { filter } = aqp(reqQuery);
    const { page = 0, size = 10 } = filter;

    const condition = { isActive: true };

    const [categories, total] = await Promise.all([
        Category.aggregate([
            { $match: condition },
            { $skip: page * size },
            { $limit: size },
        ]),
        Category.countDocuments(condition),
    ]);

    return {
        categories,
        pagination: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const getCategoryAdminService = async (reqQuery) => {
    const { filter } = aqp(reqQuery);
    const { page = 0, size = 10 } = filter;
    const { query, search } = reqQuery;

    let matchFilter = {};
    let sort = { createdAt: -1 };

    if (query) {
        const [key, value] = query.split("-");

        if (key === "name") {
            sort = { name: value === "asc" ? 1 : -1 };
        } else if (key && value) {
            matchFilter[key] = value === "true" ? true : false;
        }
    }

    if (search) {
        matchFilter["$or"] = [{ name: { $regex: search, $options: "i" } }];
    }

    const [categories, total] = await Promise.all([
        Category.aggregate([
            { $match: matchFilter },
            { $sort: sort },
            { $skip: page * size },
            { $limit: size },
        ]),
        Category.countDocuments(matchFilter),
    ]);

    return {
        categories,
        pagination: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const getCategoryByIdService = async (id) => {
    validateMongoDbId(id);

    const category = await Category.findById(id).select(
        "-updatedAt -__v -createdAt"
    );

    if (!category || category.deletedAt) {
        return null;
    }

    return category;
};

const createCategoryService = async (data) => {
    const newCategory = await Category.create(data);
    return newCategory;
};

const updateCategoryService = async (data) => {
    const { _id, ...updateData } = data;
    validateMongoDbId(_id);

    const updatedCategory = await Category.findByIdAndUpdate(_id, updateData, {
        new: true,
    });

    return updatedCategory;
};

const deleteCategoryService = async (id) => {
    validateMongoDbId(id);

    const category = await Category.findById(id);
    if (!category || category.deletedAt) {
        return { success: false, message: "Không tìm thấy danh mục" };
    }

    await Category.deleteOne({ _id: id });

    return { success: true, message: "Danh mục đã được xóa!" };
};

export {
    getAllCategoriesService,
    getCategoryAdminService,
    getCategoryByIdService,
    createCategoryService,
    updateCategoryService,
    deleteCategoryService,
};
