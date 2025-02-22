const User = require("../models/userSchema");

const userAuth = (req,res,next) =>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next();
            }else{
                res.redirect("/login")
            }
        })
        .catch(error=>{
            console.log("Error in user auth middleware");
            res.status(500).send("Internal Server error")
            
        })
    }else{
        res.redirect("/login")
    }
}




const adminAuth = (req,res,next) =>{
    

    console.log(req.user_id);
    
    // const isUser = await User.findById(req.user_id)
    // if(isUser && isUser.isAdmin){

    // }

    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next();
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Error in adminauth middleware",error);
        res.status(500).send("Internal Server Error")
        
    })
}

module.exports = {
    userAuth,
    adminAuth,
}