
import dotenv from "dotenv"
// import express from 'express';
import connectDB from './db/index.js';

dotenv.config({
    path:'./env'
})

connectDB()

// const app = express();

// app.use("/",(req,res)=>{
//     res.send("Welcome")
// })

// (async()=>{
//     try {
//        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
//        app.on("error",(error)=>{
//         console.log("ERROR:",error)
//         throw error
//        })
       
// app.listen(process.env.PORT,()=>{
//     console.log("Running on port " + process.env.PORT)
// })
//     } catch (error) {
//         console.error("ERROR:",error)
//     }
// })/

