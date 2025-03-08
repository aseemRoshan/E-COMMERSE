const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");

const loadWishlist = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        const products = await Product.find({ _id: { $in: user.wishlist } }).populate('category');
        res.render("wishlist", {
            user,
            wishlist: products,
        });
    } catch (error) {
        next(error);
    }
};

const addToWishlist = async (req, res, next) => {
    try {
        const productId = req.body.productId;
        const userId = req.session.user;
        const user = await User.findById(userId);
        if (user.wishlist.includes(productId)) {
            return res.status(200).json({ status: false, message: 'Product already in wishlist' });
        }
        user.wishlist.push(productId);
        await user.save();
        return res.status(200).json({ status: true, message: "Product added to wishlist" });
    } catch (error) {
        next(error);
    }
};

const removeProduct = async (req, res, next) => {
    try {
        const productId = req.query.productId;
        const userId = req.session.user;
        const user = await User.findById(userId);
        const index = user.wishlist.indexOf(productId);
        if (index !== -1) {
            user.wishlist.splice(index, 1);
            await user.save();
        }
        return res.redirect("/wishlist");
    } catch (error) {
        next(error);
    }
};


const getWishlistCount = async (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.json({ count: 0 });
        }
        const userId = req.session.user;
        const user = await User.findById(userId);
        const count = user.wishlist.length;
        res.json({ count });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    loadWishlist,
    addToWishlist,
    removeProduct,
    getWishlistCount, 
};