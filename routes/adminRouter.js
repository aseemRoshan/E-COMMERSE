const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const { userAuth, adminAuth } = require("../middlewares/auth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const multer = require("multer");
const storage = require("../helpers/multers");
const uploads = multer({ storage: storage });
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const couponController = require("../controllers/admin/couponController");

//logn, Dashboard
router.get("/pageerror", adminController.pageError);
router.get("/login", adminController.loadLogin);
router.post("/admin-login", adminController.login);
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);
router.get("/dashboard", adminAuth, adminController.loadDashboard);
router.get("/export-excel", adminAuth, adminController.generateExcelReport);
router.get("/export-pdf", adminAuth, adminController.generatePdfReport);

// Customer management
router.get("/Customers", adminAuth, customerController.customerInfo);
router.patch("/Customers/:id/block", adminAuth, customerController.customerBlocked);
router.patch("/Customers/:id/unblock", adminAuth, customerController.customerUnBlocked);

// Category Routes
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/category", adminAuth, categoryController.addCategory); 
router.patch("/category/:id/offer", adminAuth, categoryController.addCategoryOffer); 
router.delete("/category/:id/offer", adminAuth, categoryController.removeCategoryOffer); 
router.patch("/category/:id/unlist", adminAuth, categoryController.getListCategory); 
router.patch("/category/:id/list", adminAuth, categoryController.getUnlistCategory); 
router.get("/category/:id/edit", adminAuth, categoryController.getEditCategory); 
router.patch("/category/:id", adminAuth, categoryController.editCategory); 

// Brand Management
router.get("/brands", adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, uploads.single("image"), brandController.addBrand);
router.get("/blockBrand", adminAuth, brandController.blockBrand);
router.get("/unBlockBrand", adminAuth, brandController.unBlockBrand);
router.get("/deleteBrand", adminAuth, brandController.deleteBrand);

// Product Management
router.get("/product-add", adminAuth, productController.getProductAddPage);
router.post("/product-add", adminAuth, uploads.array("images", 4), productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.post("/addProductOffer", adminAuth, productController.addProductOffer);
router.post("/removeProductOffer", adminAuth, productController.removeProductOffer);
router.get("/blockProduct", adminAuth, productController.blockProduct);
router.get("/unblockProduct", adminAuth, productController.unblockProduct);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, uploads.array("images", 4), productController.editProduct);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);

// Order Management
router.get("/order-list", adminAuth, orderController.getOrderListPageAdmin);
router.get("/orderDetailsAdmin", adminAuth, orderController.getOrderDetailsPageAdmin);
router.get("/changeStatus", adminAuth, orderController.changeOrderStatus);
router.post("/approveReturn", adminAuth, orderController.approveReturn);
router.post("/rejectReturn", adminAuth, orderController.rejectReturn);

// Coupon Management
router.get("/coupon", adminAuth, couponController.loadCoupon);
router.post("/createCoupon", adminAuth, couponController.createCoupon);
router.get("/editCoupon", adminAuth, couponController.editCoupon);
router.post("/updateCoupon", adminAuth, couponController.updateCoupon);
router.patch("/coupon/:id/list", adminAuth, couponController.listCoupon); 
router.patch("/coupon/:id/unlist", adminAuth, couponController.unlistCoupon); 



router.use((req, res, next) => {
    res.redirect("/admin/pageerror"); 
});


module.exports = router;
