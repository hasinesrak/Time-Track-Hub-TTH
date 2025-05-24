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
const tabContents = document.querySelectorAll('.tab-content')
const loginForm = document.getElementById('loginForm')
const adminLoginForm = document.getElementById('adminLoginForm')
const googleButton = document.querySelector('.google-btn')

// Employee form elements
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const loginButton = document.querySelector('#loginForm .login-btn')

// Admin form elements
const adminEmailInput = document.getElementById('adminEmail')
const adminPasswordInput = document.getElementById('adminPassword')
const adminLoginButton = document.querySelector('#adminLoginForm .login-btn')

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
      // Remove active class from all tabs and content
      tabButtons.forEach(tab => tab.classList.remove('active'))
      tabContents.forEach(content => content.classList.remove('active'))

      // Add active class to clicked tab
      this.classList.add('active')

      // Show corresponding content
      const targetTab = this.dataset.tab
      const targetContent = document.querySelector(`.tab-content[data-tab="${targetTab}"]`)
      if (targetContent) {
        targetContent.classList.add('active')
      }

      // Update current login type
      currentLoginType = targetTab

      // Clear both forms
      if (loginForm) loginForm.reset()
      if (adminLoginForm) adminLoginForm.reset()
    })
  })
}

// Form handling
function setupFormHandling() {
  // Employee login form
  if (loginForm) {
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

      await handleLogin(email, password, 'employee')
    })
  }

  // Admin login form
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async function(e) {
      e.preventDefault()

      if (isLockedOut) {
        showMessage('Account is locked. Please try again later.', 'error')
        return
      }

      const email = adminEmailInput.value.trim()
      const password = adminPasswordInput.value.trim()

      if (!email || !password) {
        showMessage('Please fill in all fields', 'error')
        return
      }

      await handleLogin(email, password, 'admin')
    })
  }
}

async function handleLogin(email, password, loginType) {
  try {
    // Disable form during login
    setFormLoading(true, loginType)

    console.log('Attempting login for:', email, 'as', loginType)

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
    console.log('User role:', userRole, 'Expected:', loginType)

    if (userRole !== loginType) {
      showMessage(`This account is not registered as ${loginType}. Please use the correct login tab.`, 'error')
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
    setFormLoading(false, loginType)
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

function setFormLoading(loading, loginType = 'employee') {
  if (loginType === 'employee') {
    if (loginButton) {
      loginButton.disabled = loading
      loginButton.textContent = loading ? 'Logging in...' : 'Login'
    }
    if (emailInput) emailInput.disabled = loading
    if (passwordInput) passwordInput.disabled = loading
    if (googleButton) googleButton.disabled = loading
  } else {
    if (adminLoginButton) {
      adminLoginButton.disabled = loading
      adminLoginButton.textContent = loading ? 'Logging in...' : 'Admin Login'
    }
    if (adminEmailInput) adminEmailInput.disabled = loading
    if (adminPasswordInput) adminPasswordInput.disabled = loading
  }
}

// Google Authentication (Employee Only)
function setupGoogleAuth() {
  if (googleButton) {
    googleButton.addEventListener('click', async function() {
      try {
        setFormLoading(true, 'employee')

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/employee-dashboard.html',
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            }
          }
        })

        if (error) {
          showMessage('Google login failed: ' + error.message, 'error')
          console.error('Google auth error:', error)
        }
      } catch (error) {
        showMessage('Google login failed: ' + error.message, 'error')
        console.error('Google auth error:', error)
      } finally {
        setFormLoading(false, 'employee')
      }
    })
  }
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
