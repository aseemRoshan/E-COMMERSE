const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Cart = require("../../models/cartSchema");
const mongodb = require("mongodb");

const getCartPage = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart) {
            return res.render("cart", { cartItems: [], total: 0, outOfStockMessages: [] });
        }

        const cartItems = cart.items.map(item => ({
            productId: item.productId._id.toString(),
            name: item.productId.productName,
            price: item.productId.salePrice,
            quantity: item.quantity,
            image: item.productId.productImage[0],
            total: item.quantity * item.productId.salePrice,
            stock: item.productId.quantity,
        }));

        const total = cartItems.reduce((acc, item) => acc + item.total, 0);

        // Check if any item is out of stock
        const outOfStockItems = cartItems.filter(item => item.stock < item.quantity);
        const outOfStockMessages = outOfStockItems.map(item => `The product "${item.name}" is out of stock.`);

        res.render("cart", { cartItems: cartItems, total: total, user: user, outOfStockMessages: outOfStockMessages });
    } catch (error) {
        next(error);
    }
};

const addToCart = async (req, res, next) => {
    try {
        console.log("Request Body:", req.body);
        console.log("Session User:", req.session.user);

        if (!req.session.user) {
            console.log("User not logged in");
            return res.status(401).json({ message: "User not logged in" });
        }

        const userId = req.session.user._id;
        const productId = req.body.productId;
        const quantity = req.body.quantity || 1;

        console.log("User ID:", userId);
        console.log("Product ID:", productId);

        if (!mongodb.ObjectId.isValid(productId)) {
            console.log("Invalid product ID");
            return res.status(400).json({ message: "Invalid product ID" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            console.log("Product not found");
            return res.status(404).json({ message: "Product not found" });
        }

        console.log("Product found:", product);

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            console.log("Creating new cart for user");
            cart = new Cart({ userId, items: [] });
        }

        console.log("Cart before update:", cart);

        const existingItem = cart.items.find(item => item.productId.toString() === productId);

        if (existingItem) {
            console.log("Product already in cart, updating quantity");
            existingItem.quantity += quantity;
            existingItem.totalPrice = existingItem.quantity * product.salePrice;
        } else {
            console.log("Adding new product to cart");
            cart.items.push({
                productId,
                quantity,
                price: product.salePrice,
                totalPrice: quantity * product.salePrice,
            });
        }

        await cart.save();

        console.log("Cart saved successfully");

        res.json({ message: "Product added to cart successfully", cart });
    } catch (error) {
        next(error);
    }
};

const deleteItem = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const { productId } = req.body;

        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        cart.items = cart.items.filter(item => item.productId.toString() !== productId);

        await cart.save();

        res.json({ message: "Product removed from cart successfully" });
    } catch (error) {
        next(error);
    }
};

const changeQuantity = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const { productId, quantity } = req.body;

        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const cartItem = cart.items.find(item => item.productId._id.toString() === productId);

        if (!cartItem) {
            return res.status(404).json({ message: "Product not found in cart" });
        }

        // Update the quantity
        cartItem.quantity = quantity;
        cartItem.totalPrice = cartItem.quantity * cartItem.productId.salePrice;

        await cart.save();

        const total = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);

        res.json({ message: "Quantity updated successfully", grandTotal: total });
    } catch (error) {
        next(error);
    }
};

const checkProductInCart = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const productId = req.body.productId;

        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.json({ exists: false });
        }

        const productExists = cart.items.some(item => item.productId.toString() === productId);
        res.json({ exists: productExists });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCartPage,
    addToCart,
    deleteItem,
    changeQuantity,
    checkProductInCart,
};
