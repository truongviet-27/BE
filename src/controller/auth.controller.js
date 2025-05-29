import bcrypt from "bcrypt";
import generator from "generate-password";
import jwt from "jsonwebtoken";
import { generateToken } from "../config/jwtToken.js";
import { generateRefreshToken } from "../config/refreshToken.js";
import User from "../model/user.js";

import transporter from "../config/nodeMailer.js";
import generatePassword from "../utils/generatePassword.js";
import {
    errorResponse400,
    errorResponse500,
    successResponse,
} from "../utils/responseHandler.js";

const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User.findOne({
            $or: [
                { username: username },
                {
                    email: username,
                },
            ],
        });

        if (!existingUser) {
            return errorResponse400(res, "Username không tồn tại");
        }

        const isMatch = await bcrypt.compare(password, existingUser.password);

        if (!isMatch) {
            return errorResponse400(res, "Mật khẩu không đúng");
        }

        await sendOtp(res, existingUser);
    } catch (error) {
        return errorResponse500(res, error.message);
    }
};

const sendOtp = async (res, existingUser) => {
    try {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpire = Date.now() + 10 * 60 * 1000;

        existingUser.verifyOtp = otp;
        existingUser.verifyOtpExpireAt = otpExpire;

        await existingUser.save();

        const mailOptions = {
            from: process.env.MAIL_USERNAME,
            to: existingUser.email,
            subject: "Xác thực mã OTP",
            text: `Mã OTP của bạn là: ${otp}`,
        };

        await transporter.sendMail(mailOptions);

        return successResponse(res, "Gửi mã OTP thành công!", otpExpire);
    } catch (error) {
        return errorResponse500(res, error.message);
    }
};

const verifyOtp = async (req, res) => {
    const { username, otp } = req.body;
    try {
        const user = await User.findOne({
            $or: [{ email: username }, { username: username }],
        });

        if (user.verifyOtp === "" || user.verifyOtp !== otp) {
            return errorResponse400(res, "Mã OTP không đúng!");
        }
        if (user.verifyOtpExpireAt < Date.now()) {
            return errorResponse400(res, "Mã OTP hết hạn!");
        }
        user.verifyOtp = "";
        user.verifyOtpExpireAt = 0;
        user.isAccountVerified = true;

        await user.save();

        const refreshToken = generateRefreshToken(user._id);
        const accessToken = generateToken(user._id);

        return successResponse(res, "Xác thực thành công!", {
            id: user._id,
            accessToken,
            refreshToken,
        });
    } catch (error) {
        return errorResponse500(res, error.message);
    }
};

const logout = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        user.verifyOtp = "";
        user.verifyOtpExpireAt = 0;
        user.isAccountVerified = false;
        user.resetOtp = "";
        user.resetOtpExpireAt = 0;

        await user.save();

        // res.clearCookie("access_token", {
        //     httpOnly: true,
        //     secure: false,
        // });
        // res.clearCookie("refresh_token", {
        //     httpOnly: true,
        //     secure: false,
        // });

        // res.clearCookie("accessToken", {
        //     httpOnly: true,
        //     secure: false,
        // });

        return successResponse(res, "Thoát đăng nhập thành công!");
    } catch (error) {
        return errorResponse500(res, error.message);
    }
};

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return errorResponse400(res, "Bạn nhập thiếu dữ liệu!");
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return errorResponse400(res, "Email không tồn tại");
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

        const hashedPassword = await bcrypt.hash(passwordNew, 12);

        user.password = hashedPassword;

        await user.save();

        return successResponse(res, "Mật khẩu được gửi về email của bạn!");
    } catch (error) {
        return errorResponse500(res, error.message);
    }
};

const resetPassword = async (req, res) => {
    const { username, otp } = req.body;
    if (!username || !otp) {
        return errorResponse400(res, "Bạn nhập thiếu dữ liệu!");
    }
    try {
        const user = await User.findOne({
            $or: [{ email: username }, { username }],
        });
        if (!user) {
            return errorResponse400(res, "Email không tồn tại");
        }
        if (user.resetOtp === "" || user.resetOtp !== otp) {
            return errorResponse400(res, "Mã OTP không đúng!");
        }
        if (user.resetOtpExpireAt < Date.now()) {
            return errorResponse400(res, "Mã OTP hết hạn!");
        }

        const password = generatePassword();

        const hashedPassword = await bcrypt.hash(password, 12);

        user.password = hashedPassword;
        user.resetOtp = 0;
        user.resetOtpExpireAt = 0;

        await user.save();

        return successResponse(res, "Đổi mật khẩu thành công!");
    } catch (error) {
        return errorResponse500(res, error.message);
    }
};

const changePassword = async (req, res) => {
    const { username, password, newPassword } = req.body;
    try {
        const user = await User.findOne({
            $or: [{ email: username }, { username }],
        });
        if (!user) {
            return errorResponse400(res, "Username không tồn tại!");
        }
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return errorResponse400(res, "Mật khẩu không đúng!");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        user.password = hashedPassword;

        await user.save();

        return successResponse(res, "Đổi mật khẩu thành công!");
    } catch (error) {
        return errorResponse500(res, error.message);
    }
};

const sendOtpResetPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });

        if (!user) {
            return errorResponse500(res, "User không tồn tại!");
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

        return successResponse(res, "Gửi mã OTP đến bạn thành công!");
    } catch (error) {
        return errorResponse500(res, error.message);
    }
};

const handleRefreshToken = async (req, res) => {
    const refreshToken = req.body.refreshToken;
    try {
        if (!refreshToken) {
            return errorResponse400(res, "Refresh Token không tồn tại!");
        }
        const decodedUser = jwt.verify(refreshToken, process.env.JWT_SECRET);

        if (!decodedUser) {
            return errorResponse400(res, "Refresh Token không hợp lệ!");
        }
        const user = await User.findById(decodedUser?.id);
        const accessToken = generateToken(user._id);
        return successResponse(res, "Refresh token thành công!", accessToken);
    } catch (error) {
        return errorResponse500(res, error.message);
    }
};

export {
    changePassword,
    forgotPassword,
    handleRefreshToken,
    loginUser,
    logout,
    resetPassword,
    sendOtp,
    sendOtpResetPassword,
    verifyOtp,
};
