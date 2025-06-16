import { ErrorCustom } from "../helper/ErrorCustom.js";
import {
    countAccountService,
    createAccountService,
    createUserService,
    deleteUserByIdService,
    getAccountByRoleService,
    getAllUserService,
    getUserByIdService,
    getUserDetailService,
    updateAccountByRoleAdminService,
    updateUserByIdService,
} from "../service/user.service.js";
import {
    errorResponse400,
    errorResponse500,
    successResponse,
    successResponseList,
} from "../utils/responseHandler.js";

const createUser = async (req, res) => {
    try {
        await createUserService(req.body);
        return successResponse(res, "Tạo người dùng thành công!");
    } catch (error) {
        if (!error.success) {
            return errorResponse400(res, error.message);
        }
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getAllUser = async (req, res) => {
    try {
        const { role } = req.user;
        const { query, filter, search, page = 0, size = 10 } = req.query;

        const { users, total, pagination } = await getAllUserService({
            role,
            query,
            filter,
            search,
            page: +page,
            size: +size,
        });

        return successResponseList(
            res,
            "Lấy danh sách người dùng thành công",
            users,
            {
                total,
                ...pagination,
            }
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await getUserByIdService(id);

        return successResponse(
            res,
            "Lấy thông tin người dùng thành công",
            result
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(
                res,
                error.message,
                null,
                error.statusCode || 400
            );
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getUserDetail = async (req, res) => {
    try {
        const user = req.user;
        const result = await getUserDetailService(user);

        return successResponse(
            res,
            "Lấy thông tin người dùng thành công",
            result
        );
    } catch (error) {
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const deleteUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await deleteUserByIdService(id);

        return successResponse(res, "Xoá người dùng thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateUserById = async (req, res) => {
    try {
        const result = await updateUserByIdService(req.body);
        return successResponse(res, "Cập nhật người dùng thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateAccountByRoleAdmin = async (req, res) => {
    try {
        const result = await updateAccountByRoleAdminService(req.body);
        return successResponse(res, "Cập nhật tài khoản thành công!", result);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const createAccount = async (req, res) => {
    try {
        await createAccountService(req.body);
        return successResponse(res, "Tạo người dùng thành công!");
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const countAccount = async (req, res) => {
    try {
        const { role } = req.user;
        const total = await countAccountService(role);
        return successResponse(res, "Đếm tài khoản thành công", total);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getAccountByRole = async (req, res) => {
    try {
        const { page = 0, size = 10, roleName, isActive } = req.query;

        const isActiveBoolean =
            isActive === "true"
                ? true
                : isActive === "false"
                ? false
                : undefined;

        const result = await getAccountByRoleService({
            page,
            size,
            roleName,
            isActive: isActiveBoolean,
        });

        return successResponseList(
            res,
            "Lấy danh sách người dùng thành công!",
            result.users,
            result.pagination
        );
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export {
    countAccount,
    createAccount,
    createUser,
    deleteUserById,
    getAccountByRole,
    getAllUser,
    getUserById,
    getUserDetail,
    updateAccountByRoleAdmin,
    updateUserById,
};
