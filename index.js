require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// const connectDb = require('./DBconnect/conn')
const app = express()
const Router = require('express')
const routes = require('./routes/routes')
const mongoose = require("mongoose");
const multer = require('multer');
const fileUpload = require("express-fileupload");
const cors = require('cors');
const upload = multer({ storage: multer.memoryStorage() });
// connectDb()

// Enable CORS for all origins
app.use(cors({
  origin: '*', // Allow all origins - change this in production to specific domains
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
app.use(
  fileUpload({
    useTempFiles: true,
  })
);

// Ensure uploads directory exists and serve static files
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const database = mongoose.connection;
database.on("error", (error) => {
  console.log(error);
});

database.once("connected", () => {
  console.log("Database Connected Successfully");
});
app.use("/", routes)

app.listen(process.env.PORT, "0.0.0.0", () => {
  console.log(`SERVER is listening at PORT ${process.env.PORT}`)
})
