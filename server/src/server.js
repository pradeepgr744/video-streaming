import 'dotenv/config'
import express from 'express';

const app = express();

app.use("/",(req,res)=>{
    res.send("Welcome")
})

app.listen(process.env.PORT,()=>{
    console.log("Running on port " + process.env.PORT)
})