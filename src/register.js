import './style.css'
import { createClient } from '@supabase/supabase-js'
import { supabaseConfig, appConfig } from './config.js'

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey)

// Application state
let currentRegistrationType = 'employee'

// Admin registration code from environment variables
const ADMIN_REGISTRATION_CODE = appConfig.adminRegistrationCode

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn')
const registerForm = document.getElementById('registerForm')
const fullNameInput = document.getElementById('fullName')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const confirmPasswordInput = document.getElementById('confirmPassword')
const adminCodeInput = document.getElementById('adminCode')
const adminCodeGroup = document.getElementById('adminCodeGroup')
const agreeTermsCheckbox = document.getElementById('agreeTerms')
const registerButton = document.querySelector('.login-btn')
const googleButton = document.querySelector('.google-btn')

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initializeApp()
})

function initializeApp() {
  setupTabSwitching()
  setupFormHandling()
  setupGoogleAuth()
  setupPasswordValidation()
}

// Tab switching functionality
function setupTabSwitching() {
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all tabs
      tabButtons.forEach(tab => tab.classList.remove('active'))

      // Add active class to clicked tab
      this.classList.add('active')

      // Update current registration type
      currentRegistrationType = this.dataset.tab

      // Show/hide admin code field
      if (currentRegistrationType === 'admin') {
        adminCodeGroup.style.display = 'block'
        adminCodeGroup.classList.add('show')
        adminCodeInput.required = true
      } else {
        adminCodeGroup.style.display = 'none'
        adminCodeGroup.classList.remove('show')
        adminCodeInput.required = false
        adminCodeInput.value = ''
      }

      // Update placeholder text based on registration type
      updatePlaceholders()
    })
  })
}

function updatePlaceholders() {
  if (currentRegistrationType === 'admin') {
    emailInput.placeholder = 'Enter admin email'
    fullNameInput.placeholder = 'Enter admin full name'
  } else {
    emailInput.placeholder = 'Enter your email'
    fullNameInput.placeholder = 'Enter your full name'
  }
}

// Form handling
function setupFormHandling() {
  registerForm.addEventListener('submit', async function(e) {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const formData = {
      fullName: fullNameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value.trim(),
      role: currentRegistrationType,
      adminCode: adminCodeInput.value.trim()
    }

    await handleRegistration(formData)
  })
}

function validateForm() {
  const fullName = fullNameInput.value.trim()
  const email = emailInput.value.trim()
  const password = passwordInput.value.trim()
  const confirmPassword = confirmPasswordInput.value.trim()
  const adminCode = adminCodeInput.value.trim()
  const agreeTerms = agreeTermsCheckbox.checked

  // Basic validation
  if (!fullName || !email || !password || !confirmPassword) {
    showMessage('Please fill in all required fields', 'error')
    return false
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    showMessage('Please enter a valid email address', 'error')
    return false
  }

  // Password validation
  if (password.length < 6) {
    showMessage('Password must be at least 6 characters long', 'error')
    return false
  }

  // Password confirmation
  if (password !== confirmPassword) {
    showMessage('Passwords do not match', 'error')
    return false
  }

  // Admin code validation
  if (currentRegistrationType === 'admin') {
    if (!adminCode) {
      showMessage('Admin code is required for admin registration', 'error')
      return false
    }
    if (adminCode !== ADMIN_REGISTRATION_CODE) {
      showMessage('Invalid admin code', 'error')
      return false
    }
  }

  // Terms agreement
  if (!agreeTerms) {
    showMessage('Please agree to the Terms of Service and Privacy Policy', 'error')
    return false
  }

  return true
}

async function handleRegistration(formData) {
  try {
    // Disable form during registration
    setFormLoading(true)

    // Sign up with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          role: formData.role
        }
      }
    })

    if (error) {
      handleRegistrationError(error)
      return
    }

    // Registration successful
    showMessage('Registration successful! You can now login with your credentials.', 'success')

    // Clear form
    registerForm.reset()

    // Redirect to login after 2 seconds
    setTimeout(() => {
      window.location.href = '/'
    }, 2000)

  } catch (error) {
    console.error('Registration error:', error)
    showMessage('An unexpected error occurred during registration', 'error')
  } finally {
    setFormLoading(false)
  }
}

function handleRegistrationError(error) {
  let message = 'Registration failed'

  switch (error.message) {
    case 'User already registered':
      message = 'An account with this email already exists'
      break
    case 'Invalid email':
      message = 'Please enter a valid email address'
      break
    case 'Password should be at least 6 characters':
      message = 'Password must be at least 6 characters long'
      break
    default:
      message = error.message || 'Registration failed'
  }

  showMessage(message, 'error')
}

function setFormLoading(loading) {
  registerButton.disabled = loading
  registerButton.textContent = loading ? 'Creating Account...' : 'Create Account'

  // Disable all form inputs
  const inputs = registerForm.querySelectorAll('input, button')
  inputs.forEach(input => {
    if (input !== registerButton) {
      input.disabled = loading
    }
  })
}

// Password validation feedback
function setupPasswordValidation() {
  passwordInput.addEventListener('input', function() {
    const password = this.value
    const confirmPassword = confirmPasswordInput.value

    // Check password strength
    if (password.length > 0 && password.length < 6) {
      this.style.borderColor = '#dc3545'
    } else if (password.length >= 6) {
      this.style.borderColor = '#28a745'
    } else {
      this.style.borderColor = '#ddd'
    }

    // Check password match
    if (confirmPassword && password !== confirmPassword) {
      confirmPasswordInput.style.borderColor = '#dc3545'
    } else if (confirmPassword && password === confirmPassword) {
      confirmPasswordInput.style.borderColor = '#28a745'
    }
  })

  confirmPasswordInput.addEventListener('input', function() {
    const password = passwordInput.value
    const confirmPassword = this.value

    if (confirmPassword && password !== confirmPassword) {
      this.style.borderColor = '#dc3545'
    } else if (confirmPassword && password === confirmPassword) {
      this.style.borderColor = '#28a745'
    } else {
      this.style.borderColor = '#ddd'
    }
  })
}

// Google Authentication
function setupGoogleAuth() {
  googleButton.addEventListener('click', async function() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          data: {
            role: currentRegistrationType
          }
        }
      })

      if (error) {
        showMessage('Google registration failed', 'error')
        console.error('Google auth error:', error)
      }
    } catch (error) {
      showMessage('Google registration failed', 'error')
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
