

const mongoose = require("mongoose");
const {Schema} = mongoose;




const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
        totalPrice: { type: Number, required: true }
      }
    ],
    createdAt: { type: Date, default: Date.now }
  });
  




const Cart = mongoose.model("Cart",cartSchema);

module.exports = Cart;