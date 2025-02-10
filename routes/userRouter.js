const express = require('express');
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require('passport');
const productController = require("../controllers/user/productController");
const profileController = require("../controllers/user/profileController");
const wishlistController = require("../controllers/user/wishlistController");
const cartController = require("../controllers/user/cartController");
const { userAuth } = require('../middlewares/auth');

router.get("/auth/google",passport.authenticate("google",{scope:['profile','email']}));
// router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:"/signup"}),(req,res)=>{
    
//     res.redirect('/')
// })
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.redirect('/signup');
        }
        
        req.session.user = user; 
        res.locals.user = req.session.user;
        
        console.log("User logged in:", user);
        res.redirect('/');
    } catch (err) {
        console.error("Google OAuth Error:", err);
        res.redirect('/signup');
    }
});

router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomepage)
router.get("/signup",userController.loadSignup)
router.get("/shop",userController.loadShopping)
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get("/login",userController.loadLogin)
router.post('/login',userController.login)
router.get("/logout",userController.logout);


//shopping page
router.get("/filter",userController.filterProduct);
router.get("/filterPrice",userController.filterByPrice);
router.post("/search",userController.searchProducts);
//product management
router.get("/product-details",productController.productDetails)

//profile management
router.get("/forgot-password",profileController.getForgetPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);
router.post("/reset-password",profileController.postNewPassword);
router.get("/userProfile",userAuth,profileController.userProfile);
router.get("/change-email",userAuth,profileController.changeEmail)
router.post("/change-email",userAuth,profileController.changeEmailValid);
router.post("/verify-email-otp",userAuth,profileController.verifyEmailOtp);
router.post("/update-email",userAuth,profileController.updateEmail);
router.get("/change-password",userAuth,profileController.changePassword);
router.post("/change-password",userAuth,profileController.changePasswordValid);
router.post("/verify-changepassword-otp",userAuth,profileController.verifyChangePassOtp)



//Address Management
router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress);
router.get("/editAddress",userAuth,profileController.editAddress);
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress)


//Wishlist Management
router.get("/wishlist",userAuth,wishlistController.loadWishlist);
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist);
router.get("/removeFromWishlist",userAuth,wishlistController.removeProduct);

//Cart Management
router.get("/cart",userAuth,cartController.getCartPage);
router.post("/addToCart", userAuth, cartController.addToCart);
router.post("/deleteItem", userAuth, cartController.deleteItem);
router.post("/changeQuantity", userAuth, cartController.changeQuantity);





module.exports = router;