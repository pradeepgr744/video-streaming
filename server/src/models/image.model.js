import mongoose, { Schema } from "mongoose";

// matches the existing "images" collection already seeded in the DB:
// { _id, avatars: [ "https://api.dicebear.com/9.x/adventurer/png?seed=avatar1", ... ] }
const imageSchema = new Schema(
    {
        avatars: [
            {
                type: String
            }
        ]
    },
    {
        timestamps: true
    }
);

export const Image = mongoose.model("Image", imageSchema, "images");