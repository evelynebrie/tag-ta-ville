# TagYourCity Backend Setup Guide

Complete instructions for local testing and production deployment.

---

## 📋 Prerequisites Checklist

✅ PostgreSQL installed (you have this)  
✅ PostGIS extension installed (you just did this)  
⬜ Node.js installed (check below)  

### Check if you have Node.js:

```bash
node --version
npm --version
```

If you don't have Node.js, install it from: https://nodejs.org (download LTS version)

---

## 🚀 PART 1: Local Setup (Testing on Your Computer)

### Step 1: Set Up the Database

```bash
# Navigate to your project folder
cd /path/to/your/project

# Run the database setup script
psql -U postgres -f setup_database.sql
```

**Enter your postgres password when prompted.**

You should see:
```
CREATE DATABASE
You are now connected to database "tagyourcity"
CREATE EXTENSION
Database setup complete!
```

---

### Step 2: Install Backend Dependencies

```bash
# Install Node.js packages
npm install
```

This installs: Express, PostgreSQL driver, CORS, etc.

---

### Step 3: Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env file with your actual postgres password
nano .env   # or use any text editor
```

**Edit this line in .env:**
```
DB_PASSWORD=your_actual_postgres_password
```

Save and close.

---

### Step 4: Start the Backend Server

```bash
# Start the server
npm start
```

You should see:
```
╔════════════════════════════════════════╗
║   TagYourCity Backend Server Running   ║
╠════════════════════════════════════════╣
║  Port: 3000                            ║
║  Environment: development              ║
║  Database: tagyourcity                 ║
╚════════════════════════════════════════╝

✅ Database connected successfully
```

**Keep this terminal window open!** The server needs to run while testing.

---

### Step 5: Open the Frontend

**Option A: Using Python (built-in server)**
```bash
# In a NEW terminal window, navigate to your project folder
cd /path/to/your/project

# Start a simple web server
python3 -m http.server 8080
```

**Option B: Using VS Code Live Server**
- Install "Live Server" extension
- Right-click `index_modified.html`
- Click "Open with Live Server"

**Option C: Using Node.js http-server**
```bash
npx http-server -p 8080
```

---

### Step 6: Test the Application

1. Open browser to: `http://localhost:8080/index_modified.html`
2. Select a location
3. Paint some voxels
4. Label clusters
5. Click "Submit Tags"

You should see: ✅ **"Submission successful!"**

Check your terminal running the backend - you'll see:
```
✓ Created submission: abc-123-def-456
  ✓ Inserted cluster disliked_0 with 15 voxels
✅ Submission abc-123-def-456 completed successfully
```

---

### Step 7: Verify Data Was Saved

```bash
# Connect to your database
psql -U postgres -d tagyourcity

# Check submissions
SELECT submission_id, total_clusters, created_at FROM submissions;

# Check clusters
SELECT cluster_id, cluster_type, voxel_count, tags FROM clusters;

# Exit
\q
```

---

## 🌐 PART 2: Production Deployment

When you're ready to deploy online, here are the steps:

### Option A: Deploy to Railway (Recommended - Easiest)

1. **Create Railway account**: https://railway.app
2. **Create new project** → "Deploy PostgreSQL"
3. **Add Node.js service** → Connect your GitHub repo
4. **Set environment variables** in Railway dashboard:
   ```
   DB_HOST=<railway_postgres_host>
   DB_PORT=<railway_postgres_port>
   DB_NAME=<railway_postgres_db>
   DB_USER=<railway_postgres_user>
   DB_PASSWORD=<railway_postgres_password>
   PORT=3000
   NODE_ENV=production
   CORS_ORIGIN=https://your-frontend-domain.com
   ```
5. Railway will automatically deploy your backend!

---

### Option B: Deploy to Heroku

1. **Create Heroku account**: https://heroku.com
2. **Install Heroku CLI**: https://devcenter.heroku.com/articles/heroku-cli
3. **Deploy:**

```bash
# Login to Heroku
heroku login

# Create app
heroku create tagyourcity-backend

# Add PostgreSQL with PostGIS
heroku addons:create heroku-postgresql:essential-0

# Enable PostGIS
heroku pg:psql
CREATE EXTENSION postgis;
\q

# Deploy
git init
git add .
git commit -m "Initial commit"
git push heroku main

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set CORS_ORIGIN=https://your-frontend-domain.com

# Run database setup
heroku pg:psql < setup_database.sql
```

