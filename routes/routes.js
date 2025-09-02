const express = require("express");
var routes = express.Router()

var AuthRoutes = require( "./AuthRouter");
const RegisterRouter = require("./RegisterRouter");
const vehicleRoutes= require('./vehicleRouter')
routes.use("/",AuthRoutes)
routes.use("/reg",RegisterRouter)
routes.use('/veh',vehicleRoutes)

routes.use("*", (req, res, next) => {
    res.send("Not Found");
  });

  module.exports = routes;