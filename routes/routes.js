const express = require("express");
var routes = express.Router()

var AuthRoutes = require( "./AuthRouter")

routes.use("/",AuthRoutes)



routes.use("*", (req, res, next) => {
    res.send("Not Found");
  });

  module.exports = routes;