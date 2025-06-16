import e from "express";
import Shipment from "../model/shipment.js";

const getAllShipmentsService = async (isActive = true) => {
    const shipments = await Shipment.find({ isActive }).sort({ name: -1 });
    return shipments;
};

export { getAllShipmentsService };