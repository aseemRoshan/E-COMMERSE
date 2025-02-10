const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Cart = require("../../models/cartSchema");
const mongodb = require("mongodb");

const getCartPage = async (req, res) => {
    try {
        const userId = req.session.user._id;

        // Find the user's cart
        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart) {
            return res.render("cart", { cartItems: [], total: 0 });
        }

        // Map cart items for rendering
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

        res.render("cart", { cartItems, total });
    } catch (error) {
        console.error("Error fetching cart data:", error);
        res.redirect("/pageNotFound");
    }
};
const addToCart = async (req, res) => {
    try {
        console.log("Request Body:", req.body); // Log the request body
        console.log("Session User:", req.session.user); // Log the session user

        // Check if the user is logged in
        if (!req.session.user) {
            console.log("User not logged in");
            return res.status(401).json({ message: "User not logged in" });
        }

        const userId = req.session.user._id;
        const productId = req.body.productId;
        const quantity = req.body.quantity || 1; // Default quantity is 1

        console.log("User ID:", userId);
        console.log("Product ID:", productId);

        // Validate the productId
        if (!mongodb.ObjectId.isValid(productId)) {
            console.log("Invalid product ID");
            return res.status(400).json({ message: "Invalid product ID" });
        }

        // Find the product to get its price
        const product = await Product.findById(productId);
        if (!product) {
            console.log("Product not found");
            return res.status(404).json({ message: "Product not found" });
        }

        console.log("Product found:", product);

        // Find the user's cart or create a new one
        let cart = await Cart.findOne({ userId });

        if (!cart) {
            console.log("Creating new cart for user");
            cart = new Cart({ userId, items: [] });
        }

        console.log("Cart before update:", cart);

        // Check if the product is already in the cart
        const existingItem = cart.items.find(item => item.productId.toString() === productId);

        if (existingItem) {
            // Update quantity if the product is already in the cart
            console.log("Product already in cart, updating quantity");
            existingItem.quantity += quantity;
            existingItem.totalPrice = existingItem.quantity * product.salePrice;
        } else {
            // Add new product to the cart
            console.log("Adding new product to cart");
            cart.items.push({
                productId,
                quantity,
                price: product.salePrice,
                totalPrice: quantity * product.salePrice,
            });
        }

        // Save the cart
        await cart.save();

        console.log("Cart saved successfully");

        res.json({ message: "Product added to cart successfully", cart });
    } catch (error) {
        console.error("Error adding product to cart:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};


  
  const deleteItem = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId } = req.body;

        // Find the user's cart
        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        // Remove the item from the cart
        cart.items = cart.items.filter(item => item.productId.toString() !== productId);

        await cart.save();

        res.json({ message: "Product removed from cart successfully" });
    } catch (error) {
        console.error("Error removing product from cart:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


const changeQuantity = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId, quantity } = req.body;

        // Find the user's cart
        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        // Find the item in the cart
        const cartItem = cart.items.find(item => item.productId._id.toString() === productId);

        if (!cartItem) {
            return res.status(404).json({ message: "Product not found in cart" });
        }

        // Update the quantity
        cartItem.quantity = quantity;
        cartItem.totalPrice = cartItem.quantity * cartItem.productId.salePrice;

        await cart.save();

        // Calculate the new total
        const total = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);

        res.json({ message: "Quantity updated successfully", grandTotal: total });
    } catch (error) {
        console.error("Error changing product quantity:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = {
    getCartPage,
    addToCart,
    deleteItem,
    changeQuantity,
}
