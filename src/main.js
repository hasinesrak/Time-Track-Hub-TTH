import './style.css'
import { createClient } from '@supabase/supabase-js'
import { supabaseConfig, appConfig } from './config.js'

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey)

// Application state
let currentLoginType = 'employee'
let loginAttempts = 0
let isLockedOut = false

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn')
const loginForm = document.getElementById('loginForm')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const loginButton = document.querySelector('.login-btn')
const googleButton = document.querySelector('.google-btn')
// registerLink is now a direct HTML link to register.html

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initializeApp()
})

function initializeApp() {
  setupTabSwitching()
  setupFormHandling()
  setupGoogleAuth()
  checkLockoutStatus()
}

// Tab switching functionality
function setupTabSwitching() {
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all tabs
      tabButtons.forEach(tab => tab.classList.remove('active'))

      // Add active class to clicked tab
      this.classList.add('active')

      // Update current login type
      currentLoginType = this.dataset.tab

      // Clear form
      loginForm.reset()

      // Update placeholder text based on login type
      updatePlaceholders()
    })
  })
}

function updatePlaceholders() {
  if (currentLoginType === 'admin') {
    emailInput.placeholder = 'Enter admin email'
    passwordInput.placeholder = 'Enter admin password'
  } else {
    emailInput.placeholder = 'Enter your email'
    passwordInput.placeholder = 'Enter your password'
  }
}

// Form handling
function setupFormHandling() {
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault()

    if (isLockedOut) {
      showMessage('Account is locked. Please try again later.', 'error')
      return
    }

    const email = emailInput.value.trim()
    const password = passwordInput.value.trim()

    if (!email || !password) {
      showMessage('Please fill in all fields', 'error')
      return
    }

    await handleLogin(email, password)
  })
}

async function handleLogin(email, password) {
  try {
    // Disable form during login
    setFormLoading(true)

    console.log('Attempting login for:', email, 'as', currentLoginType)

    // Check if Supabase is properly configured
    if (!supabaseConfig.url || !supabaseConfig.anonKey || supabaseConfig.anonKey === 'your_anon_key_here') {
      showMessage('Supabase configuration missing. Please check your .env file.', 'error')
      return
    }

    // Attempt to sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    })

    if (error) {
      console.error('Supabase auth error:', error)
      handleLoginError(error)
      return
    }

    console.log('Login successful, user data:', data.user)

    // Check user role matches selected tab
    const userRole = await getUserRole(data.user.id)
    console.log('User role:', userRole, 'Expected:', currentLoginType)

    if (userRole !== currentLoginType) {
      showMessage(`This account is not registered as ${currentLoginType}. Please use the correct login tab.`, 'error')
      await supabase.auth.signOut()
      return
    }

    // Successful login
    resetLoginAttempts()
    showMessage('Login successful! Redirecting...', 'success')

    // Redirect based on role
    setTimeout(() => {
      if (userRole === 'admin') {
        window.location.href = '/admin-dashboard.html'
      } else {
        window.location.href = '/employee-dashboard.html'
      }
    }, 1500)

  } catch (error) {
    console.error('Login error:', error)
    showMessage('An unexpected error occurred: ' + error.message, 'error')
  } finally {
    setFormLoading(false)
  }
}

async function getUserRole(userId) {
  try {
    // First try to get role from auth user metadata
    const { data: authUser, error: authError } = await supabase.auth.getUser()

    if (authUser?.user?.user_metadata?.role) {
      console.log('Got role from auth metadata:', authUser.user.user_metadata.role)
      return authUser.user.user_metadata.role
    }

    // Fallback: try to get from users table
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user role from users table:', error)
      // If we can't get the role, default to employee for now
      console.log('Defaulting to employee role')
      return 'employee'
    }

    console.log('Got role from users table:', data?.role)
    return data?.role
  } catch (error) {
    console.error('Error in getUserRole:', error)
    // Default to employee if we can't determine role
    return 'employee'
  }
}

function handleLoginError(error) {
  loginAttempts++

  if (loginAttempts >= appConfig.loginAttempts.maxAttempts) {
    lockoutUser()
    showMessage('Too many failed attempts. Account locked for 15 minutes.', 'error')
  } else {
    const remainingAttempts = appConfig.loginAttempts.maxAttempts - loginAttempts
    showMessage(`Invalid credentials. ${remainingAttempts} attempts remaining.`, 'error')
  }
}

function lockoutUser() {
  isLockedOut = true
  const lockoutTime = Date.now() + appConfig.loginAttempts.lockoutDuration
  localStorage.setItem('lockoutTime', lockoutTime.toString())

  setTimeout(() => {
    isLockedOut = false
    resetLoginAttempts()
    localStorage.removeItem('lockoutTime')
    showMessage('Account unlocked. You may try logging in again.', 'success')
  }, appConfig.loginAttempts.lockoutDuration)
}

function checkLockoutStatus() {
  const lockoutTime = localStorage.getItem('lockoutTime')
  if (lockoutTime) {
    const currentTime = Date.now()
    if (currentTime < parseInt(lockoutTime)) {
      isLockedOut = true
      const remainingTime = parseInt(lockoutTime) - currentTime
      setTimeout(() => {
        isLockedOut = false
        resetLoginAttempts()
        localStorage.removeItem('lockoutTime')
        showMessage('Account unlocked. You may try logging in again.', 'success')
      }, remainingTime)
    } else {
      localStorage.removeItem('lockoutTime')
    }
  }
}

function resetLoginAttempts() {
  loginAttempts = 0
}

function setFormLoading(loading) {
  loginButton.disabled = loading
  loginButton.textContent = loading ? 'Logging in...' : 'Login'
  emailInput.disabled = loading
  passwordInput.disabled = loading
}

// Google Authentication
function setupGoogleAuth() {
  googleButton.addEventListener('click', async function() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })

      if (error) {
        showMessage('Google login failed', 'error')
        console.error('Google auth error:', error)
      }
    } catch (error) {
      showMessage('Google login failed', 'error')
      console.error('Google auth error:', error)
    }
  })
}

// Utility functions
function showMessage(message, type = 'info') {
  // Remove existing messages
  const existingMessage = document.querySelector('.message')
  if (existingMessage) {
    existingMessage.remove()
  }

  // Create new message element
  const messageElement = document.createElement('div')
  messageElement.className = `message message-${type}`
  messageElement.textContent = message

  // Add styles
  messageElement.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    max-width: 300px;
    word-wrap: break-word;
    ${type === 'error' ? 'background-color: #dc3545;' : ''}
    ${type === 'success' ? 'background-color: #28a745;' : ''}
    ${type === 'info' ? 'background-color: #17a2b8;' : ''}
  `

  document.body.appendChild(messageElement)

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (messageElement.parentNode) {
      messageElement.remove()
    }
  }, 5000)
}
