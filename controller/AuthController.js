const userModel = require('../Models/userModel');
const bodyParser = require("body-parser");
const Helper =require('../Helper/Helper')
const jwt = require('jsonwebtoken')
exports.createUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.send("Username and password are required");
        } else {
           
            var new_user = new userModel({
                username:username,
                password:password,
                email:req.body.email?req.body.email:""
            })
            let user = await new_user.save()
            
            Helper.response("Success","User Created Successfully",{},res,200); 

          
        }
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
};
exports.Login = async(req,res)=>{
    try{
        const {username,password}=req.body;
        if(!username||!password){
           return  Helper.response("Failed","Please provide Username and Password",{},res,200)
        }
        const user = await userModel.findOne( { username: username} );
        console.log(user)
        if (user && user.password==password){
           
            let token= jwt.sign({ id:user._id }, process.env.SECRET_KEY, {
                expiresIn: "50m",
              });
              Helper.updateToken(user._id,token)
              .then((data)=> {
                Helper.response("Success","Logged In successfully.",{ 
                    id: user.id,
                    username: user.username,
                    token: token,
                    base_url: process.env.BASE_URL,
                  },
                  res,
                  200
                );
              })
        }
    }catch(err){}
}
