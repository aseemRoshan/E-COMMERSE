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

        
        let totalGrant = 0; 
        findOrder.product.forEach((val) => {
            totalGrant += val.price * val.quantity;
        });

        const totalPrice = findOrder.totalPrice; 
        const discount = findOrder.discount || 0;
        const deliveryCharge = findOrder.deliveryCharge || 0;
        const finalAmount = findOrder.finalAmount; 

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

        
        let totalGrant = 0;
        findOrder.product.forEach((val) => {
            totalGrant += val.price * val.quantity;
        });

        const totalPrice = findOrder.totalPrice;
        const discount = totalGrant - totalPrice;
        const finalAmount = totalPrice; 

        
        findOrder.product.forEach((product) => {
            product.quantity = product.quantity || 1; 
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



const approveReturn = async (req, res, next) => {
    try {
      const { orderId, productId } = req.body;
  
      const order = await Order.findOne({ _id: orderId });
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
  
      const productIndex = order.product.findIndex(p => p._id.toString() === productId);
      if (productIndex === -1 || order.product[productIndex].productStatus !== "Return Requested") {
        return res.status(400).json({ success: false, message: "Invalid return request" });
      }
  
      const productData = order.product[productIndex];
      const refundAmount = productData.price * productData.quantity;
  
      // Update order
      order.product[productIndex].productStatus = "Returned";
      order.product[productIndex].returnStatus = "Approved";
      order.totalPrice -= refundAmount;
      order.finalAmount -= refundAmount;
      await order.save();
  
      // Credit user's wallet
      const user = await User.findById(order.userId);
      if (user) {
        user.wallet += refundAmount;
        user.history.push({
          amount: refundAmount,
          status: "credit",
          date: Date.now(),
          description: `Refund for returned product ${productId} in order ${orderId}`,
        });
        await user.save();
      }
  
      // Restock product
      const product = await Product.findById(productData.productId);
      if (product) {
        product.quantity += productData.quantity;
        await product.save();
      }
  
      res.status(200).json({ success: true, message: "Return approved and wallet credited" });
    } catch (error) {
      next(error);
    }
  };
  
  const rejectReturn = async (req, res, next) => {
    try {
      const { orderId, productId } = req.body;
  
      const order = await Order.findOne({ _id: orderId });
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
  
      const productIndex = order.product.findIndex(p => p._id.toString() === productId);
      if (productIndex === -1 || order.product[productIndex].productStatus !== "Return Requested") {
        return res.status(400).json({ success: false, message: "Invalid return request" });
      }
  
      // Revert to previous status (e.g., "Delivered") and mark return as rejected
      order.product[productIndex].productStatus = "Delivered"; // Or whatever status it was before
      order.product[productIndex].returnStatus = "Rejected";
      await order.save();
  
      res.status(200).json({ success: true, message: "Return request rejected" });
    } catch (error) {
      next(error);
    }
  };

module.exports = {
    getOrderListPageAdmin,
    changeOrderStatus,
    getOrderDetailsPageAdmin,
    orderDetailsAdmin,
    approveReturn,
    rejectReturn,
};
