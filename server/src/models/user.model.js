import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { SUPPORTED_LANGUAGE_CODES, MAX_PROFILES, KID_AGE_LIMIT } from "../constants.js"

// works out whether a profile counts as a "kid" profile from its date of birth
export const calculateIsKid = (dob) => {
    if (!dob) return false
    const birthDate = new Date(dob)
    if (isNaN(birthDate.getTime())) return false

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
    }
    return age < KID_AGE_LIMIT
}

const profileSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        dob: {
            type: Date
        },
        isKid: {
            type: Boolean,
            default: false
        },
        language: {
            type: String,
            enum: SUPPORTED_LANGUAGE_CODES,
            default: "en_US"
        },
        avatar: {
            type: String // cloudinary url or preset avatar url
        },
        // hashed pin/key used to lock this specific profile. null/undefined = no lock set
        pin: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
)

profileSchema.pre("save", async function (next) {
    if (this.isModified("dob")) {
        this.isKid = calculateIsKid(this.dob)
    }

    if (this.isModified("pin") && this.pin) {
        this.pin = await bcrypt.hash(this.pin, 10)
    }
    next()
})

profileSchema.methods.isPinCorrect = async function (pin) {
    if (!this.pin) return true // no lock set on this profile
    return await bcrypt.compare(pin, this.pin)
}

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true, 
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowecase: true,
            trim: true, 
        },
        fullName: {
            type: String,
            required: true,
            trim: true, 
            index: true
        },
        avatar: {
            type: String, // cloudinary url
            // required: true,
        },
        coverImage: {
            type: String, // cloudinary url
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        profiles: {
            type: [profileSchema],
            validate: {
                validator: function (profiles) {
                    return profiles.length <= MAX_PROFILES
                },
                message: `A maximum of ${MAX_PROFILES} profiles is allowed per account`
            }
        },
        password: {
            type: String,
            required: [true, 'Password is required']
        },
        refreshToken: {
            type: String
        }

    },
    {
        timestamps: true
    }
)

userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema)