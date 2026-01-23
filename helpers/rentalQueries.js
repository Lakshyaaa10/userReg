// Example queries for retrieving rental vehicles

// 1. Get all vehicles for a specific rental business
async function getAllVehiclesForRental(rentalId) {
    try {
        const vehicles = await RegisteredVehicles.find({ rentalId: rentalId })
            .populate('rentalId') // Populate rental business details
            .populate('userId')   // Populate user details
            .sort({ createdAt: 1 }); // Oldest first (main vehicle will be first)

        return vehicles;
    } catch (error) {
        console.error('Error fetching rental vehicles:', error);
        throw error;
    }
}

// 2. Get all vehicles for a specific user (rental business owner)
async function getAllVehiclesForUser(userId) {
    try {
        const vehicles = await RegisteredVehicles.find({ userId: userId })
            .populate('rentalId')
            .sort({ createdAt: 1 });

        return vehicles;
    } catch (error) {
        console.error('Error fetching user vehicles:', error);
        throw error;
    }
}

// 3. Get rental business info with all its vehicles
async function getRentalWithVehicles(rentalId) {
    try {
        const rental = await registerRental.findById(rentalId);
        if (!rental) {
            throw new Error('Rental not found');
        }

        const vehicles = await RegisteredVehicles.find({ rentalId: rentalId })
            .sort({ createdAt: 1 });

        return {
            rental: rental,
            vehicles: vehicles,
            totalVehicles: vehicles.length
        };
    } catch (error) {
        console.error('Error fetching rental with vehicles:', error);
        throw error;
    }
}

// 4. Get available vehicles for a rental
async function getAvailableVehiclesForRental(rentalId) {
    try {
        const vehicles = await RegisteredVehicles.find({
            rentalId: rentalId,
            isAvailable: true,
            verificationStatus: 'verified' // Only verified vehicles
        }).sort({ createdAt: 1 });

        return vehicles;
    } catch (error) {
        console.error('Error fetching available vehicles:', error);
        throw error;
    }
}

// Example usage in a route:
// 
// router.get('/rental/:rentalId/vehicles', async (req, res) => {
//     try {
//         const { rentalId } = req.params;
//         const result = await getRentalWithVehicles(rentalId);
//         res.json({
//             status: 'Success',
//             data: result
//         });
//     } catch (error) {
//         res.status(500).json({
//             status: 'Failed',
//             message: error.message
//         });
//     }
// });

module.exports = {
    getAllVehiclesForRental,
    getAllVehiclesForUser,
    getRentalWithVehicles,
    getAvailableVehiclesForRental
};
