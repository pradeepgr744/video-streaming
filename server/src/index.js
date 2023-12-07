
import dotenv from "dotenv"
import express from 'express';
import connectDB from './db/db.js';

const app=express();

dotenv.config({
    path:'./env'
})

connectDB()
.then(()=>{
    app.listen(process.env.PORT||8000,()=>{
        console.log("server is running on port " + process.env.PORT)
    })
})
.catch((err)=>{
    console.log("MONGO db connection failed: " + err)
})

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

