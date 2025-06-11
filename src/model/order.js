import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        code: { type: String, unique: true },
        address: { type: String, required: true },
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String },
        note: { type: String },
        total: { type: Number, required: true },
        isPayment: { type: Boolean, default: false },
        paymentDate: { type: Date },
        shipment: { type: mongoose.Schema.Types.ObjectId, ref: "shipment" },
        payment: { type: String, required: true },
        shipDate: { type: Date },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        orderStatus: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "orderStatus",
        },
        voucher: { type: mongoose.Schema.Types.ObjectId, ref: "voucher" },
        reason: { type: String },
    },
    { timestamps: true }
);

const Order = mongoose.model("order", orderSchema);

export default Order;
