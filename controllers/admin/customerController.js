const User = require("../../models/userSchema");

const customerInfo = async (req, res, next) => {
    try {
        let search = req.query.search || "";
        let page = req.query.page ? parseInt(req.query.page) : 1;
        const limit = 3;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        });

        const totalPages = Math.ceil(count / limit);

        res.render("Customers", {
            data: userData,
            currentPage: page,
            totalPages: totalPages,
        });
    } catch (error) {
        console.error("Error fetching customers:", error);
        next(error);
    }
};

const customerBlocked = async (req, res, next) => {
    try {
        const id = req.params.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.json({ success: true, message: "Customer blocked successfully" });
    } catch (error) {
        console.error("Error blocking customer:", error);
        next(error);
    }
};

const customerUnBlocked = async (req, res, next) => {
    try {
        const id = req.params.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.json({ success: true, message: "Customer unblocked successfully" });
    } catch (error) {
        console.error("Error unblocking customer:", error);
        next(error);
    }
};

module.exports = {
    customerInfo,
    customerBlocked,
    customerUnBlocked,
};