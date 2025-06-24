import express from "express";
import {
    amountYear,
    cancelOrder,
    countOrder,
    countOrderByCategoryName,
    createOrder,
    getAllOrder,
    getAllOrderAndPagination,
    getAllOrdersByPayment,
    getAllOrderStatus,
    getOrderById,
    getOrderByOrderStatusAndYearAndMonth,
    getOrderByOrderStatusBetweenDate,
    getOrderByOrderYearAndMonth,
    getOrderByProduct,
    getOrderDetailByOrderId,
    reportAmountMonth,
    reportAmountYear,
    reportByProduct,
    reportByProductByYear,
    reportInvestmentMonth,
    reportInvestmentYear,
    updateCancel,
    updateOrderRefund,
    updateOrderReturn,
    updateProcess,
    updateShip,
    updateSuccess,
} from "../controller/order.controller.js";
import {
    authIsAdminMiddleware,
    authIsManagerMiddleware,
    authMiddleware,
} from "../middleware/authMiddlewares.js";

const router = express.Router();

router.post("/create", authMiddleware, createOrder);
router.get("/", authMiddleware, getOrderById);
router.get("/order-detail", authMiddleware, getOrderDetailByOrderId);
router.get("/order-status", authMiddleware, getAllOrderStatus);
router.get("/list", authMiddleware, getAllOrder);
router.post("/cancel", authMiddleware, cancelOrder);

// admin
router.get(
    "/list/category-count",
    authIsManagerMiddleware,
    countOrderByCategoryName
);

router.get("/count", authIsManagerMiddleware, countOrder);
router.get("/synthesis/year", authIsManagerMiddleware, reportAmountYear);
router.get("/synthesis/year/investment", authIsManagerMiddleware, reportInvestmentYear);

router.get("/synthesis/amount-year", authIsManagerMiddleware, amountYear);

router.get("/synthesis/product", authIsManagerMiddleware, reportByProduct);
router.get(
    "/synthesis/product-year",
    authIsManagerMiddleware,
    reportByProductByYear
);

router.get(
    "/synthesis/order-by-year-month",
    authIsManagerMiddleware,
    getOrderByOrderStatusAndYearAndMonth
);
router.get(
    "/synthesis/order-year-month",
    authIsManagerMiddleware,
    getOrderByOrderYearAndMonth
);
router.get(
    "/synthesis/order-by-product",
    authIsManagerMiddleware,
    getOrderByProduct
);
router.get(
    "/synthesis/amount-month",
    authIsManagerMiddleware,
    reportAmountMonth
);
router.get(
    "/synthesis/investment-month",
    authIsManagerMiddleware,
    reportInvestmentMonth
);

router.post("/update-order-return", authIsManagerMiddleware, updateOrderReturn);
router.post("/update-order-refund", authIsAdminMiddleware, updateOrderRefund);

router.post("/admin/cancel-order", authIsManagerMiddleware, updateCancel);
router.post("/admin/update-process", authIsManagerMiddleware, updateProcess);
router.post("/admin/update-shipment", authIsManagerMiddleware, updateShip);
router.post("/admin/update-success", authIsAdminMiddleware, updateSuccess);
router.get("/page-admin", authIsManagerMiddleware, getAllOrderAndPagination);
router.get(
    "/page-orders-between-date",
    authIsManagerMiddleware,
    getOrderByOrderStatusBetweenDate
);
router.get("/payment", authIsManagerMiddleware, getAllOrdersByPayment);
export default router;
