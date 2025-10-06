const express = require("express");
var AuthRoutes= express.Router()
const Auth = require("../controller/AuthController")

AuthRoutes.post( "/signup", (req, res,next) =>{
     Auth.createUser(req,res,next)
})
AuthRoutes.get("/test",(req,res)=>{
    console.log('hii')
} )
AuthRoutes.post('/login',(req,res,next)=>{
    Auth.Login(req,res,next)
})
AuthRoutes.post('/logout',(req,res,next)=>{
    Auth.Logout(req,res,next)
})
AuthRoutes.get('/getUser',(req,res,next)=>{
    Auth.getUserDetails(req,res,next)
})

module.exports = AuthRoutes


