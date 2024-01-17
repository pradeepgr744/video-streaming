import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema(
    {
        comment:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Comment"
        },
        video:{
            type: Schema.Types.ObjectId, //one who is subscribing
            ref:"Video",
        },
        likedBy:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        },
        tweet:{
            type:mongoose.Schema.Types.ObjectId, //one who is
            ref:"Tweet"
        }
    },{timestamps:true}
)


export const Like = mongoose.model('Like', likeSchema);