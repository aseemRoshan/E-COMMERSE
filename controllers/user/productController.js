const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Brand = require("../../models/brandSchema");

const productDetails = async (req, res, next) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;

        const product = await Product.findById(productId).populate('category');

        if (!productId) {
            return res.status(400).send("Product ID is missing");
        }

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

        res.render("product-details", {
            product: product,
            relatedProducts,
            totalOffer: combinedOffer,
            quantity: product.quantity,
            category: findCategory,
        });

    } catch (error) {
        next(error);
    }
};

const getProductDetails = async (req, res, next) => {
    try {
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

        res.render('product-details', {
            product,
            relatedProducts,
            totalOffer,
            quantity: product.quantity,
            category: await Category.findById(product.category)
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
