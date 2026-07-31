import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true,
}))

app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}));
app.use(express.static("public"))
app.use(cookieParser())

app.get("/ping", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is active"
  });
});
//routes imports
import userRouter from './routes/user.routes.js';
import profileRouter from './routes/profile.routes.js';
app.get("/", (req, res) => {
  res.json({ message: "Video Streaming API is running ✅" });
});

//routes declaration
app.use("/api/v1/users",userRouter)
app.use("/api/v1/users/profiles",profileRouter)

//global error handler - must be registered last, after all routes
import { errorHandler } from "./middlewares/error.middleware.js";
app.use(errorHandler)


export {app}