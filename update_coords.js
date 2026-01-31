const mongoose = require('mongoose');
const RegisteredVehicles = require('./backend/userReg/Models/RegisteredVehicles'); // Adjust path as needed
const City = require('./backend/userReg/Models/City'); // Adjust path as needed

mongoose.connect("mongodb+srv://lakshya:lakshya1234@userreg.qjnxhvm.mongodb.net/", { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log("Connected to DB");

        // Get some reference coordinates
        const cities = await City.find({});
        if (cities.length === 0) {
            console.log("No cities found to use as reference. Exiting.");
            process.exit(1);
        }

        const rishikesh = cities.find(c => c.city === 'Rishikesh') || cities[0];
        const delhi = cities.find(c => c.city === 'Delhi') || cities[1] || cities[0];

        const vehicles = await RegisteredVehicles.find({});
        console.log(`Found ${vehicles.length} vehicles.`);

        let updated = 0;
        for (const vehicle of vehicles) {
            if (!vehicle.latitude || !vehicle.longitude) {
                // Assign some to Rishikesh, some to Delhi based on parity or random
                const targetCity = (updated % 2 === 0) ? rishikesh : delhi;

                // Add small random jitter so they aren't all on exact same spot
                const latJitter = (Math.random() - 0.5) * 0.01;
                const longJitter = (Math.random() - 0.5) * 0.01;

                vehicle.latitude = targetCity.location.coordinates[1] + latJitter;
                vehicle.longitude = targetCity.location.coordinates[0] + longJitter;

                await vehicle.save();
                updated++;
            }
        }

        console.log(`Updated ${updated} vehicles with default coordinates.`);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
