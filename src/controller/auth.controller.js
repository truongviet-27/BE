import { ErrorCustom } from "../helper/ErrorCustom.js";
import {
    changePasswordService,
    forgotPasswordService,
    handleRefreshTokenService,
    loginUserService,
    logoutService,
    resetPasswordService,
    sendOtpResetPasswordService,
    sendOtpService,
    verifyOtpService,
} from "../service/auth.service.js";
import {
    errorResponse400,
    errorResponse500,
    successResponse,
} from "../utils/responseHandler.js";

const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await loginUserService(username, password, res);

        if (!result.success) {
            return errorResponse400(res, result.message);
        }

        const otpExpire = await sendOtpService(result.user);

        return successResponse(res, "Gửi mã OTP thành công!", otpExpire);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const verifyOtp = async (req, res) => {
    const { username, otp } = req.body;

    try {
        const result = await verifyOtpService(username, otp);

        if (!result.success) {
            return errorResponse400(res, result.message);
        }

        return successResponse(res, "Xác thực thành công!", result.data);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const logout = async (req, res) => {
    try {
        const userId = req.user.id;
        await logoutService(userId);

        // res.clearCookie("accessToken", { httpOnly: true, secure: true });
        // res.clearCookie("refreshToken", { httpOnly: true, secure: true });

        return successResponse(res, "Thoát đăng nhập thành công!");
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return errorResponse400(res, "Bạn nhập thiếu dữ liệu!");
    }

    try {
        await forgotPasswordService(email);
        return successResponse(res, "Mật khẩu được gửi về email của bạn!");
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const resetPassword = async (req, res) => {
    const { username, otp } = req.body;
    if (!username || !otp) {
        return errorResponse400(res, "Bạn nhập thiếu dữ liệu!");
    }

    try {
        await resetPasswordService(username, otp);
        return successResponse(res, "Reset mật khẩu thành công!");
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const changePassword = async (req, res) => {
    const { username, password, newPassword } = req.body;
    try {
        await changePasswordService(username, password, newPassword);
        return successResponse(res, "Đổi mật khẩu thành công!");
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const sendOtpResetPassword = async (req, res) => {
    const { email } = req.body;

    try {
        await sendOtpResetPasswordService(email);
        return successResponse(res, "Gửi mã OTP thành công!");
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

const handleRefreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    try {
        const accessToken = await handleRefreshTokenService(refreshToken);
        return successResponse(res, "Refresh token thành công!", accessToken);
    } catch (error) {
        if (error instanceof ErrorCustom) {
            return errorResponse400(res, error.message);
        }
        return errorResponse500(res, "Lỗi server", error.message);
    }
};

export {
    changePassword,
    forgotPassword,
    handleRefreshToken,
    loginUser,
    logout,
    resetPassword,
    sendOtpResetPassword,
    verifyOtp,
};
