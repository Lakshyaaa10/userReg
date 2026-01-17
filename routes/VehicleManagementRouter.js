const express = require('express');
const router = express.Router();
const VehicleManagementController = require('../controller/VehicleManagementController');

// Get all vehicles for a user
router.get('/my-vehicles', VehicleManagementController.getMyVehicles);

// Get vehicle activity (with booking status)
router.get('/my-vehicle-activity', VehicleManagementController.getMyVehicleActivity);

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

// Debug endpoint
router.get('/debug-all-vehicles', VehicleManagementController.getAllVehiclesDebug);

// Fix vehicles with null userId
router.post('/fix-null-userid', VehicleManagementController.fixNullUserIdVehicles);

module.exports = router;

