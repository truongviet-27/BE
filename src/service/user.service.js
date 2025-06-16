import UserDetail from "../model/userDetail.js";
import User from "../model/user.js";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import bcrypt from "bcrypt";
import transporter from "../config/nodeMailer.js";
import validateMongoDbId from "../utils/validateMongodbId.js";
import { ErrorCustom } from "../helper/ErrorCustom.js";

const createUserService = async (data) => {
    const { username, password, email, avatar } = data;

    const result = await cloudinary.uploader.upload(avatar, {
        folder: "users",
    });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const existingUser = await UserDetail.findOne({
            $or: [{ username }, { email }],
        }).session(session);

        if (existingUser) {
            return { success: false };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            ...data,
            password: hashedPassword,
        });

        await user.save({ session });

        const userDetail = new UserDetail({
            ...data,
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

        return { success: true };
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
};

const getAllUserService = async ({
    role,
    query,
    filter,
    search,
    page = 0,
    size = 10,
}) => {
    let matchFilter = {};
    let sort = { createdAt: -1 };

    // Bộ lọc theo quyền
    if (filter) {
        if (filter !== "ALL") {
            matchFilter.role = filter;
        } else {
            if (role === "MANAGER") {
                matchFilter.role = { $ne: "ADMIN" };
            }
        }
    }

    // Sắp xếp
    if (query) {
        let [key, value] = query.split("-");
        if (key === "username") {
            sort = { username: value === "asc" ? 1 : -1 };
        } else if (key && value) {
            matchFilter[key] = value === "true" ? true : false;
        }
    }

    // Tìm kiếm
    if (search) {
        matchFilter["$or"] = [
            { email: { $regex: search, $options: "i" } },
            { username: { $regex: search, $options: "i" } },
            { fullName: { $regex: search, $options: "i" } },
        ];
    }

    const [users, total] = await Promise.all([
        User.aggregate([
            { $match: matchFilter },
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

    return {
        users,
        total,
        pagination: {
            page,
            size,
            totalPages: Math.ceil(total / size),
        },
    };
};

const getUserByIdService = async (id) => {
    validateMongoDbId(id);

    const user = await User.findOne({ _id: id }).select(
        "-updatedAt -__v -createdAt -verifyOtp -verifyOtpExpireAt -resetOtp -resetOtpExpireAt -isAccountVerified -password"
    );

    if (!user) {
        return null;
    }

    const userDetail = await UserDetail.findOne({ userId: id }).select(
        "-updatedAt -__v -createdAt"
    );

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

    return {
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
        userId: user._id,
        role: user.role,
    };
};

const getUserDetailService = async (user) => {
    return user;
};

const deleteUserByIdService = async (id) => {
    validateMongoDbId(id);

    const deletedUser = await User.findOneAndDelete({ _id: id });
    const deletedUserDetail = await UserDetail.findOneAndDelete({ userId: id });

    if (!deletedUser && !deletedUserDetail) {
        throw new ErrorCustom("Người dùng không tồn tại!");
    }

    return true;
};

const updateUserByIdService = async (data) => {
    const { isActive, avatar, _id, userId, ...rest } = data;
    let avatarUrl = avatar;

    if (avatar && avatar.startsWith("data:image")) {
        try {
            const result = await cloudinary.uploader.upload(avatar, {
                folder: "users",
            });
            avatarUrl = result.secure_url;
        } catch (err) {
            throw new ErrorCustom("Lỗi khi upload avatar: " + err.message);
        }
    }

    const [updateUserDetail, updateUser] = await Promise.all([
        UserDetail.findByIdAndUpdate(
            new mongoose.Types.ObjectId(_id),
            {
                ...rest,
                avatar: avatarUrl,
            },
            { upsert: true }
        ),
        User.findByIdAndUpdate(
            new mongoose.Types.ObjectId(userId),
            {
                email: data.email,
                isActive: isActive,
            },
            { upsert: true }
        ),
    ]);

    if (!updateUserDetail || !updateUser) {
        throw new ErrorCustom("Người dùng không tồn tại!");
    }

    return true;
};

const updateAccountByRoleAdminService = async (data) => {
    const { isActive, avatar, _id, userId, email, ...rest } = data;
    let avatarUrl = avatar;

    if (avatar && avatar.startsWith("data:image")) {
        try {
            const result = await cloudinary.uploader.upload(avatar, {
                folder: "users",
            });
            avatarUrl = result.secure_url;
        } catch (err) {
            throw new ErrorCustom("Lỗi khi upload avatar: " + err.message);
        }
    }

    const [updateUserDetail, updateUser] = await Promise.all([
        UserDetail.findByIdAndUpdate(
            new mongoose.Types.ObjectId(_id),
            {
                ...rest,
                avatar: avatarUrl,
            },
            { upsert: true }
        ),
        User.findByIdAndUpdate(
            new mongoose.Types.ObjectId(userId),
            {
                email,
                isActive,
            },
            { upsert: true }
        ),
    ]);

    if (!updateUserDetail || !updateUser) {
        throw new ErrorCustom("Người dùng không tồn tại!");
    }

    return true;
};

const createAccountService = async (data) => {
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
    } = data;

    const existingUser = await User.findOne({
        $or: [{ email }, { username }],
    });

    if (existingUser) {
        throw new ErrorCustom("Người dùng đã tồn tại");
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

    return true;
};

const countAccountService = async (role) => {
    let matchFilter = {};

    if (role === "MANAGER") {
        matchFilter.role = {
            $nin: ["ADMIN"],
        };
    }

    const count = await User.countDocuments(matchFilter);
    return count;
};

const getAccountByRoleService = async ({
    page = 0,
    size = 10,
    roleName,
    isActive,
}) => {
    const matchCondition = {};
    if (roleName) matchCondition.role = roleName;
    if (typeof isActive === "boolean") matchCondition.isActive = isActive;

    const users = await User.aggregate([
        { $match: matchCondition },
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
        { $sort: { createdAt: -1 } },
        { $skip: Number(page) * Number(size) },
        { $limit: Number(size) },
    ]);

    const total = await User.countDocuments(matchCondition);

    return {
        users,
        pagination: {
            total,
            page: Number(page),
            size: Number(size),
            totalPages: Math.ceil(total / size),
        },
    };
};

export {
    createUserService,
    getAllUserService,
    getUserByIdService,
    getUserDetailService,
    deleteUserByIdService,
    updateUserByIdService,
    updateAccountByRoleAdminService,
    createAccountService,
    countAccountService,
    getAccountByRoleService,
};
