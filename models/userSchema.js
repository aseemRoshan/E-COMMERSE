const mongoose = require('mongoose');

const {Schema} = mongoose;


const userSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
    },
    phone:{
        type:String,
        required:false,
        unique:true,
        sparse:true,
        default:null
    },
     googleId:{
         type:String,
        unique:true,
        //    sparse:true,
        
     },
    password:{
        type:String,
        required:false,
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    cart:{
        type:Array,
    },
    // cart:[{
    //     type:Schema.Types.ObjectId,
    //     ref:"Cart",
    // }],
    // cart:[{
    //     productId:{
    //         type:Schema.Types.ObjectId,
    //         ref:"Product",
    //         required:true,
    //     },
    //     quantity:{
    //         type:Number,
    //         required:true,
    //         default:1,
    //     }
    // }],

    wallet:{
        type:Schema.Types.ObjectId,
         default:null

    },
    wishlist:[{
        type:Schema.Types.ObjectId,
        ref:"Wishlist"
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn:{
        type:Date,
        default:Date.now,
    },
    referalCod:{
        type:String,
        // required:true
        default:null,
    },
    redemed:{
        type:Boolean,
        default:false
    },
    redeemedUsers:{
        type:Schema.Types.ObjectId,
        ref:"User",
        // required:true,
    },
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:"Category",
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now,
        }
    }]

})



const User = mongoose.model("User",userSchema);

module.exports = User;