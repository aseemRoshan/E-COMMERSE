const express = require('express');
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require('passport');
const productController = require("../controllers/user/productController");


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




module.exports = router;