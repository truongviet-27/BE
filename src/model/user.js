import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minLength: 5,
            maxLength: 50,
        },
        password: {
            type: String,
            required: true,
            minLength: 3,
            maxLength: 60,
        },
        username: {
            type: String,
            required: true,
            minLength: 3,
            maxLength: 50,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        role: {
            type: String,
            enum: ["ADMIN", "CUSTOMER", "MANAGER"],
            default: "CUSTOMER",
        },

        verifyOtp: {
            type: String,
            default: "",
        },
        verifyOtpExpireAt: {
            type: Number,
            default: 0,
        },
        resetOtp: {
            type: String,
            default: "",
        },
        resetOtpExpireAt: {
            type: Number,
            default: 0,
        },
        isAccountVerified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

const User = mongoose.model("user", userSchema);

export default User;
