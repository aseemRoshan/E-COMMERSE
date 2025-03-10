const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const bcrypt = require('bcrypt');




const loadSignup = async (req, res, next) => {
    try {
        return res.render("signup");
    } catch (error) {
        next(error);
    }
};

const loadShopping = async (req, res, next) => {
    try {
        const user = req.session.user;
        let userData = null;
        let wishlist = [];

        if (user) {
            userData = await User.findOne({ _id: user });
            wishlist = userData.wishlist || []; 
        }

        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map((category) => category._id.toString());
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        const selectedCategory = req.query.category;
        const sortQuery = req.query.sort;

        let query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        if (selectedCategory) {
            query.category = selectedCategory;
        }

        let sortOption = {};
        switch (sortQuery) {
            case 'price-low':
                sortOption = { salePrice: 1 };
                break;
            case 'price-high':
                sortOption = { salePrice: -1 };
                break;
            case 'name-asc':
                sortOption = { productName: 1 };
                break;
            case 'name-desc':
                sortOption = { productName: -1 };
                break;
            case 'created-new':
                sortOption = { createdOn: -1 };
                break;
            case 'created-old':
                sortOption = { createdOn: 1 };
                break;
            default:
                sortOption = { createdOn: -1 };
        }

        const products = await Product.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const brands = await Brand.find({ isBlocked: false });
        const categoriesWithIds = categories.map(category => ({ _id: category._id, name: category.name }));

        return res.render("shop", {
            user: userData,
            products: products,
            categories: categoriesWithIds,
            brands: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            user: req.session.user || null,
            selectedCategory: selectedCategory || null,
            wishlist: wishlist 
        });
    } catch (error) {
        next(error);
    }
};const filterProduct = async (req, res, next) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
        const brand = req.query.brand;
        const findCategory = category ? await Category.findOne({ _id: category }) : null;
        const findBrand = brand ? await Brand.findOne({ _id: brand }) : null;
        const brands = await Brand.find({}).lean();
        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        if (findCategory) {
            query.category = findCategory._id;
        }

        if (findBrand) {
            query.brand = findBrand.brandName;
        }

        let findProducts = await Product.find(query).lean();
        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        const categories = await Category.find({ isListed: true });

        let itemsPerPage = 12;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);

        let userData = null;
        let wishlist = [];
        if (user) {
            userData = await User.findOne({ _id: user });
            wishlist = userData.wishlist || []; 
            if (userData) {
                const searchEntry = {
                    category: findCategory ? findCategory._id : null,
                    brand: findBrand ? findBrand.brandName : null,
                    searchedOn: new Date(),
                };
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        req.session.filteredProducts = currentProduct;

        res.render("shop", {
            user: userData,
            products: currentProduct,
            categories: categories,
            brands: brands,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            selectedBrand: brand || null,
            wishlist: wishlist 
        });
    } catch (error) {
        next(error);
    }
};

const filterByPrice = async (req, res, next) => {
    try {
        const user = req.session.user;
        let userData = null;
        let wishlist = [];
        if (user) {
            userData = await User.findOne({ _id: user });
            wishlist = userData.wishlist || []; 
        }

        const brands = await Brand.find({}).lean();
        const categories = await Category.find({ isListed: true }).lean();

        let findProducts = await Product.find({
            salePrice: { $gt: req.query.gt, $lt: req.query.lt },
            isBlocked: false,
            quantity: { $gt: 0 }
        }).lean();

        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        let itemsPerPage = 12;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);
        req.session.filteredProducts = findProducts;

        res.render("shop", {
            user: userData,
            products: currentProduct,
            categories: categories,
            brands: brands,
            totalPages,
            currentPage,
            wishlist: wishlist 
        });
    } catch (error) {
        next(error);
    }
};
const searchProducts = async (req, res, next) => {
    try {
        const user = req.session.user;
        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
        }
        let search = req.query.query;

        const brands = await Brand.find({}).lean();
        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map(category => category._id.toString());
        let searchResult = [];

        if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
            searchResult = req.session.filteredProducts.filter(product =>
                product.productName.toLowerCase().includes(search.toLowerCase())
            );
        } else {
            searchResult = await Product.find({
                productName: { $regex: ".*" + search + ".*", $options: "i" },
                isBlocked: false,
                quantity: { $gt: 0 },
                category: { $in: categoryIds }
            }).lean();
        }

        searchResult = searchResult.map(product => ({
            ...product,
            reviews: product.reviews || []
        }));

        searchResult.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        res.json(searchResult);
    } catch (error) {
        console.error('Error in searchProducts:', error);
        next(error);
    }
};
const pageNotFound = async (req, res, next) => {
    try {
        res.render("page-404");
    } catch (error) {
        next(error);
    }
};

