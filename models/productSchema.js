

const mongoose = require("mongoose");
const {Schema} = mongoose;


const productSchema = new Schema({
    productName:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true,
    },
    brand:{
        type:String,
        required:true,
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true,
    },
    regularPrice:{
        type:Number,
        required:true,
    },
    salePrice:{
        type:Number,
        required:true,
    },
    productOffer:{
        type:Number,
        default:0,
    },
    quantity:{
        type:Number,
        default:true,
    },
    color:{
        type:String,
        required:true,
    },
    productImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false,
    },
    reviews: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        userName: { type: String, required: true },
        rating: { type: Number, min: 1, max: 5, required: true },
        reviewText: { type: String, required: true },
        date: { type: Date, default: Date.now }
      }],
    status:{
        type:String,
        enum:["Available","Out of stock","Dicountinued"],
        required:true,
        default:"Available",
    },
    createdOn:{type:Date, default: Date.now},
},{timestamps:true});

const Product = mongoose.model("Product",productSchema);

module.exports = Product;