const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");








const  pageerror = async (req,res) =>{

    res.render("admin-error")
}




const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}

    
const login = async (req,res) =>{

    try {
        
        const {email,password} = req.body;
        const admin = await User.findOne({email,isAdmin:true})
        if(admin){

            const passwordMatch = bcrypt.compare(password,admin.password);
            if(passwordMatch) {
                req.session.admin = true;
                return res.redirect("/admin")
            }else{
                return res.redirect("/login")
            }
        }else{
            return res.redirect("/login")
        }

    } catch (error) {
        

       console.log("login error",error);
       return res.redirect("/pageerror")
       

    }
}


const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            const totalSales = await Order.aggregate([
                { $group: { _id: null, total: { $sum: "$finalAmount" } } }
            ]);

            const totalOrders = await Order.countDocuments();
            const returnedOrders = await Order.countDocuments({ status: "Returned" });
            const pendingOrders = await Order.countDocuments({ status: "Pending" });
            const deliveredOrders = await Order.countDocuments({ status: "Delivered" });
            const shippedOrders = await Order.countDocuments({ status: "Shipped" });
            const processingOrders = await Order.countDocuments({ status: "Processing" });
            const totalUsers = await User.countDocuments();
            const totalDiscount = await Order.aggregate([
                { $group: { _id: null, total: { $sum: "$discount" } } }
            ]);

            res.render("dashboard", {
                totalSales: totalSales[0]?.total || 0,
                totalOrders,
                returnedOrders,
                pendingOrders,
                deliveredOrders,
                shippedOrders,
                processingOrders,
                totalUsers,
                totalDiscount: totalDiscount[0]?.total || 0,
            });
        } catch (error) {
            console.log("Dashboard error", error);
            res.redirect("/pageerror");
        }
    } else {
        res.redirect("/admin/login");
    }
};



const logout = async (req,res) =>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroying session",err);
                return res.redirect("/pageerror")
                
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        
        console.log("Unexpected error during logout",error);
        res.redirect("/pageerror")
        
    }
}





module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
}