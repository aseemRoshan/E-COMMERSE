const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");


const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;

        // Fetch the main product and populate its category
        const product = await Product.findById(productId).populate('category');

        if (!productId) {
            return res.status(400).send("Product ID is missing");
        }

        if (!product) {
            console.log("Product not found for ID:", productId);
            return res.redirect("/pageNotFound"); // Redirect if product doesn't exist
        }

        // Fetch related products from the same category (excluding the current product)
        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId } // Exclude current product
        })
        .limit(4) // Limit to 4 related products
        .select('productName productImage salePrice regularPrice'); // Select specific fields

        // Calculate total offer (discount percentage)
        const totalOffer = Math.round(
            ((product.regularPrice - product.salePrice) / product.regularPrice) * 100
        );

        // Get category details
        const findCategory = product.category || {};
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const combinedOffer = categoryOffer + productOffer;

        // Render the product details page with all necessary data
        res.render("product-details", {
            product: product,
            relatedProducts, // Pass related products to the view
            totalOffer: combinedOffer, // Use combined offer (category + product)
            quantity: product.quantity,
            category: findCategory,
        });

    } catch (error) {
        console.error("Error fetching product details:", error);
        res.redirect("/pageNotFound");
    }
};



const getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        
        // Fetch the main product
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Fetch related products
        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId }
        })
        .limit(4)
        .select('productName productImage salePrice regularPrice');
        
        // Calculate offer percentage
        const totalOffer = calculateOffer(product.regularPrice, product.salePrice);
        
        res.render('product-detail', {
            product,
            relatedProducts,
            totalOffer,
            quantity: product.quantity,
            category: await Category.findById(product.category)
        });

    } catch (error) {
        console.error('Error in getProductDetails:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Helper function to calculate offer percentage
function calculateOffer(regularPrice, salePrice) {
    if (regularPrice && salePrice) {
        return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
    }
    return 0;
}




module.exports = {
    productDetails,
    getProductDetails,
}