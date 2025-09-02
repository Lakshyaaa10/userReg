const express  = require('express');
// const connectDb = require('./DBconnect/conn')
 const app = express()
 const Router = require('express')
 const routes = require( './routes/routes' )
 const { configDotenv } = require('dotenv').config()
 const mongoose = require("mongoose");
 const multer = require('multer');
 const fileUpload = require("express-fileupload");
 const upload = multer({ storage: multer.memoryStorage() });
   // connectDb()
   app.use(express.json());
   app.use(express.urlencoded({ extended: true }));
   mongoose.connect('mongodb+srv://lakshya:lakshya1234@userreg.qjnxhvm.mongodb.net/', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  app.use(
  fileUpload({
    useTempFiles: true,
  })
);

    const database = mongoose.connection;
    database.on("error", (error) => {
      console.log(error);
    });
    
    database.once("connected", () => {
      console.log("Database Connected Successfully");
    });
app.use("/",routes)

 app.listen(process.env.PORT,()=>{
    console.log(`SERVER is listening at PORT ${process.env.PORT}`)
 })
 