---

### Option C: Deploy to DigitalOcean/AWS

1. **Create a Droplet/EC2 instance**
2. **Install PostgreSQL + PostGIS**:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgis
```
3. **Install Node.js**:
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```
4. **Clone your repo and set up**:
```bash
git clone your-repo-url
cd tagyourcity-backend
npm install
cp .env.example .env
nano .env  # Edit with production values
```
5. **Set up as a service** (so it runs automatically):
```bash
sudo nano /etc/systemd/system/tagyourcity.service
```
Add:
```ini
[Unit]
Description=TagYourCity Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/tagyourcity-backend
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```
Start it:
```bash
sudo systemctl enable tagyourcity
sudo systemctl start tagyourcity
```

---

## 🔄 Updating the Frontend for Production

When you deploy, update the API URL in `index_modified.html`:

**Find this line (around line 2635):**
```javascript
const API_URL = 'http://localhost:3000/api/submissions';
```

**Change to your production URL:**
```javascript
const API_URL = 'https://your-backend-domain.com/api/submissions';
```

Or even better, make it environment-aware:
```javascript
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api/submissions'
  : 'https://your-backend-domain.com/api/submissions';
```

---

## 📊 Accessing Your Data

### View Submissions in Browser

Visit these URLs (replace localhost with your production domain):

- Health check: `http://localhost:3000/api/health`
- All submissions: `http://localhost:3000/api/submissions`
- Single submission: `http://localhost:3000/api/submissions/<uuid>`
- Export GeoJSON: `http://localhost:3000/api/export/geojson`

### Query Database Directly

```bash
psql -U postgres -d tagyourcity

-- Get submission statistics
SELECT 
  COUNT(*) as total_submissions,
  SUM(total_clusters) as total_clusters,
  AVG(total_disliked_voxels) as avg_disliked,
  AVG(total_liked_voxels) as avg_liked
FROM submissions;

-- Get most common tags
SELECT 
  unnest(tags) as tag,
  COUNT(*) as frequency
FROM clusters
GROUP BY tag
ORDER BY frequency DESC
LIMIT 10;

-- Spatial query: Find submissions near a location
SELECT 
  submission_id,
  ST_Distance(
    user_location::geography,
    ST_SetSRID(ST_MakePoint(-73.5673, 45.5017), 4326)::geography
  ) / 1000 as distance_km
FROM submissions
WHERE ST_DWithin(
  user_location::geography,
  ST_SetSRID(ST_MakePoint(-73.5673, 45.5017), 4326)::geography,
  5000  -- 5km radius
)
ORDER BY distance_km;
```

---

## 🔧 Troubleshooting

### "Database connection error"
- Check PostgreSQL is running: `brew services list` (Mac) or `sudo systemctl status postgresql` (Linux)
- Check password in `.env` file
- Try: `psql -U postgres -d tagyourcity` manually

### "Cannot POST /api/submissions"
- Backend server not running
- Wrong port - check it's running on 3000
- CORS error - check CORS_ORIGIN in .env

### "Failed to fetch"
- Frontend can't reach backend
- Check API_URL in HTML file
- Check backend is running and accessible

### "Port 3000 already in use"
- Another app is using port 3000
- Change PORT in .env file to 3001, 3002, etc.
- Update API_URL in HTML to match

---

## 📁 File Structure Summary

```
tagyourcity/
├── index_modified.html      # Frontend (modified with backend integration)
├── server.js               # Backend API server
├── package.json            # Node.js dependencies
├── .env                    # Configuration (CREATE THIS, don't commit!)
├── .env.example           # Template for .env
├── setup_database.sql     # Database initialization script
└── README.md              # This file
```

---

## 🎉 You're Done!

You now have:
- ✅ Local PostgreSQL + PostGIS database
- ✅ Node.js backend API
- ✅ Modified frontend that saves to database
- ✅ Data stored permanently (not shown to users)
- ✅ GeoJSON export capability
- ✅ Ready for production deployment

**Next Steps:**
1. Test thoroughly locally
2. Choose a deployment platform (Railway recommended)
3. Deploy backend
4. Update frontend API_URL
5. Deploy frontend (GitHub Pages, Netlify, Vercel, etc.)

Need help? Check the troubleshooting section or feel free to ask!
