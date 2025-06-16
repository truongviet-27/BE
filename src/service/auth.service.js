import bcrypt from "bcrypt";
import generator from "generate-password";
import { generateToken } from "../config/jwtToken.js";
import transporter from "../config/nodeMailer.js";
import { generateRefreshToken } from "../config/refreshToken.js";
import { ErrorCustom } from "../helper/ErrorCustom.js";
import User from "../model/user.js";
import generateOtp from "../utils/generateOtp.js";
import jwt from "jsonwebtoken";

const loginUserService = async (username, password) => {
    const user = await User.findOne({
        $and: [{ isActive: true }, { username }],
    });

    if (!user) {
        return { success: false, message: "Username không tồn tại" };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return { success: false, message: "Mật khẩu không đúng" };
    }

    return { success: true, user };
};

const sendOtpService = async (user) => {
    const otp = generateOtp();
    const otpExpire = Date.now() + 10 * 60 * 1000;

    user.verifyOtp = otp;
    user.verifyOtpExpireAt = otpExpire;

    await user.save();

    const mailOptions = {
        from: process.env.MAIL_USERNAME,
        to: user.email,
        subject: "Xác thực mã OTP",
        text: `Mã OTP của bạn là: ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    return otpExpire;
};

const verifyOtpService = async (username, otp) => {
    const user = await User.findOne({
        $or: [{ email: username }, { username }],
    });

    if (!user) {
        throw new Error("Không tìm thấy người dùng!");
    }

    if (user.verifyOtp === "" || user.verifyOtp !== otp) {
        return { success: false, message: "Mã OTP không đúng!" };
    }

    if (user.verifyOtpExpireAt < Date.now()) {
        return { success: false, message: "Mã OTP đã hết hạn!" };
    }

    user.verifyOtp = "";
    user.verifyOtpExpireAt = 0;
    user.isAccountVerified = true;

    await user.save();

    const refreshToken = generateRefreshToken(user._id);
    const accessToken = generateToken(user._id);

    return {
        success: true,
        data: {
            id: user._id,
            accessToken,
            refreshToken,
        },
    };
};

const logoutService = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new Error("Không tìm thấy người dùng!");
    }

    user.verifyOtp = "";
    user.verifyOtpExpireAt = 0;
    user.isAccountVerified = false;
    user.resetOtp = "";
    user.resetOtpExpireAt = 0;

    await user.save();
};

const forgotPasswordService = async (email) => {
    const user = await User.findOne({ email });
    if (!user) {
        throw new ErrorCustom("Email không tồn tại");
    }

    const passwordNew = generator.generate({
        length: 12,
        numbers: true,
        uppercase: true,
        lowercase: true,
        excludeSimilarCharacters: true,
    });

    const mailOptions = {
        from: process.env.MAIL_USERNAME,
        to: user.email,
        subject: "Mật khẩu mới",
        text: `Mật khẩu mới của bạn là: ${passwordNew}`,
    };

    await transporter.sendMail(mailOptions);

    const hashedPassword = await bcrypt.hash(passwordNew, 10);
    user.password = hashedPassword;
    await user.save();
};

const resetPasswordService = async (username, otp) => {
    if (!username || !otp) {
        throw new ErrorCustom("Bạn nhập thiếu dữ liệu!");
    }

    const user = await User.findOne({ username });

    if (!user) {
        throw new ErrorCustom("Email không tồn tại");
    }

    if (!user.resetOtp || user.resetOtp !== otp) {
        throw new ErrorCustom("Mã OTP không đúng!");
    }

    if (user.resetOtpExpireAt < Date.now()) {
        throw new ErrorCustom("Mã OTP hết hạn!");
    }

    const newPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetOtp = "";
    user.resetOtpExpireAt = 0;

    await user.save();

    return { success: true };
};

const changePasswordService = async (username, password, newPassword) => {
    const user = await User.findOne({ username });
    if (!user) {
        throw new ErrorCustom("Username không tồn tại!");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new ErrorCustom("Mật khẩu không đúng!");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;

    await user.save();
};

const sendOtpResetPasswordService = async (email) => {
    const user = await User.findOne({ email });

    if (!user) {
        throw new ErrorCustom("Email không tồn tại!");
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpire = Date.now() + 10 * 60 * 1000;

    user.resetOtp = otp;
    user.resetOtpExpireAt = otpExpire;

    await user.save();

    const mailOptions = {
        from: process.env.MAIL_USERNAME,
        to: user.email,
        subject: "Reset mật khẩu",
        text: `Mã OTP của bạn là: ${otp}`,
    };

    await transporter.sendMail(mailOptions);
};

const handleRefreshTokenService = async (refreshToken) => {
    if (!refreshToken) {
        throw new ErrorCustom("Refresh Token không tồn tại!");
    }

    let decodedUser;
    try {
        decodedUser = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
        throw new ErrorCustom("Refresh Token không hợp lệ!");
    }

    const user = await User.findById(decodedUser?.id);
    if (!user) {
        throw new ErrorCustom("Không tìm thấy người dùng!");
    }

    const accessToken = generateToken(user._id);
    return accessToken;
};

export {
    changePasswordService,
    forgotPasswordService,
    handleRefreshTokenService,
    loginUserService,
    logoutService,
    resetPasswordService,
    sendOtpResetPasswordService,
    sendOtpService,
    verifyOtpService,
};
