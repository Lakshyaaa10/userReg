const mongoose = require('mongoose');
const User = require('../Models/userModel');
require('dotenv').config({ path: '../.env' }); // Adjust path to .env if needed

async function reproduce() {
    try {
        const uri = 'mongodb+srv://lakshya:lakshya1234@userreg.qjnxhvm.mongodb.net/';
        // Use a specific logical database for testing to avoid using 'test' if it's main
        // However, the error said 'test.users', so maybe 'test' IS the main one used.
        // I will stick to the URI found.
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        // Clean up previous test data
        await User.deleteMany({ email: { $in: ['test_repro_1@example.com', 'test_repro_2@example.com'] } });
        console.log('Cleaned up old test users');

        console.log('Creating User 1 (No googleId)...');
        const user1 = new User({
            email: 'test_repro_1@example.com',
            username: 'test_repro_1',
            password: 'password123',
            fullName: 'Test User 1',
            // googleId is omitted, so it should use default
        });
        const savedUser1 = await user1.save();
        console.log('User 1 created successfully');

        // Check raw document in DB
        const rawUser1 = await mongoose.connection.db.collection('users').findOne({ _id: savedUser1._id });
        console.log('RAW User 1 from DB:', rawUser1);

        console.log('Creating User 2 (No googleId)...');

        // Check if mobile field exists in doc
        const fetchedUser1 = await User.findById(savedUser1._id);
        console.log('Fetched User 1:', fetchedUser1);
        console.log('User 1 mobile:', fetchedUser1.mobile);


        console.log('Creating User 2 (No googleId)...');
        const user2 = new User({
            email: 'test_repro_2@example.com',
            username: 'test_repro_2',
            password: 'password123',
            fullName: 'Test User 2',
            // googleId is omitted, so it should use default
        });
        await user2.save();
        console.log('User 2 created successfully - THIS SHOULD FAIL IF BUG EXISTS');

    } catch (error) {
        if (error.code === 11000) {
            console.log('CAUGHT EXPECTED DUPLICATE KEY ERROR:', error.message);
        } else {
            console.error('UNEXPECTED ERROR:', error);
        }
    } finally {
        await mongoose.disconnect();
    }
}

reproduce();
