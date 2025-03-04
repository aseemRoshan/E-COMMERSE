const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const razorpay = require("razorpay");
const env = require("dotenv").config();
const crypto = require("crypto");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const easyinvoice = require("easyinvoice");
const Coupon = require("../../models/couponSchema");
const Cart = require("../../models/cartSchema");

let instance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getCheckoutPage = async (req, res, next) => {
  try {
    const userId = req.query.userId;

    const findUser = await User.findOne({ _id: userId });

    if (!findUser) {
      return res.redirect("/pageNotFound");
    }

    const cart = await Cart.findOne({ userId: userId }).populate("items.productId");

    if (cart && cart.items.length > 0) {
      const addressData = await Address.findOne({ userId: userId });
      const data = cart.items.map((item) => ({
        proId: item.productId._id,
        quantity: item.quantity,
        productDetails: [item.productId],
      }));

      const grandTotal = cart.items.reduce((total, item) => {
        return total + item.quantity * item.productId.salePrice;
      }, 0);

      // Calculate delivery charge
      const deliveryCharge = grandTotal < 4000 ? 200 : 0;
      const totalWithDelivery = grandTotal + deliveryCharge;

      const today = new Date().toISOString();
      const findCoupons = await Coupon.find({
        isList: true,
        createdOn: { $lt: new Date(today) },
        expireOn: { $gt: new Date(today) },
        minimumPrice: { $lt: grandTotal },
      });

      res.render("checkoutcart", {
        product: data,
        user: findUser,
        isCart: true,
        userAddress: addressData,
        grandTotal: grandTotal,
        deliveryCharge: deliveryCharge,
        totalWithDelivery: totalWithDelivery,
        Coupon: findCoupons,
      });
    } else {
      console.log("Redirecting to shop page because the cart is empty.");
      res.redirect("/shop");
    }
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const productId = req.query.id;
    const userId = req.session.user;
    console.log("Product ID to delete:", productId);
    console.log("User ID from session:", userId);

    if (!productId || !userId) {
      console.error("Missing product ID or user ID");
      return res.redirect("/pageNotFound");
    }

    const cart = await Cart.findOne({ userId: userId });
    if (!cart) {
      console.error("Cart not found");
      return res.redirect("/pageNotFound");
    }

    const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
    if (itemIndex !== -1) {
      cart.items.splice(itemIndex, 1);
      await cart.save();

      res.redirect("/checkout");
    } else {
      console.error("Product not found in cart");
      res.redirect("/pageNotFound");
    }
  } catch (error) {
    next(error);
  }
};

const applyCoupon = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const selectedCoupon = await Coupon.findOne({ name: req.body.coupon });

    if (!selectedCoupon) {
      return res.json({ success: false, message: 'Coupon not found' });
    }

    if (selectedCoupon.userId.includes(userId)) {
      return res.json({ success: false, message: 'Coupon already used' });
    }

    await Coupon.updateOne(
      { name: req.body.coupon },
      { $addToSet: { userId: userId } }
    );

    const gt = parseInt(req.body.total) - parseInt(selectedCoupon.offerPrice);
    return res.json({ success: true, gt: gt, offerPrice: parseInt(selectedCoupon.offerPrice) });
  } catch (error) {
    next(error);
  }
};

