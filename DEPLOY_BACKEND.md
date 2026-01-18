# Quick Guide: Deploy Backend to Make GitHub Pages Work

Your frontend is on GitHub Pages, but it needs a backend API to load data. Follow these steps:

## Option 1: Railway.app (Easiest - Free Tier Available)

### Step 1: Prepare Your Code

Your `server.js` is already configured to use environment variables. Good!

### Step 2: Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub (easiest way)
3. Click "New Project"

### Step 3: Deploy Backend

1. Click "Deploy from GitHub repo"
2. Select your `inventory` repository
3. Railway will detect Node.js automatically
4. **This creates a Node.js service** - You'll see it appear in your project dashboard
   - It will be named something like "inventory" or your repository name
   - This is your **Node.js service** (the backend API)

### Step 4: Add MySQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "MySQL"
3. Railway will create a MySQL database automatically

### Step 5: Get Database Credentials

**First, get the values from your MySQL service:**

1. In your Railway project, click on the **MySQL service** (the database you just created)
2. Click on the **"Connect"** or **"Variables"** tab
3. You'll see connection details. Look for:
   - **MYSQLHOST** or **Host** - This is your `DB_HOST` value
     - Example: `containers-us-west-123.railway.app`
     - It might also be shown as `MYSQLHOST=containers-us-west-123.railway.app`
   - **MYSQLUSER** or **User** - This is your `DB_USER` (usually `root`)
   - **MYSQLPASSWORD** or **Password** - This is your `DB_PASSWORD`
     - **Important:** Use the password Railway generates, NOT your local MySQL password (123456)
     - Railway creates a completely separate database with its own password
   - **MYSQLPORT** or **Port** - This is your `DB_PORT` (usually `3306`)
   - **MYSQLDATABASE** or **Database** - This is your `DB_NAME` (usually `railway`)

**Note:** Railway might show these as `MYSQLHOST`, `MYSQLUSER`, etc. You can use those exact variable names, OR copy the values and use `DB_HOST`, `DB_USER`, etc. (both work, but your code uses `DB_*` format).

### Step 6: Set Environment Variables in Node.js Service

**Where to find your Node.js service:**
- In your Railway project dashboard, you'll see multiple services listed
- One will be your **Node.js service** (the one you deployed from GitHub - usually named after your repo like "inventory")
- The other will be your **MySQL service** (the database you just added)

**Steps:**
1. Click on your **Node.js service** (the one from GitHub, NOT the MySQL database service)
   - It should show "Node.js" or your repository name
   - It might have a web icon or code icon next to it
2. Go to the **"Variables"** tab (in the top menu or sidebar)
3. Click **"+ New Variable"** or **"Add Variable"** for each variable:
   - `DB_HOST` = Copy the **MYSQLHOST** value from MySQL service
   - `DB_USER` = Copy the **MYSQLUSER** value (usually `root`)
   - `DB_PASSWORD` = Copy the **MYSQLPASSWORD** value from Railway
     - ⚠️ **Use Railway's password, NOT your local password (123456)**
     - Railway generates a unique password for their database
   - `DB_PORT` = Copy the **MYSQLPORT** value (usually `3306`)
   - `DB_NAME` = Copy the **MYSQLDATABASE** value (usually `railway`)

**Example:**
```
DB_HOST=containers-us-west-123.railway.app
DB_USER=root
DB_PASSWORD=your_password_here
DB_PORT=3306
DB_NAME=railway
```

### Step 6: Initialize Database

1. Railway will automatically run your server
2. Your `server.js` will create tables automatically on first run
3. Check logs to see if it worked

### Step 8: Get Your Backend URL

1. Click on your Node.js service
2. Go to "Settings" tab
3. Under "Domains", Railway provides a URL like:
   ```
   https://your-app-name.up.railway.app
   ```

### Step 8: Update Frontend API URLs

Now update all your frontend JavaScript files to use the Railway URL:

**Files to update:**
- `docs/app.js`
- `docs/inbound.js`
- `docs/outbound.js`
- `docs/profit.js`
- `docs/debug.js`

**Change this line in each file:**
```javascript
const API_BASE = 'http://localhost:3000/api';
```

**To:**
```javascript
const API_BASE = 'https://your-app-name.up.railway.app/api';
```

Replace `your-app-name.up.railway.app` with your actual Railway URL.

### Step 10: Commit and Push Changes

```bash
git add .
git commit -m "Update API URLs for production"
git push
```

GitHub Pages will automatically update with the new API URLs.

### Step 11: Test

1. Visit your GitHub Pages site
2. Open browser console (F12)
3. Check if API calls are working
4. You should see data loading!

---

## Option 2: Render.com (Alternative)

1. Go to https://render.com
2. Sign up with GitHub
3. Create "New Web Service"
4. Connect your repository
5. Add MySQL database separately
6. Set environment variables
7. Get your backend URL
8. Update frontend files as above

---

## Troubleshooting

### CORS Errors
Your `server.js` already has `app.use(cors())` which should work. If you still get CORS errors, you can be more specific:

```javascript
app.use(cors({
  origin: ['https://your-username.github.io', 'http://localhost:3000']
}));
```

### Database Connection Errors
- Check all environment variables are set correctly
- Make sure MySQL service is running in Railway
- Check Railway logs for error messages

### API Not Working
- Verify your backend URL is correct
- Test backend directly: `https://your-backend-url.railway.app/api/products`
- Should return JSON (even if empty array `[]`)

---

## Quick Checklist

- [ ] Deployed backend to Railway/Render
- [ ] Added MySQL database
- [ ] Set all environment variables
- [ ] Got backend URL
- [ ] Updated all 5 JavaScript files with new API_BASE
- [ ] Committed and pushed changes
- [ ] Tested on GitHub Pages

---

## Need Help?

- Railway Docs: https://docs.railway.app
- Check your Railway logs for errors
- Test backend URL directly in browser