const loadHomepage = async (req, res, next) => {
    try {
        const userid = req.session.user;
        const categories = await Category.find({ isListed: true });
        let products = await Product.find(
            { isBlocked: false,
                category: { $in: categories.map(category => category._id) }, quantity: { $gt: 0 }
            }
        )

        products.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        products = products.slice(0, 3);

        if (userid) {
            const userData = await User.findById(userid);
            res.render("home", { user: userData, products: products });
        } else {
            return res.render("home", { products: products });
        }
    } catch (error) {
        next(error);
    }
};

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,
        });

        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
}

function generateReferralCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < 8; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const signup = async (req, res, next) => {
    try {
        const { name, phone, email, password, cPassword, referalCode } = req.body;

        if (password !== cPassword) {
            return res.render("signup", { message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User with this email already exists" });
        }

        const otp = generateOtp();
        const otpExpires = new Date(Date.now() + 1 * 60 * 1000);

        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.json({ message: "email-error" });
        }

        req.session.userOtp = otp;
        req.session.userOtpExpires = otpExpires;
        req.session.userData = { name, phone, email, password, referalCode: generateReferralCode() };
        

        console.log("OTP Sent:", otp);
        console.log("OTP Expires:", otpExpires);
        console.log("Generated Referral Code:", req.session.userData.referalCode);

        if (referalCode) {
            const referringUser = await User.findOne({ referalCode });
            if (referringUser) {
                referringUser.wallet += 100; 
                referringUser.referralEarnings += 100;
                referringUser.redeemedUsers.push(req.session.userData._id);

                
                referringUser.history.push({
                    amount: 100,
                    status: "credit",
                    date: new Date(),
                    description: `Referred a friend (${email})`
                });

                await referringUser.save();

                req.session.userData.wallet = 50; 
            }
        }

        res.render("verify-otp");
    } catch (error) {
        next(error);
    }
};

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        console.error("Error hashing password", error);
        next(error);
    }
};

const verifyOtp = async (req, res, next) => {
    try {
        const { otp } = req.body;

        console.log("Received OTP:", otp);
        console.log("Stored OTP:", req.session.userOtp);
        console.log("OTP Expires:", req.session.userOtpExpires);

        if (otp === req.session.userOtp && new Date() < new Date(req.session.userOtpExpires)) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
                wallet: user.wallet || 0,
                referalCode: user.referalCode,
            });

            
            if (user.wallet === 50) {
                saveUserData.history.push({
                    amount: 50,
                    status: "credit",
                    date: new Date(),
                    description: "Used referral code"
                });
            }

            await saveUserData.save();
            req.session.user = saveUserData;
            res.json({ success: true, redirectUrl: "/" });
        } else {
            res.status(400).json({ success: false, message: "Invalid or expired OTP, please try again" });
        }
    } catch (error) {
        next(error);
    }
};

const resendOtp = async (req, res, next) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();
        const otpExpires = new Date(Date.now() + 1 * 60 * 1000);
        req.session.userOtp = otp;
        req.session.userOtpExpires = otpExpires;

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resend OTP:", otp);
            console.log("OTP Expires:", otpExpires);
            res.status(200).json({ success: true, message: "OTP Resent Successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again" });
        }
    } catch (error) {
        next(error);
    }
};

const loadLogin = async (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.render("login");
        } else {
            res.redirect("/");
        }
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const findUser = await User.findOne({ isAdmin: 0, email: email });

        if (!findUser) {
            return res.render("login", { message: "User not found" });
        }

        if (findUser.isBlocked) {
            return res.render("login", { message: "User is blocked by admin" });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect Password" });
        }

        req.session.user = findUser;
        res.locals.user = req.session.user;

        res.redirect("/");
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        delete req.session.user; 
        res.redirect("/login");
    } catch (error) {
        next(error);
    }
};

const about = async (req, res) => {
    try {
        const user = req.session.user || null; 
        res.render("about", { user }); 
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const contact = async (req, res) => {
    try {
        const user = req.session.user || null; 
        res.render("contact", { user }); 
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const sendContactEmail = async (req, res, next) => {
    try {
        const { fname, lname, email, message } = req.body;

        
        if (!fname || !lname || !email || !message) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        if (message.length < 10) {
            return res.status(400).json({ success: false, message: "Message must be at least 10 characters long" });
        }
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            return res.status(400).json({ success: false, message: "Invalid email address" });
        }

        
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });

    
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: "aseemroshan86@gmail.com",
            replyTo: email, 
            subject: `New Contact Form Submission from ${fname} ${lname}`,
            text: `
                Name: ${fname} ${lname}
                Email: ${email}
                Message: ${message}
            `,
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${fname} ${lname}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Message:</strong> ${message}</p>
            `,
        };

    
        await transporter.sendMail(mailOptions);

        
        res.status(200).json({ success: true, message: "Message sent successfully!" });
    } catch (error) {
        console.error("Error sending contact email:", error);
        next(error); 
    }
};

module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    loadShopping,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    filterProduct,
    filterByPrice,
    searchProducts,
    about,
    contact,
    sendContactEmail,
};
