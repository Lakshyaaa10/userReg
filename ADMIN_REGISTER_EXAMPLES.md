# Admin Register API - Postman Examples

## Endpoint
```
POST /admin/register
```

## Base URL
```
https://zugo-backend.onrender.com
```

## Headers
```
Content-Type: application/json
```

---

## Example 1: Basic Registration (Required Fields Only)

**Request Body:**
```json
{
  "username": "admin1",
  "email": "admin1@zugo.com",
  "password": "admin123",
  "fullName": "Admin User One",
  "phone": "9876543210"
}
```

**Expected Response (201 Created):**
```json
{
  "status": "Success",
  "message": "Admin registered successfully",
  "data": {
    "adminId": "507f1f77bcf86cd799439011",
    "username": "admin1",
    "email": "admin1@zugo.com",
    "fullName": "Admin User One",
    "role": "admin",
    "permissions": [],
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Example 2: Complete Registration (All Fields)

**Request Body:**
```json
{
  "username": "superadmin",
  "email": "superadmin@zugo.com",
  "password": "SuperAdmin@123",
  "fullName": "Super Admin User",
  "phone": "9876543211",
  "role": "super_admin",
  "permissions": [
    "manage_users",
    "manage_vehicles",
    "manage_bookings",
    "manage_payments",
    "manage_notifications",
    "rto_assistance",
    "view_analytics"
  ],
  "rtoSpecialization": [
    "registration",
    "license",
    "permit"
  ],
  "assignedRegions": [
    "Mumbai",
    "Delhi",
    "Bangalore"
  ]
}
```

**Expected Response (201 Created):**
```json
{
  "status": "Success",
  "message": "Admin registered successfully",
  "data": {
    "adminId": "507f1f77bcf86cd799439012",
    "username": "superadmin",
    "email": "superadmin@zugo.com",
    "fullName": "Super Admin User",
    "role": "super_admin",
    "permissions": [
      "manage_users",
      "manage_vehicles",
      "manage_bookings",
      "manage_payments",
      "manage_notifications",
      "rto_assistance",
      "view_analytics"
    ],
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Example 3: Moderator Role

**Request Body:**
```json
{
  "username": "moderator1",
  "email": "moderator1@zugo.com",
  "password": "moderator123",
  "fullName": "Moderator User",
  "phone": "9876543212",
  "role": "moderator",
  "permissions": [
    "manage_users",
    "manage_vehicles",
    "view_analytics"
  ]
}
```

---

## Example 4: Support Role with RTO Specialization

**Request Body:**
```json
{
  "username": "support1",
  "email": "support1@zugo.com",
  "password": "support123",
  "fullName": "Support Staff",
  "phone": "9876543213",
  "role": "support",
  "permissions": [
    "manage_notifications",
    "rto_assistance"
  ],
  "rtoSpecialization": [
    "registration",
    "license"
  ],
  "assignedRegions": [
    "Mumbai"
  ]
}
```

---

## Field Descriptions

### Required Fields:
- **username** (String): Unique username for admin login
- **email** (String): Valid email address (must be unique)
- **password** (String): Password for admin login
- **fullName** (String): Full name of the admin
- **phone** (String): Phone number

### Optional Fields:
- **role** (String): Admin role - Options: `super_admin`, `admin`, `moderator`, `support` (default: `admin`)
- **permissions** (Array): List of permissions. Options:
  - `manage_users`
  - `manage_vehicles`
  - `manage_bookings`
  - `manage_payments`
  - `manage_notifications`
  - `rto_assistance`
  - `view_analytics`
- **rtoSpecialization** (Array): RTO specializations. Options:
  - `registration`
  - `license`
  - `permit`
  - `fitness`
  - `insurance`
  - `pollution`
- **assignedRegions** (Array): List of assigned regions (e.g., ["Mumbai", "Delhi"])

---

## Error Responses

### 400 Bad Request - Missing Required Fields
```json
{
  "status": "Failed",
  "message": "Missing required fields (username, email, password, fullName, phone)",
  "data": {}
}
```

### 400 Bad Request - Invalid Email Format
```json
{
  "status": "Failed",
  "message": "Invalid email format",
  "data": {}
}
```

### 400 Bad Request - Invalid Role
```json
{
  "status": "Failed",
  "message": "Invalid role. Must be one of: super_admin, admin, moderator, support",
  "data": {}
}
```

### 409 Conflict - Username Already Exists
```json
{
  "status": "Failed",
  "message": "Username already exists",
  "data": {}
}
```

### 409 Conflict - Email Already Exists
```json
{
  "status": "Failed",
  "message": "Email already exists",
  "data": {}
}
```

### 500 Internal Server Error
```json
{
  "status": "Failed",
  "message": "Internal Server Error",
  "data": "Error message details"
}
```

---

## Postman Collection Import

You can import the `ADMIN_REGISTER_POSTMAN.json` file directly into Postman:

1. Open Postman
2. Click "Import" button
3. Select the `ADMIN_REGISTER_POSTMAN.json` file
4. The collection will be imported with all examples ready to use

---

## Quick Test in Postman

1. **Method:** POST
2. **URL:** `https://zugo-backend.onrender.com/admin/register`
3. **Headers:**
   - Key: `Content-Type`
   - Value: `application/json`
4. **Body (raw JSON):**
```json
{
  "username": "testadmin",
  "email": "testadmin@zugo.com",
  "password": "test123",
  "fullName": "Test Admin",
  "phone": "9876543210"
}
```

5. Click "Send"

---

## Notes

- The password is stored as plain text in the current implementation. For production, implement password hashing (bcrypt, etc.)
- Username and email must be unique
- All optional fields have default values if not provided
- The admin is automatically set as `isActive: true` upon registration










