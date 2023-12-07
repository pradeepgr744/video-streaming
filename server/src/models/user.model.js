import mongoose, { Schema } from 'mongoose';
import jwt from "jsonwebtoken";
import bcrypt, { genSalt, genSaltSync } from "bcrypt";

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
        lowercase: true,
        trim: tru
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    avatar: {
        type: String, //cloudinary url
        required: true
    },
    coverImage: {
        type: String
    },
    watchHistory: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Video"
        }
    ],
    password: {
        type: String,
        required: [true, 'Password is required'],
    },
    refreshToken: {
        type: String,
    }

}, 
{ timestamps: true })

userSchema.pre("save",async function (next){
    if(this.isModified("password")){
    this.password=bcrypt.hash(this.password,10)
    next()
    }else{next()}
})

userSchema.methods.isPasswordCorrect=async function(password){

}

export const user = mongoose.model('user', userSchema);