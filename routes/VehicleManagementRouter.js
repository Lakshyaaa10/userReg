const express = require('express');
const router = express.Router();
const VehicleManagementController = require('../controller/VehicleManagementController');

// Get all vehicles for a user
router.get('/my-vehicles', VehicleManagementController.getMyVehicles);

// Get a specific vehicle by ID
router.get('/vehicle/:vehicleId', VehicleManagementController.getVehicleById);

// Update vehicle details
router.put('/update-vehicle/:vehicleId', VehicleManagementController.updateVehicle);

// Delete vehicle
router.delete('/delete-vehicle/:vehicleId', VehicleManagementController.deleteVehicle);

// Toggle vehicle availability
router.put('/toggle-availability/:vehicleId', VehicleManagementController.toggleAvailability);

// Get vehicle statistics
router.get('/vehicle-stats/:vehicleId', VehicleManagementController.getVehicleStats);

module.exports = router;