const orderPlaced = async (req, res, next) => {
  try {
    const { totalPrice, addressId, payment, discount } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(400).json({ error: "User not logged in" });
    }

    const findUser = await User.findOne({ _id: userId });
    if (!findUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const findAddress = await Address.findOne({ userId: userId, "address._id": addressId });
    if (!findAddress) {
      return res.status(404).json({ error: "Address not found" });
    }

    const desiredAddress = findAddress.address.find((item) => item._id.toString() === addressId.toString());
    if (!desiredAddress) {
      return res.status(404).json({ error: "Specific address not found" });
    }

    const cart = await Cart.findOne({ userId: userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ error: "Cart is empty" });
    }

    const outOfStockItems = cart.items.filter(item => item.productId.quantity < item.quantity);
    if (outOfStockItems.length > 0) {
      const outOfStockMessages = outOfStockItems.map(item => `The product "${item.productId.productName}" is out of stock.`);
      return res.status(400).json({ error: "Some items are out of stock", messages: outOfStockMessages });
    }

    const orderedProducts = cart.items.map((item) => ({
      productId: item.productId._id,
      quantity: item.quantity,
      price: item.productId.salePrice,
      name: item.productId.productName,
      image: item.productId.productImage[0],
      productStatus: "Confirmed",
      user: userId
    }));

    // Apply delivery charge logic
    const deliveryCharge = totalPrice < 4000 ? 200 : 0;
    const finalAmount = totalPrice - (discount || 0) + deliveryCharge;

    const newOrder = new Order({
      product: orderedProducts,
      totalPrice: totalPrice,
      discount: discount || 0,
      deliveryCharge: deliveryCharge,
      finalAmount: finalAmount,
      address: desiredAddress,
      payment: payment,
      userId: userId,
      status: payment === "razorpay" ? "Pending" : "Confirmed",
      createdOn: Date.now(),
    });

    const orderDone = await newOrder.save();
    await Cart.updateOne({ userId: userId }, { $set: { items: [] } });

    for (const orderedProduct of orderedProducts) {
      const product = await Product.findOne({ _id: orderedProduct.productId });
      if (product) {
        product.quantity = Math.max(product.quantity - orderedProduct.quantity, 0);
        await product.save();
      }
    }

    if (payment === "cod") {
      res.json({
        payment: true,
        method: "cod",
        order: orderDone,
        orderId: orderDone._id,
      });
    } else if (payment === "wallet") {
      if (finalAmount <= findUser.wallet) {
        findUser.wallet -= finalAmount;
        findUser.history.push({ amount: finalAmount, status: "debit", date: Date.now() });
        await findUser.save();
        res.json({
          payment: true,
          method: "wallet",
          order: orderDone,
          orderId: orderDone._id,
          success: true,
        });
      } else {
        await Order.updateOne({ _id: orderDone._id }, { $set: { status: "Failed" } });
        res.json({
          payment: false,
          method: "wallet",
          success: false,
        });
      }
    } else if (payment === "razorpay") {
      const razorPayGeneratedOrder = await generateOrderRazorpay(orderDone._id, finalAmount);
      res.json({
        payment: false,
        method: "razorpay",
        razorPayOrder: razorPayGeneratedOrder,
        order: orderDone,
      });
    }
  } catch (error) {
    next(error);
  }
};

const getOrderDetailsPage = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const orderId = req.query.id;

    const findOrder = await Order.findOne({ _id: orderId }).populate('product.productId');
    if (!findOrder) {
      console.error("Order not found");
      return res.redirect("/pageNotFound");
    }

    const findUser = await User.findOne({ _id: userId });
    if (!findUser) {
      console.error("User not found");
      return res.redirect("/pageNotFound");
    }

    let totalGrant = 0;
    if (findOrder.product && Array.isArray(findOrder.product)) {
      findOrder.product.forEach((val) => {
        totalGrant += val.price * val.quantity;
      });
    } else {
      console.error("Product array is undefined or not an array");
      return res.redirect("/pageNotFound");
    }

    const totalPrice = findOrder.totalPrice;
    const discount = totalGrant - totalPrice;
    const finalAmount = findOrder.finalAmount;

    res.render("orderDetails", {
      orders: findOrder,
      user: findUser,
      totalGrant: totalGrant,
      totalPrice: totalPrice,
      discount: discount,
      finalAmount: finalAmount,
    });
  } catch (error) {
    next(error);
  }
};

const paymentConfirm = async (req, res, next) => {
  try {
    await Order.updateOne(
      { _id: req.body.orderId },
      { $set: { status: "Confirmed" } }
    ).then((data) => {
      res.json({ status: true });
    });
  } catch (error) {
    next(error);
  }
};

