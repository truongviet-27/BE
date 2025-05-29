import Sale from "../model/sale.js";

const getAllSaleService = async ({ page = 0, size = 10, isActive = true }) => {
    const matchFilter = { isActive };
    const sort = { createdAt: -1 };

    const [sales, total] = await Promise.all([
        Sale.aggregate([
            { $match: matchFilter },
            { $sort: sort },
            { $skip: page * size },
            { $limit: size },
        ]),
        Sale.countDocuments(matchFilter),
    ]);

    return { sales, total };
};

const getAllSaleAdminService = async ({
    page = 0,
    size = 10,
    query,
    search,
}) => {
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

    const [sales, total] = await Promise.all([
        Sale.aggregate([
            { $match: matchFilter },
            { $sort: sort },
            { $skip: page * size },
            { $limit: size },
        ]),
        Sale.countDocuments(matchFilter),
    ]);

    return {
        sales,
        pagination: {
            total,
            page: page,
            size: size,
            totalPages: Math.ceil(total / size),
        },
    };
};

export { getAllSaleService, getAllSaleAdminService };
