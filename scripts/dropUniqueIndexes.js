// Script to drop unique indexes that were removed from the schema
// Run this once to clean up the database after schema changes

const mongoose = require('mongoose');

// Update this with your MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function dropUniqueIndexes() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;

        // Drop unique indexes from registerrentalschemas collection
        const rentalCollection = db.collection('registerrentalschemas');

        try {
            await rentalCollection.dropIndex('businessName_1');
            console.log('✓ Dropped businessName unique index');
        } catch (e) {
            console.log('businessName index may not exist:', e.message);
        }

        try {
            await rentalCollection.dropIndex('ownerName_1');
            console.log('✓ Dropped ownerName unique index');
        } catch (e) {
            console.log('ownerName index may not exist:', e.message);
        }

        console.log('\nIndexes cleanup completed!');
        console.log('You can now run your application without duplicate key errors.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDisconnected from MongoDB');
    }
}

dropUniqueIndexes();
