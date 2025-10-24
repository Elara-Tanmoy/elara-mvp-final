# Quick Start - Admin Features

## 1. Backend is Already Running ✅
Your enhanced backend with all admin features is running on port 3001.

## 2. Create Admin User

```powershell
# First, register a normal user at http://localhost:5173
# Then make them admin:

cd D:\Elara_MVP\elara-platform
$env:Path = "C:\Program Files\nodejs;" + $env:Path
pnpm --filter @elara/backend exec node -e "import('@prisma/client').then(async m => { const p = new m.PrismaClient(); const users = await p.user.findMany(); console.log('Users:', users.map(u => ({email: u.email, role: u.role}))); if(users[0]) { await p.user.update({ where: {id: users[0].id}, data: {role: 'admin'} }); console.log('✓ Made admin:', users[0].email); } await p.\$disconnect(); })"
```

## 3. Test Admin API

```powershell
# Test with curl or browser
curl http://localhost:3001/api/v2/admin/stats -H "Authorization: Bearer YOUR_TOKEN"
```

## 4. All New Admin Endpoints

- `GET /v2/admin/stats` - Dashboard stats
- `GET /v2/admin/organizations` - All organizations
- `GET /v2/admin/users` - All users  
- `GET /v2/admin/scans` - All scans
- `GET /v2/admin/metrics` - System metrics
- `GET /v2/admin/audit-logs` - Audit logs
- `PATCH /v2/admin/users/:id/role` - Update user role
- `PATCH /v2/admin/organizations/:id/tier` - Update org tier
- `DELETE /v2/admin/users/:id` - Deactivate user

## 5. Enhanced URL Scanner

The URL scanner now includes:
- Real WHOIS domain age checking
- SSL certificate validation
- AI-powered detailed explanations
- External API support (VirusTotal, Google Safe Browsing)
- Comprehensive risk scoring

## 6. Next Steps

1. Review `IMPROVEMENTS_SUMMARY.md` for full details
2. Add API keys to `.env` for external scans (optional)
3. Login to admin dashboard and test features
4. Check scan results for enhanced AI analysis
