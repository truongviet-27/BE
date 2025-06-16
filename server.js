import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import dbConnect from "./src/config/dbConnect.js";
import attributeRouter from "./src/routes/attribute.route.js";
import brandRouter from "./src/routes/brand.route.js";
import cartRouter from "./src/routes/cart.route.js";
import categoryRouter from "./src/routes/category.route.js";
import orderRouter from "./src/routes/order.route.js";
import paymentRouter from "./src/routes/payment.route.js";
import productRouter from "./src/routes/product.route.js";
import saleRouter from "./src/routes/sale.route.js";
import shipmentRouter from "./src/routes/shipment.route.js";
import userRouter from "./src/routes/user.route.js";
import voucherRouter from "./src/routes/voucher.route.js";

dotenv.config();

const PORT = process.env.PORT || 8000;
const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(bodyParser.json());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

app.use(
    cors({
        credentials: true,
    })
);

app.use("/api/v1/user", userRouter);
app.use("/api/v1/category", categoryRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/sale", saleRouter);
app.use("/api/v1/voucher", voucherRouter);
app.use("/api/v1/brand", brandRouter);
app.use("/api/v1/attribute", attributeRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/shipment", shipmentRouter);
app.use("/api/v1/payment", paymentRouter);

const startServer = async () => {
    try {
        await dbConnect();
        app.listen(PORT, () => {
            console.log(`🚀 Server is running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Database connection failed:", error.message);
        process.exit(1);
    }
};

startServer();
