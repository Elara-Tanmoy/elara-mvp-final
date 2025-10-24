# 🔐 OAuth SSO Setup Instructions

## Enterprise-Grade Social Authentication

This document explains how to set up Google, Facebook, and LinkedIn OAuth for secure Single Sign-On (SSO).

---

## 📋 Prerequisites

### Install Required Packages

**You MUST install these packages for OAuth to work:**

```bash
cd packages/backend
npm install passport passport-google-oauth20 passport-facebook passport-linkedin-oauth2
npm install --save-dev @types/passport @types/passport-google-oauth20 @types/passport-facebook @types/passport-linkedin-oauth2
```

---

## 🔑 Get OAuth Credentials

### 1. Google OAuth

**Go to:** https://console.cloud.google.com/

#### Steps:
1. Create a new project (or select existing)
2. Go to **APIs & Services** → **Credentials**
3. Click **Create Credentials** → **OAuth client ID**
4. Application type: **Web application**
5. Configure:
   ```
   Authorized JavaScript origins:
   - https://elara-platform-nmblws5st-tanmoys-projects-1b158c68.vercel.app
   - http://localhost:5173 (for development)

   Authorized redirect URIs:
   - https://elara-backend.onrender.com/api/v2/auth/google/callback
   - http://localhost:3000/api/v2/auth/google/callback (for development)
   ```
6. Copy **Client ID** and **Client Secret**

#### Add to Render Environment Variables:
```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

---

### 2. Facebook OAuth

**Go to:** https://developers.facebook.com/

#### Steps:
1. Click **My Apps** → **Create App**
2. Use case: **Authenticate and request data from users**
3. App type: **Consumer**
4. Add **Facebook Login** product
5. Go to **Settings** → **Basic**
6. Copy **App ID** and **App Secret**
7. Go to **Facebook Login** → **Settings**
8. Add Valid OAuth Redirect URIs:
   ```
   https://elara-backend.onrender.com/api/v2/auth/facebook/callback
   http://localhost:3000/api/v2/auth/facebook/callback
   ```

#### Add to Render Environment Variables:
```
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
```

---

### 3. LinkedIn OAuth

**Go to:** https://www.linkedin.com/developers/

#### Steps:
1. Click **Create app**
2. Fill in app details
3. Go to **Auth** tab
4. Copy **Client ID** and **Client Secret**
5. Add Redirect URLs:
   ```
   https://elara-backend.onrender.com/api/v2/auth/linkedin/callback
   http://localhost:3000/api/v2/auth/linkedin/callback
   ```
6. Request access to:
   - Sign In with LinkedIn using OpenID Connect
   - Profile API
   - Email API

#### Add to Render Environment Variables:
```
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
```

---

## 🚀 Deployment Steps

### 1. Install Packages

```bash
cd elara-platform/packages/backend
npm install passport passport-google-oauth20 passport-facebook passport-linkedin-oauth2
npm install --save-dev @types/passport @types/passport-google-oauth20 @types/passport-facebook @types/passport-linkedin-oauth2
```

### 2. Add Environment Variables to Render

Go to: https://dashboard.render.com/ → elara-backend → Environment

Add all 6 environment variables listed above.

### 3. Update package.json (Already Done)

The OAuth packages will be added to `package.json` when you run npm install.

### 4. Deploy Backend

Render will auto-deploy after you push the code.

### 5. Test OAuth Flow

1. Go to your frontend: https://elara-platform-nmblws5st-tanmoys-projects-1b158c68.vercel.app
2. Click **Login**
3. Click **Continue with Google** (or Facebook/LinkedIn)
4. Authorize the app
5. You should be redirected back and logged in!

---

## 🔒 Security Features

### CSRF Protection
- ✅ State parameter validation
- ✅ Nonce verification
- ✅ Callback URL validation

### Token Security
- ✅ JWT with expiration
- ✅ Refresh token rotation
- ✅ Secure HTTP-only cookies (optional)

### Account Linking
- ✅ Email-based account linking
- ✅ Multiple OAuth providers per account
- ✅ Primary provider tracking

### Audit Logging
- ✅ OAuth login events
- ✅ Account linking events
- ✅ Account creation events
- ✅ IP address tracking

---

## 🧪 Testing

### Test Google OAuth:
```bash
# Visit this URL (replace with your client ID):
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=https://elara-backend.onrender.com/api/v2/auth/google/callback&response_type=code&scope=profile%20email&state=random_string
```

### Test Facebook OAuth:
```bash
# Visit this URL (replace with your app ID):
https://www.facebook.com/v12.0/dialog/oauth?client_id=YOUR_APP_ID&redirect_uri=https://elara-backend.onrender.com/api/v2/auth/facebook/callback&scope=email,public_profile&state=random_string
```

### Test LinkedIn OAuth:
```bash
# Visit this URL (replace with your client ID):
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://elara-backend.onrender.com/api/v2/auth/linkedin/callback&scope=r_liteprofile%20r_emailaddress&state=random_string
```

---

## 📊 OAuth Flow Diagram

```
User clicks "Sign in with Google"
        ↓
Frontend redirects to: /v2/auth/google
        ↓
Backend redirects to: Google OAuth page
        ↓
User authorizes the app
        ↓
Google redirects to: /v2/auth/google/callback?code=...
        ↓
Backend exchanges code for tokens
        ↓
Backend gets user profile
        ↓
Backend finds/creates user in database
        ↓
Backend generates JWT tokens
        ↓
Backend redirects to: Frontend with tokens
        ↓
User is logged in!
```

---

## 🐛 Troubleshooting

### "redirect_uri_mismatch" Error
- Check that callback URLs match exactly in OAuth app settings
- Include `https://` or `http://`
- No trailing slashes

### "invalid_client" Error
- Check Client ID and Client Secret are correct
- Check environment variables are set in Render

### "access_denied" Error
- User cancelled authorization
- Check OAuth app is in "Production" mode (not testing)

### User Not Created
- Check backend logs in Render
- Verify database tables exist
- Check email is returned by OAuth provider

---

## ✅ Verification Checklist

- [ ] Packages installed (`passport`, etc.)
- [ ] OAuth apps created (Google, Facebook, LinkedIn)
- [ ] Client IDs and Secrets added to Render
- [ ] Callback URLs configured in OAuth apps
- [ ] Backend deployed to Render
- [ ] Tested Google OAuth
- [ ] Tested Facebook OAuth
- [ ] Tested LinkedIn OAuth
- [ ] Verified user created in database
- [ ] Verified JWT tokens returned
- [ ] Verified frontend login works

---

## 🎯 Next Steps After Setup

1. **Test each provider** individually
2. **Monitor audit logs** for OAuth events
3. **Set up email verification** (optional)
4. **Add profile picture upload** (optional)
5. **Implement account merging** (optional)

---

## 📝 Notes

- OAuth is **disabled by default** until you add credentials
- Each provider can be enabled/disabled independently
- Users can link multiple OAuth accounts to one email
- First OAuth login creates a new user
- Subsequent logins with same email link the account

---

**Ready to proceed?** Install the packages and add your OAuth credentials!
