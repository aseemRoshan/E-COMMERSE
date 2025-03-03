const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require('mongoose');
const razorpay = require("razorpay");
const env = require("dotenv").config();
const crypto = require("crypto");
const Coupon = require("../../models/couponSchema");
const { v4: uuidv4 } = require('uuid');

const getOrderListPageAdmin = async (req, res, next) => {
    try {
        const orders = await Order.find({}).sort({ createdOn: -1 }).populate('userId', 'email');
        let itemsPerPage = 3;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(orders.length / 3);
        const currentOrder = orders.slice(startIndex, endIndex);
        currentOrder.forEach(order => {
            order.orderId = uuidv4();
        });

        res.render("order-list", { orders: currentOrder, totalPages, currentPage });
    } catch (error) {
        next(error);
    }
};

const changeOrderStatus = async (req, res, next) => {
    try {
        const orderId = req.query.orderId;
        const userId = req.query.userId;
        const status = req.query.status;

        await Order.updateOne({ _id: orderId }, { status });

        const findOrder = await Order.findOne({ _id: orderId });

        if (findOrder.status.trim() === "Returned" &&
            ["razorpay", "wallet", "cod"].includes(findOrder.payment)) {
            const findUser = await User.findOne({ _id: userId });
            if (findUser && findUser.wallet !== undefined) {
                findUser.wallet += findOrder.totalPrice;
                await findUser.save();
            } else {
                console.log("User not found or wallet is undefined");
            }

            await Order.updateOne({ _id: orderId }, { status: "Returned" });
            for (const productData of findOrder.product) {
                const productId = productData._id;
                const quantity = productData.quantity;
                const product = await Product.findById(productId);
                if (product) {
                    product.quantity += quantity;
                    await product.save();
                } else {
                    console.log("Product not found");
                }
            }
        }

        return res.redirect("/admin/order-list");
    } catch (error) {
        console.error(error);
        next(error);
    }
};

const getOrderDetailsPageAdmin = async (req, res, next) => {
    try {
        const orderId = req.query.id;
        console.log("Order ID:", orderId);

        if (!orderId) {
            throw new Error('Order ID is required');
        }

        const findOrder = await Order.findOne({ _id: orderId })
            .populate('userId', 'email name')
            .sort({ createdOn: 1 });

        if (!findOrder) {
            throw new Error('Order not found');
        }

        console.log("Order Details:", JSON.stringify(findOrder, null, 2));

        // Calculate totals
        let totalGrant = 0; // Sum of product price * quantity (before discount)
        findOrder.product.forEach((val) => {
            totalGrant += val.price * val.quantity;
        });

        const totalPrice = findOrder.totalPrice; // Before discount
        const discount = findOrder.discount || 0;
        const deliveryCharge = findOrder.deliveryCharge || 0;
        const finalAmount = findOrder.finalAmount; // Use the stored finalAmount directly

        res.render("order-details-admin", {
            orders: findOrder,
            orderId: orderId,
            totalGrant: totalGrant,
            totalPrice: totalPrice,
            discount: discount,
            deliveryCharge: deliveryCharge,
            finalAmount: finalAmount,
        });
    } catch (error) {
        console.error("Error in getOrderDetailsPageAdmin:", error);
        next(error);
    }
};


const orderDetailsAdmin = async (req, res, next) => {
    try {
        const orderId = req.query.id;
        if (!orderId) {
            return res.status(400).send('Order ID is required');
        }

        const findOrder = await Order.findOne({ _id: orderId }).sort({ createdOn: 1 });

        if (!findOrder) {
            return res.status(404).send('Order not found');
        }

        // Calculate total grant if needed
        let totalGrant = 0;
        findOrder.product.forEach((val) => {
            totalGrant += val.price * val.quantity;
        });

        const totalPrice = findOrder.totalPrice;
        const discount = totalGrant - totalPrice;
        const finalAmount = totalPrice; // Assuming finalAmount is the same as totalPrice

        // Add quantity to each product in findOrder
        findOrder.product.forEach((product) => {
            product.quantity = product.quantity || 1; // Set default quantity if not available
        });

        res.render("orderDetails", {
            order: findOrder,
            orderId: orderId,
            finalAmount: finalAmount,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

module.exports = {
    getOrderListPageAdmin,
    changeOrderStatus,
    getOrderDetailsPageAdmin,
    orderDetailsAdmin,
};
