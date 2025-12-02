# Troubleshooting Admin Register API 404 Error

## Issue: Getting 404 when accessing `/admin/register`

### Step 1: Check Server Port
The backend server uses `process.env.PORT`, not hardcoded port 3000.

**Check what port your server is running on:**
1. Look at the console output when you start the server
2. It should say: `SERVER is listening at PORT <port_number>`
3. Check your `.env` file for `PORT` variable

**Common ports:**
- Development: Usually 3000, 5000, or 8000
- Check your `.env` file: `PORT=3000` (or whatever port you set)

### Step 2: Verify Server is Running
Make sure your backend server is actually running:
```bash
cd backend/userReg
npm start
# or
node index.js
```

### Step 3: Test the Route
Try these URLs in Postman:

1. **Test Route (should work):**
   ```
   POST http://localhost:<YOUR_PORT>/admin/test
   ```
   Expected response:
   ```json
   {
     "message": "Admin test route working!",
     "timestamp": "..."
   }
   ```

2. **Register Route:**
   ```
   POST http://localhost:<YOUR_PORT>/admin/register
   ```

### Step 4: Check Route Order
The routes are set up in `routes.js`:
- Line 35: `routes.use('/admin', AdminRouter)`
- This should work correctly

### Step 5: Verify Request Format in Postman

**Method:** POST
**URL:** `http://localhost:<YOUR_PORT>/admin/register`
**Headers:**
```
Content-Type: application/json
```
**Body (raw JSON):**
```json
{
  "username": "admin1",
  "email": "admin1@zugo.com",
  "password": "admin123",
  "fullName": "Admin User One",
  "phone": "9876543210"
}
```

### Step 6: Check Console Logs
When you make the request, check your server console for:
- `Admin register route hit`
- `Admin register controller called`
- `Request body: {...}`

If you don't see these logs, the route isn't being hit.

### Step 7: Common Issues

1. **Wrong Port:**
   - Server running on port 5000 but you're calling port 3000
   - Solution: Use the correct port from your server console

2. **Server Not Running:**
   - Solution: Start the server with `npm start` or `node index.js`

3. **Wrong Base URL:**
   - Make sure you're using `http://localhost:<PORT>` not `https://`
   - For local development, use `http://` not `https://`

4. **Route Not Registered:**
   - Check that `AdminRouter` is properly imported in `routes.js`
   - Check that routes are mounted before the catch-all `*` route

### Step 8: Test with curl (if Postman doesn't work)

```bash
curl -X POST http://localhost:3000/admin/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin1",
    "email": "admin1@zugo.com",
    "password": "admin123",
    "fullName": "Admin User One",
    "phone": "9876543210"
  }'
```

Replace `3000` with your actual port number.

### Step 9: Check for Errors
Look for any errors in the server console:
- Database connection errors
- Module import errors
- Route registration errors

### Quick Debug Checklist:
- [ ] Server is running
- [ ] Correct port number in URL
- [ ] Using POST method (not GET)
- [ ] Content-Type header is set to application/json
- [ ] Request body is valid JSON
- [ ] No syntax errors in AdminRouter.js
- [ ] AdminController.adminRegister function exists

### Still Getting 404?
1. Check the server console for the actual port number
2. Try the `/admin/test` route first to verify routing works
3. Check if there are any middleware blocking the request
4. Verify the route is registered before the catch-all `*` route in routes.js



