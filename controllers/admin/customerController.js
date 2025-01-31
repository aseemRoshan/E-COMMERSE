const User = require("../../models/userSchema");

const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = req.query.page ? parseInt(req.query.page) : 1;
        const limit = 3;

        // Fetch users based on search criteria
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } }, // Case-insensitive search
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        // Get total count of users for pagination
        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        });

        const totalPages = Math.ceil(count / limit);

        // Pass data to the EJS template
        res.render("Customers", {
            data: userData,
            currentPage: page,
            totalPages: totalPages,
        });

    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).send("Internal Server Error");
    }
};




const customerBlocked = async(req,res)=>{
    try{

        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/Customers")

    }catch(error){

        res.redirect("/pageerror")
    }
};


const customerunBlocked = async (req,res)=>{
         try {
             let id = req.query.id;
             await User.updateOne({_id:id},{$set:{isBlocked:false}})
             res.redirect("/admin/Customers")
         } catch (error) {
            
              res.redirect("/pageerror")
            
         }
}






module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked,
}