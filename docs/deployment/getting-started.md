# Getting Started - Elara Platform

## 🚀 Quick Start (Choose One Method)

### Method 1: PowerShell Script (Recommended for Windows)

```powershell
.\start.ps1
```

### Method 2: Batch File

```cmd
start.bat
```

### Method 3: Manual Commands

```powershell
# Start Docker (if installed)
docker compose up -d

# Run migrations
cd packages\backend
pnpm db:migrate

# Start all servers
cd ..\..
pnpm dev
```

## 📋 Prerequisites

### ✅ Already Installed:
- ✅ Node.js 18+
- ✅ pnpm 8+
- ✅ All dependencies (673 packages)

### ⏸️ Needs Setup (Choose One):

**Option A: Docker (Easiest)**
- Download: https://www.docker.com/products/docker-desktop
- Install and restart
- Run: `.\start.ps1`

**Option B: Cloud Database (Fastest)**
- Supabase: https://supabase.com (Free PostgreSQL)
- Copy connection string
- Update `packages/backend/.env`
- Run: `.\start.ps1`

**Option C: Local PostgreSQL**
- Download: https://www.postgresql.org/download/windows/
- Install with password: `elara_dev_pass_2024`
- Create database (see QUICKSTART.md)
- Run: `.\start.ps1`

## 🌐 Access URLs

Once running, open your browser:

| Service | URL | Description |
|---------|-----|-------------|
| **User Portal** | http://localhost:5173 | Main scanning interface |
| **Admin Dashboard** | http://localhost:5174 | Management console |
| **API** | http://localhost:3001 | Backend REST API |
| **Health Check** | http://localhost:3001/api/health | API status |

## 📱 First Time Setup

1. **Start the platform:**
   ```powershell
   .\start.ps1
   ```

2. **Open User Portal:**
   - Navigate to http://localhost:5173
   - Click "Sign up"

3. **Create your account:**
   - First Name: Your name
   - Last Name: Your surname
   - Organization: Your company
   - Email: your@email.com
   - Password: (min 8 chars, 1 uppercase, 1 number, 1 special)

4. **Start scanning!**
   - URL Scanner: Test with `https://example.com`
   - Message Scanner: Paste suspicious emails
   - File Scanner: Upload screenshots

## 🔧 Troubleshooting

### "Database not available"
**Solution:** Install Docker or use cloud database (see above)

### "Port already in use"
**Check what's using the port:**
```powershell
netstat -ano | findstr :3001
netstat -ano | findstr :5173
```

**Kill the process:**
```powershell
taskkill /PID <process-id> /F
```

### "pnpm command not found"
**Install pnpm:**
```powershell
npm install -g pnpm
```

### Docker not starting
1. Open Docker Desktop
2. Wait for it to fully start (whale icon in system tray)
3. Run `.\start.ps1` again

## 📚 Documentation

- `README.md` - Complete platform documentation
- `QUICKSTART.md` - Database setup options
- `DEPLOYMENT_STATUS.md` - Current status
- `SETUP.md` - Detailed troubleshooting

## 🎯 What Works Right Now

Even without Docker, you can:
- ✅ View the user interface
- ✅ View the admin dashboard
- ✅ See the API health endpoint
- ✅ Test frontend components

With database connected:
- ✅ Full URL scanning (13 categories)
- ✅ Message analysis with AI
- ✅ File scanning with OCR
- ✅ User authentication
- ✅ Scan history
- ✅ Admin features
- ✅ Dataset management

## 🆘 Need Help?

1. Check `QUICKSTART.md` for database options
2. See `SETUP.md` for detailed troubleshooting
3. Review `DEPLOYMENT_STATUS.md` for current status

## ⚡ Pro Tips

- **Use Docker** - Easiest setup, includes everything
- **Use Supabase** - Free cloud database, instant setup
- **Check logs** - Located in `packages/backend/logs/`
- **Use Prisma Studio** - Database GUI at `pnpm db:studio`

---

**You're ready to go!** Just run `.\start.ps1` and open http://localhost:5173
