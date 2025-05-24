// Supabase Configuration
// Environment variables are automatically loaded by Vite
// Make sure to update your .env file with the actual values
// Get these from: https://supabase.com/dashboard/project/ujtluvpgtspzgjzdprqc/settings/api

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
};

// Application Configuration
export const appConfig = {
  loginAttempts: {
    maxAttempts: parseInt(import.meta.env.VITE_MAX_LOGIN_ATTEMPTS) || 15,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes in milliseconds
  },
  roles: {
    ADMIN: 'admin',
    EMPLOYEE: 'employee'
  },
  adminRegistrationCode: import.meta.env.VITE_ADMIN_REGISTRATION_CODE,
  appName: import.meta.env.VITE_APP_NAME || 'Time Track Hub',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0'
};
