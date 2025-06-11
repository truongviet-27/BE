import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "../model/user.js";
import UserDetail from "../model/userDetail.js";
import {
    authenticationResponse,
    authorizationResponse,
    errorResponse400,
    errorResponse500,
} from "../utils/responseHandler.js";
dotenv.config();

const authMiddleware = async (req, res, next) => {
    const authHeader = req?.headers?.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return errorResponse400(res, "Vui lòng đặp nhập!");
    }

    const token = authHeader.split(" ")[1];

    try {
        const decodedUser = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({
            $and: [
                {
                    _id: decodedUser?.id,
                },
                {
                    isActive: true,
                },
            ],
        });

        if (!user) {
            return authenticationResponse(res, "Bạn đã hết phiên đăng nhập!");
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return authenticationResponse(res, "Bạn đã hết phiên đăng nhập!");
        }
        return errorResponse500(res, "Lỗi server!", error.message);
    }
};

const authIsManagerMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return errorResponse400(res, "Vui lòng đặp nhập!");
        }

        const token = authHeader.split(" ")[1];

        const decodedUser = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({
            $and: [
                {
                    _id: decodedUser?.id,
                },
                {
                    isActive: true,
                },
            ],
        });

        console.log(user, "userxxx");

        if (!user) {
            return authenticationResponse(res, "Bạn đã hết phiên đăng nhập!");
        }

        if (user.role !== "ADMIN" && user.role !== "MANAGER") {
            return authorizationResponse(res, "Bạn không có quyền truy cập");
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return authenticationResponse(res, "Bạn đã hết phiên đăng nhập!");
        }
        return errorResponse500(res, "Lỗi server!", error.message);
    }
};

const authIsAdminMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return errorResponse400(res, "Vui lòng đặp nhập!");
        }

        const token = authHeader.split(" ")[1];

        const decodedUser = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({
            $and: [
                {
                    _id: decodedUser?.id,
                },
                {
                    isActive: true,
                },
            ],
        });

        if (!user || !user.isActive) {
            return authenticationResponse(res, "Bạn đã hết phiên đăng nhập!");
        }

        if (user.role !== "ADMIN") {
            return authorizationResponse(res, "Bạn không có quyền truy cập");
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return authenticationResponse(res, "Bạn đã hết phiên đăng nhập!");
        }
        return errorResponse500(res, "Lỗi server!", error.message);
    }
};

export { authIsAdminMiddleware, authIsManagerMiddleware, authMiddleware };
