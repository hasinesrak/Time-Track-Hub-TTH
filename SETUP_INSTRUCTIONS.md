# Time Track Hub - Setup Instructions

## 🎯 Current Status
✅ Supabase project created: `tth` (ID: ujtluvpgtspzgjzdprqc)
✅ Database tables created and configured
✅ Login page created with Employee/Admin tabs
✅ Registration system created with role-based signup
✅ Development server running at: http://localhost:5173/

## 🔑 Required: Get API Keys

### Step 1: Get Supabase API Keys
1. The Supabase dashboard should be open in your browser
2. If not, go to: https://supabase.com/dashboard/project/ujtluvpgtspzgjzdprqc/settings/api
3. Copy the following values:
   - **Project URL**: `https://ujtluvpgtspzgjzdprqc.supabase.co`
   - **anon public key**: (copy the long key starting with `eyJ...`)

### Step 2: Update Environment Variables
1. Open `.env` file in your project root
2. Replace `your_anon_key_here` with the actual anon key from Supabase dashboard
3. Save the file
4. **Important**: Never commit the `.env` file to version control (it's already in .gitignore)

### Step 3: Test the Registration & Login
1. Go to http://localhost:5173/ in your browser
2. **Create accounts using the registration system**:
   - Click "Register" link on login page
   - Go to http://localhost:5173/register.html
   - **Employee Registration**: Fill form and submit
   - **Admin Registration**: Fill form, use admin code `TTH_ADMIN_2024`, and submit
3. **Test login** with your newly created accounts

## 🔐 Registration System

### Admin Registration Code
- **Admin Code**: `TTH_ADMIN_2024`
- Required for admin account creation
- Employees don't need a code

### Registration Features
- ✅ Role-based registration (Employee/Admin tabs)
- ✅ Form validation and password confirmation
- ✅ Password strength indicators
- ✅ Admin code verification
- ✅ Terms and conditions agreement
- ✅ Email verification disabled (immediate account activation)
- ✅ Automatic user record creation via database trigger

## 🔐 Environment Variables

### Security Best Practices
- ✅ Supabase keys stored in `.env` file
- ✅ `.env` file added to `.gitignore`
- ✅ `.env.example` provided for reference
- ✅ All sensitive config moved to environment variables

### Environment Variables Used
```
VITE_SUPABASE_URL=https://ujtluvpgtspzgjzdprqc.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_ADMIN_REGISTRATION_CODE=TTH_ADMIN_2024
VITE_APP_NAME=Time Track Hub
VITE_APP_VERSION=1.0.0
VITE_MAX_LOGIN_ATTEMPTS=15
```

## 🎨 Features Implemented

### Login Page Features:
- ✅ Employee/Admin tab switching
- ✅ Form validation
- ✅ Login attempt tracking (15 attempts max)
- ✅ 15-minute lockout after failed attempts
- ✅ Role-based authentication
- ✅ Google OAuth placeholder
- ✅ Responsive design matching the provided screenshot

### Database Features:
- ✅ Users table with role management
- ✅ Tasks table for task management
- ✅ Attendance table for time tracking
- ✅ Reports table for report generation
- ✅ Row Level Security (RLS) policies
- ✅ Automatic user creation trigger

## 🚀 Next Steps

After getting the API keys working:
1. Test the login functionality
2. Create admin and employee dashboards
3. Implement task management features
4. Implement attendance tracking
5. Implement report generation

## 📝 Notes

- The login page design matches the provided screenshot
- Singapore region selected as per user preference
- All security features implemented as per plan.md
- Ready for dashboard development once login is tested