const changeSingleProductStatus = async (req, res, next) => {
  const { orderId, singleProductId, status } = req.body;
  const oid = new mongodb.ObjectId(singleProductId);

  if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(singleProductId)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  const order = await Order.findOne({ _id: orderId });
  const productIndex = order.product.findIndex((product) => product._id.toString() === singleProductId);
  const orderedProductDataPrice = order.product[productIndex].price;
  const newPrice = order.totalPrice - orderedProductDataPrice;

  try {
    const filter = { _id: orderId };
    const update = {
      $set: {
        "product.$[elem].productStatus": status,
        totalPrice: newPrice,
      },
    };
    const options = {
      arrayFilters: [{ "elem._id": oid }],
    };
    const result = await Order.updateOne(filter, update, options);
    res.status(200).json({ message: "Product status updated successfully", result });
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const findUser = await User.findOne({ _id: userId });
    if (!findUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { orderId, productId, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID or product ID format" });
    }

    const findOrder = await Order.findOne({ _id: orderId });
    if (!findOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const productIndex = findOrder.product.findIndex((product) => product._id.toString() === productId);
    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: "Product not found in order" });
    }

    const productData = findOrder.product[productIndex];
    if (productData.productStatus === "Cancelled") {
      return res.status(400).json({ success: false, message: "Product is already cancelled" });
    }

    if (findOrder.payment === "razorpay" && findOrder.status === "Pending") {
      findOrder.product[productIndex].productStatus = "Cancelled";
      findOrder.totalPrice -= productData.price * productData.quantity;
      findOrder.finalAmount -= productData.price * productData.quantity;
    } else {
      if (findOrder.payment === "razorpay" || findOrder.payment === "wallet") {
        findUser.wallet += productData.price * productData.quantity;
        await User.updateOne(
          { _id: userId },
          {
            $push: {
              history: {
                amount: productData.price * productData.quantity,
                status: "credit",
                date: Date.now(),
                description: `Order ${orderId} product ${productId} cancelled`,
              },
            },
          }
        );
        await findUser.save();
      }

      findOrder.product[productIndex].productStatus = "Cancelled";
      findOrder.totalPrice -= productData.price * productData.quantity;
      findOrder.finalAmount -= productData.price * productData.quantity;
    }

    await findOrder.save();

    const product = await Product.findById(productData.productId);
    if (product) {
      product.quantity += productData.quantity;
      await product.save();
    }

    const allProductsCancelled = findOrder.product.every((product) => product.productStatus === "Cancelled");
    if (allProductsCancelled) {
      findOrder.status = "Cancelled";
      await findOrder.save();
    }

    res.status(200).json({ success: true, message: "Product cancelled successfully" });
  } catch (error) {
    next(error);
  }
};

const returnorder = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const findUser = await User.findOne({ _id: userId });
    if (!findUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const { orderId, productId, reason } = req.body;

    const findOrder = await Order.findOne({ _id: orderId });
    if (!findOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const productIndex = findOrder.product.findIndex((product) => product._id.toString() === productId);
    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found in order" });
    }

    const productData = findOrder.product[productIndex];
    if (productData.productStatus === "Returned") {
      return res.status(400).json({ message: "Product is already returned" });
    }

    findUser.wallet += productData.price * productData.quantity;
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          history: {
            amount: productData.price * productData.quantity,
            status: "credit",
            date: Date.now(),
            description: `Order ${orderId} product ${productId} returned`,
          },
        },
      }
    );
    await findUser.save();

    findOrder.product[productIndex].productStatus = "Returned";
    findOrder.totalPrice -= productData.price * productData.quantity;
    findOrder.finalAmount -= productData.price * productData.quantity;

    await findOrder.save();

    const allProductsReturned = findOrder.product.every((product) => product.productStatus === "Returned");
    if (allProductsReturned) {
      findOrder.status = "Returned";
      await findOrder.save();
    }

    res.status(200).json({ success: true, message: "Return request initiated successfully" });
  } catch (error) {
    next(error);
  }
};

const generateOrderRazorpay = (orderId, total) => {
  return new Promise((resolve, reject) => {
    const options = {
      amount: total * 100,
      currency: "INR",
      receipt: String(orderId),
    };
    instance.orders.create(options, (err, order) => {
      if (err) {
        reject(err);
      } else {
        resolve(order);
      }
    });
  });
};

