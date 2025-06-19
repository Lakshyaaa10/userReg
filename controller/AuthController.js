const userModel = require('../Models/userModel');
const bodyParser = require("body-parser");
const Helper =require('../Helper/Helper')
const jwt = require('jsonwebtoken')
exports.createUser = async (req, res) => {
    try {
        const { mobile, password, email } = req.body;

        if (!mobile || !password || !email) {
            return res.status(400).send("Mobile number, email, and password are required");
        }

        
        const existingUser = await userModel.findOne({
            $or: [{ mobile }, { email }]
        });

        if (existingUser) {
            return Helper.response("Failed", "Mobile or Email already in use", {}, res, 409);
        }

       
        const newUser = new userModel({
            mobile,
            password,
            email
        });

        const savedUser = await newUser.save();

        return Helper.response("Success", "User Created Successfully", { userId: savedUser._id }, res, 201);

    } catch (error) {
        console.error(error);
        return res.status(500).send("Internal Server Error");
    }
};
exports.Login = async(req,res)=>{
    try{
        const {mobile,password}=req.body;
        if(!mobile||!password){
           return  Helper.response("Failed","Please provide Username and Password",{},res,200)
        }
        const user = await userModel.findOne( { mobile: mobile} );

        if (user && user.password===password){
           
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
        else{
            Helper.response("Success","No User Found",{},res,200)
        }
    }catch(err){
        console.log(err)
    }
}
