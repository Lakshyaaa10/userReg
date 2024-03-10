const mongoose = require ('mongoose');

const connectDB = async () => {
    try {
      const conn = await mongoose.connect(`mongodb+srv://lakshya:lakshya1234@testdb.agkkrwm.mongodb.net/`, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log(`MongoDB Connected: {conn.connection.host}`);
    } catch (error) {
      console.error(error.message);
     
    }
  }
  module.exports = connectDB;
  