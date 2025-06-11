import aqp from "api-query-params";
import { generateToken } from "../config/jwtToken.js";
import transporter from "../config/nodeMailer.js";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import User from "../model/user.js";
import {
    errorResponse400,
    errorResponse500,
    successResponse,
    successResponseList,
} from "../utils/responseHandler.js";
import validateMongoDbId from "../utils/validateMongodbId.js";
import bcrypt from "bcrypt";
import UserDetail from "../model/userDetail.js";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";

const createUser = async (req, res) => {
    const { username, password, email, avatar } = req.body;

    let result;
    try {
        result = await cloudinary.uploader.upload(avatar, {
            folder: "users",
        });
    } catch (err) {
        return errorResponse500(res, "Lỗi khi upload avatar", err.message);
    }
    try {
        const session = await mongoose.startSession();
        session.startTransaction();

        const existingUser = await UserDetail.findOne({
            email,
            username,
        }).session(session);
        if (existingUser) {
            await session.abortTransaction();
            session.endSession();
            return errorResponse400(res, "Người dùng đã tồn tại");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            ...req.body,
            password: hashedPassword,
        });

        await user.save({ session });

        const userDetail = new UserDetail({
            ...req.body,
            avatar: result.secure_url,
            userId: user._id,
        });

        await userDetail.save({ session });

        await session.commitTransaction();
        session.endSession();

        const mailOptions = {
            from: process.env.MAIL_USERNAME,
            to: email,
            subject: "Chào mừng tới với cửa hàng ShoeFast",
            text: `Chào mừng tới với cửa hàng ShoeFast. User name vừa được tạo mới là: ${username}`,
        };

        await transporter.sendMail(mailOptions);

        return successResponse(res, "Tạo người dùng thành công!");
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error("Tạo user thất bại:", error);
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getAllUser = async (req, res) => {
    try {
        const { role } = req.user;
        let { page = 0, size = 10, search, query, filter } = req.query;

        console.log(role, "userxxxx");

        let matchFilter = {};
        let sort = { createdAt: -1 };

        if (filter) {
            if (filter !== "ALL") {
                matchFilter.role = filter;
            } else {
                if (role === "MANAGER") {
                    matchFilter.role = {
                        $ne: "ADMIN",
                    };
                }
            }
        }
        if (query) {
            let [key, value] = query.split("-");

            if (key === "username") {
                sort = { username: value === "asc" ? 1 : -1 };
            } else {
                if (key && value) {
                    matchFilter[key] = value === "true" ? true : false;
                }
            }
        }

        if (search) {
            matchFilter["$or"] = [
                { email: { $regex: search, $options: "i" } },
                { username: { $regex: search, $options: "i" } },
                { fullName: { $regex: search, $options: "i" } },
            ];
        }

        const [users, total] = await Promise.all([
            User.aggregate([
                {
                    $match: matchFilter,
                },
                { $sort: sort },

                {
                    $lookup: {
                        from: "userdetails",
                        localField: "_id",
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
                    $project: {
                        _id: 1,
                        email: 1,
                        username: 1,
                        role: 1,
                        isActive: 1,
                        userDetail: {
                            _id: 1,
                            birthday: 1,
                            avatar: 1,
                            fullName: 1,
                            phone: 1,
                            gender: 1,
                            address: 1,
                        },
                    },
                },
                { $skip: +page * +size },
                { $limit: +size },
            ]),
            User.countDocuments(matchFilter),
        ]);

        return successResponseList(
            res,
            "Lấy danh sách người dùng thành công",
            users,
            {
                total,
                page,
                size,
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

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        validateMongoDbId(id);
        const user = await User.findOne({
            _id: id,
        }).select(
            "-updatedAt -__v -createdAt -verifyOtp -verifyOtpExpireAt -resetOtp -resetOtpExpireAt -isAccountVerified -password"
        );

        const userDetail = await UserDetail.findOne({
            userId: id,
        }).select("-updatedAt -__v -createdAt");

        const {
            _id,
            email,
            username,
            avatar,
            fullName,
            phone,
            gender,
            address,
            birthday,
        } = userDetail;

        if (!user) {
            return errorResponse500(res, "Người dùng không tồn tại", null, 404);
        }

        return successResponse(res, "Lấy thông tin người dùng thành công", {
            ...user.toObject(),
            email,
            username,
            avatar,
            fullName,
            phone,
            gender,
            address,
            birthday,
            _id: userDetail._id,
            userId: user.toObject()._id,
            role: user.role,
        });
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getUserDetail = async (req, res) => {
    const user = req.user;

    return successResponse(res, "Lấy thông tin người dùng thành công", user);
};

const deleteUserById = async (req, res) => {
    try {
        const { id } = req.params;
        validateMongoDbId(id);
        const deleteUserById = await User.findOneAndDelete({
            _id: id,
        });
        const deleteUserDetailById = await UserDetail.findOneAndDelete({
            userId: id,
        });

        if (deleteUserById && deleteUserDetailById) {
            return successResponse(res, "Thành công!", true);
        } else {
            return errorResponse400(res, "Người dùng không tồn tại!", false);
        }
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateUserById = async (req, res) => {
    try {
        const { isActive, avatar, ...rest } = req.body;
        let result;
        let avatarUrl = avatar;

        // Chỉ upload nếu là base64
        if (avatar && avatar.startsWith("data:image")) {
            try {
                result = await cloudinary.uploader.upload(avatar, {
                    folder: "users",
                });
                avatarUrl = result.secure_url;
            } catch (err) {
                return errorResponse500(
                    res,
                    "Lỗi khi upload avatar",
                    err.message
                );
            }
        }

        const [updateUserDetail, updateUser] = await Promise.all([
            UserDetail.findByIdAndUpdate(
                {
                    _id: new mongoose.Types.ObjectId(req.body._id),
                },
                {
                    ...rest,
                    avatar: avatarUrl,
                },
                { upsert: true }
            ),
            User.findByIdAndUpdate(
                {
                    _id: new mongoose.Types.ObjectId(req.body.userId),
                },
                {
                    email: req.body.email,
                    isActive: isActive,
                },
                { upsert: true }
            ),
        ]);

        if (updateUserDetail && updateUser) {
            return successResponse(res, "Thành công!");
        } else {
            return errorResponse400(res, "Người dùng không tồn tại!");
        }
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const updateAccountByRoleAdmin = async (req, res) => {
    try {
        const { isActive, avatar, ...rest } = req.body;
        let result;
        let avatarUrl = avatar;

        // Chỉ upload nếu là base64
        if (avatar && avatar.startsWith("data:image")) {
            try {
                result = await cloudinary.uploader.upload(avatar, {
                    folder: "users",
                });
                avatarUrl = result.secure_url;
            } catch (err) {
                return errorResponse500(
                    res,
                    "Lỗi khi upload avatar",
                    err.message
                );
            }
        }

        const [updateUserDetail, updateUser] = await Promise.all([
            UserDetail.findByIdAndUpdate(
                {
                    _id: new mongoose.Types.ObjectId(req.body._id),
                },
                {
                    ...rest,
                    avatar: avatarUrl,
                },
                { upsert: true }
            ),
            User.findByIdAndUpdate(
                {
                    _id: new mongoose.Types.ObjectId(req.body.userId),
                },
                {
                    email: req.body.email,
                    isActive: isActive,
                },
                { upsert: true }
            ),
        ]);

        if (updateUserDetail && updateUser) {
            return successResponse(res, "Thành công!");
        } else {
            return errorResponse400(res, "Người dùng không tồn tại!");
        }
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getAccountByRole = async (req, res) => {
    // try {
    //     const { filter } = aqp(req.query);
    //     const { page, size, isActive, roleName } = filter;
    //     const matchCondition = {};
    //     if (roleName) {
    //         matchCondition.role = roleName;
    //     }
    //     if (typeof isActive === "boolean") {
    //         matchCondition.isActive = isActive;
    //     }
    //     const result = await User.aggregate([
    //         { $match: matchCondition },
    //         {
    //             $lookup: {
    //                 from: "userdetails",
    //                 localField: "_id",
    //                 foreignField: "userId",
    //                 as: "userDetail",
    //             },
    //         },
    //         {
    //             $unwind: {
    //                 path: "$userDetail",
    //                 preserveNullAndEmptyArrays: true,
    //             },
    //         },
    //         {
    //             $project: {
    //                 _id: 1,
    //                 email: 1,
    //                 username: 1,
    //                 role: 1,
    //                 isActive: 1,
    //                 userDetail: {
    //                     _id: 1,
    //                     birthday: 1,
    //                     avatar: 1,
    //                     fullName: 1,
    //                     phone: 1,
    //                     gender: 1,
    //                     address: 1,
    //                 },
    //             },
    //         },
    //         { $sort: { createdAt: -1 } },
    //         { $skip: page * size },
    //         { $limit: size },
    //     ]);
    //     const total = await User.countDocuments([
    //         {
    //             isActive: isActive,
    //         },
    //         {
    //             roleName: roleName,
    //         },
    //     ]);
    //     return successResponseList(
    //         res,
    //         "Lấy danh sách người dùng thành công!",
    //         result,
    //         {
    //             total,
    //             page: page,
    //             size: size,
    //             totalPages: Math.ceil(total / size),
    //         }
    //     );
    // } catch (error) {
    //     if (error instanceof ErrorCustom) {
    //         return errorResponse400(res, error.message);
    //     }
    //     return errorResponse500(res, "Lỗi server", error.message);
    // }
};

const createAccount = async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            avatar,
            fullName,
            phone,
            gender,
            address,
            birthday,
            role,
        } = req.body;
        const existingUser = await UserDetail.findOne({
            email,
            username,
        });
        if (existingUser) {
            return errorResponse400(res, "Người dùng đã tồn tại");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            username,
            email,
            password: hashedPassword,
            role,
        });

        await user.save();
        const userDetail = new UserDetail({
            username,
            email,
            avatar,
            fullName,
            phone,
            gender,
            address,
            birthday,
            userId: user._id,
        });

        await userDetail.save();

        return successResponse(res, "Tạo người dùng thành công!");
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const getTotalPage = async (req, res) => {};
const countAccount = async (req, res) => {
    try {
        const { role } = req.user;
        let matchFilter = {};

        if (role === "MANAGER") {
            matchFilter.role = {
                $nin: ["ADMIN"],
            };
        }

        const users = await User.find(matchFilter);

        return successResponse(res, "", users.length);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export {
    createUser,
    getAllUser,
    getUserById,
    deleteUserById,
    updateUserById,
    getUserDetail,
    getAccountByRole,
    createAccount,
    getTotalPage,
    countAccount,
    updateAccountByRoleAdmin,
};
