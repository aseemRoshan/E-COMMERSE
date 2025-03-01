const mongoose = require('mongoose');
const { Schema } = mongoose;

function generateReferralCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < 8; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
        required: false,
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: {
        type: Array,
    },
    wallet: {
        type: Number,
        default: 0,
    },
    history: [
        {
            amount: { type: Number, required: true },
            status: { type: String, required: true },
            date: { type: Date, required: true },
            description: { type: String }
        }
    ],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist"
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    createdOn: {
        type: Date,
        default: Date.now,
    },
    referalCode: {
        type: String,
        unique: true,
    },
    referralEarnings: {
        type: Number,
        default: 0,
    },
    redeemedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
        brand: {
            type: String
        },
        searchOn: {
            type: Date,
            default: Date.now,
        }
    }],
    otp: { type: String },
    otpExpires: { type: Date },
    isVerified: { type: Boolean, default: false },
});

// Pre-save hook to generate unique referral code
userSchema.pre('save', async function(next) {
    if (!this.referalCode) {
        let unique = false;
        let code;
        while (!unique) {
            code = generateReferralCode();
            const existingUser = await this.constructor.findOne({ referalCode: code });
            unique = !existingUser;
        }
        this.referalCode = code;
    }
    next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;