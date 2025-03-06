// app.js (alternative)
const express = require('express');
const app = express();
const path = require('path');
const env = require('dotenv').config();
const session = require("express-session");
const passport = require("./config/passport.js");
const db = require('./config/db');
const userRouter = require("./routes/userRouter.js");
const adminRouter = require("./routes/adminRouter");
const errorHandler = require("./middlewares/errorHandler.js");
const methodOverride = require('method-override');

db();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.set("cache-control", "no-store");
    next();
});

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")]);
app.use(express.static(path.join(__dirname, "public")));

app.use(methodOverride('_method'));

// Routes
app.use("/admin", adminRouter);
app.use("/", userRouter);

// Global 404 handler
app.use((req, res, next) => {
    if (req.path.startsWith('/admin')) {
        res.redirect('/admin/pageerror'); // Admin 404
    } else {
        res.render('page-404'); // User 404
    }
});



const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
    console.log(`Server Running on`, PORT);
});

module.exports = app;