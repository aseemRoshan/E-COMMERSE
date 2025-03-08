const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Brand = require("../../models/brandSchema");

const productDetails = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const user = userId ? await User.findById(typeof userId === 'object' ? userId._id : userId) : null;
        const productId = req.query.id;

        if (!productId) {
            return res.status(400).send("Product ID is missing");
        }

        const product = await Product.findById(productId).populate('category');
        if (!product) {
            console.log("Product not found for ID:", productId);
            return res.redirect("/pageNotFound");
        }

        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId },
            isBlocked: false
        })
            .limit(4)
            .select('productName productImage salePrice regularPrice');

        const totalOffer = Math.round(
            ((product.regularPrice - product.salePrice) / product.regularPrice) * 100
        );

        const findCategory = product.category || {};
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const combinedOffer = categoryOffer + productOffer;

        // Pass the wishlist data to the template
        const wishlist = user ? user.wishlist || [] : [];

        res.render("product-details", {
            user,
            product,
            relatedProducts,
            totalOffer: combinedOffer,
            quantity: product.quantity,
            category: findCategory,
            wishlist: wishlist
        });
    } catch (error) {
        next(error);
    }
};

const getProductDetails = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const user = userId ? await User.findById(typeof userId === 'object' ? userId._id : userId) : null;
        const productId = req.params.id;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId }
        })
            .limit(4)
            .select('productName productImage salePrice regularPrice');

        const totalOffer = calculateOffer(product.regularPrice, product.salePrice);

        // Pass the wishlist data to the template
        const wishlist = user ? user.wishlist || [] : [];

        res.render('product-details', {
            user,
            product,
            relatedProducts,
            totalOffer,
            quantity: product.quantity,
            category: await Category.findById(product.category),
            wishlist: wishlist
        });
    } catch (error) {
        next(error);
    }
};

function calculateOffer(regularPrice, salePrice) {
    if (regularPrice && salePrice) {
        return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
    }
    return 0;
}

module.exports = {
    productDetails,
    getProductDetails,
};