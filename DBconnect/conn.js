const mongoose = require('mongoose');
// "lakshya1234@testdb"
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(`mongodb+srv://lakshya:lakshya1234@userreg.qjnxhvm.mongodb.net/`, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`MongoDB Connected: {conn.connection.host}`);
  } catch (error) {
    console.error(error.message);

  }
}
module.exports = connectDB;