const verify = async (req, res, next) => {
  try {
    let hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(
      `${req.body.payment.razorpay_order_id}|${req.body.payment.razorpay_payment_id}`
    );
    hmac = hmac.digest("hex");

    if (hmac === req.body.payment.razorpay_signature) {
      res.json({ status: true });
    } else {
      const orderId = req.body.order.receipt;
      await Order.updateOne(
        { _id: orderId },
        { $set: { status: "Pending" } }
      );
      res.json({
        status: false,
        message: "Payment was declined by the bank in test mode",
        orderId: orderId
      });
    }
  } catch (error) {
    next(error);
  }
};

const downloadInvoice = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate('userId');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Prepare the base products array
    let products = order.product.map(prod => ({
      "quantity": prod.quantity,
      "description": prod.name || prod.title,
      "tax": 0,
      "price": prod.price,
    }));

    // Add delivery charge as a line item if it exists
    if (order.deliveryCharge && order.deliveryCharge > 0) {
      products.push({
        "quantity": 1,
        "description": "Delivery Charge",
        "tax": 0,
        "price": order.deliveryCharge,
      });
    }

    const data = {
      "documentTitle": "INVOICE",
      "currency": "INR",
      "taxNotation": "gst",
      "marginTop": 25,
      "marginRight": 25,
      "marginLeft": 25,
      "marginBottom": 25,
      apiKey: process.env.EASYINVOICE_API,
      mode: "production",
      images: {
        logo: "https://res.cloudinary.com/dn20pprrf/image/upload/v1740568840/jtbzbwaonl0vsppodtr0.png",
      },
      "sender": {
        "company": "Furni",
        "address": "Malappuram",
        "zip": "673638",
        "city": "Kondotty",
        "country": "India"
      },
      "client": {
        "company": order.address[0].name,
        "address": order.address[0].landMark + ", " + order.address[0].city,
        "zip": order.address[0].pincode,
        "city": order.address[0].state,
        "country": "India"
      },
      "information": {
        "number": order.orderId,
        "date": moment(order.createdOn).format("YYYY-MM-DD HH:mm:ss"), // Changed order.date to order.createdOn
      },
      "products": products,
      "bottomNotice": "Thank you for your business",
    };

    const result = await easyinvoice.createInvoice(data);
    const invoicePath = path.join(__dirname, "../../public/invoice/");

    if (!fs.existsSync(invoicePath)) {
      fs.mkdirSync(invoicePath, { recursive: true });
    }

    const invoiceFilePath = path.join(invoicePath, `invoice_${orderId}.pdf`);
    fs.writeFileSync(invoiceFilePath, result.pdf, 'base64');
    res.download(invoiceFilePath, `invoice_${orderId}.pdf`, (err) => {
      if (err) {
        console.error("Error downloading the file", err);
      }
      fs.unlinkSync(invoiceFilePath);
    });
  } catch (error) {
    next(error);
  }
};

const addReview = async (req, res, next) => {
  try {
    const { productId, rating, reviewText } = req.body;
    const userId = req.session.user;

    if (!productId || !rating || !reviewText) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    product.reviews.push({
      userId: userId,
      rating: rating,
      reviewText: reviewText,
      date: new Date()
    });

    await product.save();

    res.status(200).json({ success: true, message: "Review added successfully" });
  } catch (error) {
    next(error);
  }
};

const generateRazorpayOrder = async (req, res, next) => {
  try {
    const { orderId, amount } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "Pending" || order.payment !== "razorpay") {
      return res.status(400).json({ success: false, message: "Cannot retry payment for this order" });
    }

    const razorPayOrder = await generateOrderRazorpay(orderId, amount);

    res.json({
      success: true,
      razorPayOrder: razorPayOrder,
      orderId: orderId
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCheckoutPage,
  applyCoupon,
  deleteProduct,
  cancelOrder,
  orderPlaced,
  getOrderDetailsPage,
  verify,
  changeSingleProductStatus,
  paymentConfirm,
  returnorder,
  downloadInvoice,
  addReview,
  generateRazorpayOrder
};