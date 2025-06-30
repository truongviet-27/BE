import aqp from "api-query-params";
import Brand from "../model/brand.js";
import validateMongoDbId from "../utils/validateMongodbId.js";

const getAllBrandsService = async ({ page, size }) => {
    const condition = { isActive: true };

    const [brands, total] = await Promise.all([
        Brand.aggregate([
            { $match: condition },
            { $skip: page * size },
            { $limit: size },
        ]),
        Brand.countDocuments(condition),
    ]);

    return {
        brands,
        pagination: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const getBrandByIdService = async (id) => {
    validateMongoDbId(id);

    const brand = await Brand.findById(id).select("-updatedAt -__v -createdAt");
    return brand;
};

const createBrandService = async ({ name, description }) => {
    const brand = await Brand.create({
        name,
        description,
        code: name.split(" ").join("").toUpperCase(),
    });
    return brand;
};

const updateBrandService = async (data) => {
    const { _id, ...updateData } = data;
    validateMongoDbId(_id);

    const brand = await Brand.findByIdAndUpdate(
        _id,
        {
            ...updateData,
            code: updateData.name.split(" ").join("").toUpperCase(),
        },
        { new: true }
    );

    return brand;
};

const deleteBrandService = async (id) => {
    validateMongoDbId(id);
    const brand = await Brand.findByIdAndDelete(id);
    return brand;
};

const getAllBrandAdminService = async (reqQuery) => {
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

    const [brands, total] = await Promise.all([
        Brand.aggregate([
            { $match: matchFilter },
            { $sort: sort },
            { $skip: page * size },
            { $limit: size },
        ]),
        Brand.countDocuments(matchFilter),
    ]);

    return {
        brands,
        pagination: {
            total,
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

export {
    getAllBrandsService,
    getBrandByIdService,
    createBrandService,
    updateBrandService,
    deleteBrandService,
    getAllBrandAdminService,
};
