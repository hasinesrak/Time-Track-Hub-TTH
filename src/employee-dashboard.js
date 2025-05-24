import './style.css'
import './dashboard.css'
import { createClient } from '@supabase/supabase-js'
import { supabaseConfig, appConfig } from './config.js'

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey)

// Application state
let currentUser = null
let currentSection = 'overview'
let myTasks = []
let myAttendance = []
let todayAttendance = null
let weeklyPerformanceChart = null
let taskCompletionChart = null

// DOM Elements
const navButtons = document.querySelectorAll('.nav-btn')
const contentSections = document.querySelectorAll('.content-section')
const logoutBtn = document.getElementById('logoutBtn')
const employeeName = document.getElementById('employeeName')

// Quick action buttons
const checkInBtn = document.getElementById('checkInBtn')
const checkOutBtn = document.getElementById('checkOutBtn')
const generateReportBtn = document.getElementById('generateReportBtn')

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initializeApp()
})

async function initializeApp() {
  try {
    console.log('Initializing employee dashboard...')

    // Check authentication
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('Auth error:', error)
      window.location.href = '/'
      return
    }

    if (!user) {
      console.log('No user found, redirecting to login')
      window.location.href = '/'
      return
    }

    console.log('User found:', user.email, 'Role:', user.user_metadata?.role)

    // Verify employee role
    const userRole = user.user_metadata?.role || 'employee'
    if (userRole !== 'employee') {
      console.log('User is not employee, redirecting')
      alert('Access denied. Employee privileges required.')
      window.location.href = '/'
      return
    }

    currentUser = user
    employeeName.textContent = user.user_metadata?.full_name || 'Employee User'
    console.log('Employee user set:', currentUser.email)

    // Setup event listeners
    setupNavigation()
    setupEventListeners()
    console.log('Event listeners set up')

    // Load initial data
    await loadDashboardData()

  } catch (error) {
    console.error('Initialization error:', error)
    showMessage('Failed to initialize dashboard: ' + error.message, 'error')
  }
}

function setupNavigation() {
  navButtons.forEach(button => {
    button.addEventListener('click', function() {
      const section = this.dataset.section
      switchSection(section)
    })
  })
}

function switchSection(section) {
  // Update navigation
  navButtons.forEach(btn => btn.classList.remove('active'))
  document.querySelector(`[data-section="${section}"]`).classList.add('active')

  // Update content
  contentSections.forEach(sec => sec.classList.remove('active'))
  document.getElementById(section).classList.add('active')

  currentSection = section

  // Load section-specific data
  loadSectionData(section)
}

async function loadSectionData(section) {
  switch (section) {
    case 'overview':
      await loadOverviewData()
      break
    case 'tasks':
      await loadTasksData()
      break
    case 'attendance':
      await loadAttendanceData()
      break
    case 'reports':
      await loadReportsData()
      break
  }
}

function setupEventListeners() {
  // Logout
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  })

  // Quick actions
  checkInBtn.addEventListener('click', handleCheckIn)
  checkOutBtn.addEventListener('click', handleCheckOut)
  generateReportBtn.addEventListener('click', () => {
    switchSection('reports')
    document.getElementById('generateNewReportBtn').click()
  })

  // Report generation
  document.getElementById('generateNewReportBtn').addEventListener('click', showReportForm)
  document.getElementById('cancelReportBtn').addEventListener('click', hideReportForm)
  document.getElementById('newReportForm').addEventListener('submit', handleReportSubmit)

  // Filters
  document.getElementById('taskStatusFilter').addEventListener('change', filterTasks)
  document.getElementById('filterAttendanceBtn').addEventListener('click', filterAttendance)
}

async function loadDashboardData() {
  try {
    console.log('Loading employee dashboard data...')

    // Load my tasks
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', currentUser.id)

    if (tasksError) {
      console.error('Error loading tasks:', tasksError)
      throw tasksError
    }
    myTasks = tasksData || []
    console.log('Loaded my tasks:', myTasks.length)

    // Load my attendance
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('date', { ascending: false })

    if (attendanceError) {
      console.error('Error loading attendance:', attendanceError)
      throw attendanceError
    }
    myAttendance = attendanceData || []
    console.log('Loaded my attendance:', myAttendance.length)

    // Get today's attendance
    const today = new Date().toISOString().split('T')[0]
    todayAttendance = myAttendance.find(a => a.date === today)
    console.log('Today attendance:', todayAttendance)

    // Load initial overview
    await loadOverviewData()
    console.log('Employee dashboard data loaded successfully')

  } catch (error) {
    console.error('Error loading dashboard data:', error)
    showMessage('Failed to load dashboard data: ' + error.message, 'error')
  }
}

async function loadOverviewData() {
  try {
    // Update today's status
    updateTodayStatus()

    // Update quick action buttons
    updateQuickActionButtons()

    // Load recent tasks
    loadRecentTasks()

    // Create performance charts
    createPerformanceCharts()

  } catch (error) {
    console.error('Error loading overview data:', error)
  }
}

function updateTodayStatus() {
  const todayCheckIn = document.getElementById('todayCheckIn')
  const todayCheckOut = document.getElementById('todayCheckOut')
  const hoursWorked = document.getElementById('hoursWorked')
  const activeTasks = document.getElementById('activeTasks')

  if (todayAttendance) {
    todayCheckIn.textContent = todayAttendance.check_in ?
      formatTime(todayAttendance.check_in) : 'Not checked in'
    todayCheckOut.textContent = todayAttendance.check_out ?
      formatTime(todayAttendance.check_out) : 'Not checked out'
    hoursWorked.textContent = calculateHours(todayAttendance.check_in, todayAttendance.check_out)
  } else {
    todayCheckIn.textContent = 'Not checked in'
    todayCheckOut.textContent = 'Not checked out'
    hoursWorked.textContent = '0:00'
  }

  activeTasks.textContent = myTasks.filter(t => t.status === 'running').length
}

function updateQuickActionButtons() {
  if (todayAttendance && todayAttendance.check_in && !todayAttendance.check_out) {
    // Checked in but not out
    checkInBtn.disabled = true
    checkOutBtn.disabled = false
  } else if (todayAttendance && todayAttendance.check_out) {
    // Already checked out today
    checkInBtn.disabled = true
    checkOutBtn.disabled = true
  } else {
    // Not checked in yet
    checkInBtn.disabled = false
    checkOutBtn.disabled = true
  }
}

function loadRecentTasks() {
  const recentTasksList = document.getElementById('recentTasksList')

  const recentTasks = myTasks.slice(0, 5)

  let tasksHTML = ''
  recentTasks.forEach(task => {
    tasksHTML += `
      <div class="task-item">
        <h4>${task.title}</h4>
        <p>${task.description || 'No description'}</p>
        <div class="task-meta">
          <span class="status-badge status-${task.status}">${task.status}</span>
          <span class="task-date">${formatDate(task.created_at)}</span>
        </div>
      </div>
    `
  })

  recentTasksList.innerHTML = tasksHTML || '<p>No tasks assigned</p>'
}

async function loadTasksData() {
  renderTasksGrid()
}

function renderTasksGrid() {
  const tasksGrid = document.getElementById('tasksGrid')

  if (myTasks.length === 0) {
    tasksGrid.innerHTML = `
      <div class="empty-state">
        <h3>No Tasks Assigned</h3>
        <p>You don't have any tasks assigned yet. Check back later!</p>
      </div>
    `
    return
  }

  let tasksHTML = ''
  myTasks.forEach(task => {
    tasksHTML += `
      <div class="task-card" data-task-id="${task.id}">
        <h4>${task.title}</h4>
        <p>${task.description || 'No description provided'}</p>
        <div class="task-meta">
          <span class="status-badge status-${task.status}">${task.status.toUpperCase()}</span>
          <small>Created: ${formatDate(task.created_at)}</small>
        </div>
        <div class="task-card-actions">
          ${getTaskActionButtons(task)}
        </div>
      </div>
    `
  })

  tasksGrid.innerHTML = tasksHTML
}

function getTaskActionButtons(task) {
  let buttons = ''

  switch (task.status) {
    case 'pending':
      buttons = `<button class="action-btn start" onclick="updateTaskStatus('${task.id}', 'running')" data-task-id="${task.id}">
        <span class="btn-text">Start Task</span>
      </button>`
      break
    case 'running':
      buttons = `
        <button class="action-btn pause" onclick="updateTaskStatus('${task.id}', 'paused')" data-task-id="${task.id}">
          <span class="btn-text">Pause</span>
        </button>
        <button class="action-btn complete" onclick="updateTaskStatus('${task.id}', 'completed')" data-task-id="${task.id}">
          <span class="btn-text">Complete</span>
        </button>
      `
      break
    case 'paused':
      buttons = `
        <button class="action-btn start" onclick="updateTaskStatus('${task.id}', 'running')" data-task-id="${task.id}">
          <span class="btn-text">Resume</span>
        </button>
        <button class="action-btn complete" onclick="updateTaskStatus('${task.id}', 'completed')" data-task-id="${task.id}">
          <span class="btn-text">Complete</span>
        </button>
      `
      break
    case 'completed':
      buttons = '<div class="status-indicator completed"><span class="status-icon">✓</span> Completed</div>'
      break
    case 'cancelled':
      buttons = '<div class="status-indicator cancelled"><span class="status-icon">✗</span> Cancelled</div>'
      break
  }

  return buttons
}

async function loadAttendanceData() {
  const currentMonth = document.getElementById('attendanceMonth').value ||
    new Date().toISOString().slice(0, 7)

  // Filter attendance for current month
  const monthAttendance = myAttendance.filter(record =>
    record.date.startsWith(currentMonth)
  )

  // Update summary
  updateAttendanceSummary(monthAttendance)

  // Render table
  renderAttendanceTable(monthAttendance)
}

function updateAttendanceSummary(monthAttendance) {
  const daysPresent = monthAttendance.filter(a => a.check_in).length
  let totalMinutes = 0

  monthAttendance.forEach(record => {
    if (record.check_in && record.check_out) {
      const start = new Date(record.check_in)
      const end = new Date(record.check_out)
      totalMinutes += (end - start) / (1000 * 60)
    }
  })

  const totalHours = Math.floor(totalMinutes / 60)
  const avgHours = daysPresent > 0 ? Math.floor(totalMinutes / daysPresent / 60) : 0
  const avgMinutes = daysPresent > 0 ? Math.floor((totalMinutes / daysPresent) % 60) : 0

  document.getElementById('daysPresent').textContent = daysPresent
  document.getElementById('totalHours').textContent = `${totalHours}:${Math.floor(totalMinutes % 60).toString().padStart(2, '0')}`
  document.getElementById('avgHours').textContent = `${avgHours}:${avgMinutes.toString().padStart(2, '0')}`
}

function renderAttendanceTable(attendanceData) {
  const attendanceTableBody = document.getElementById('attendanceTableBody')

  let attendanceHTML = ''
  attendanceData.forEach(record => {
    const totalHours = calculateHours(record.check_in, record.check_out)
    const status = record.check_in && record.check_out ? 'Complete' :
                  record.check_in ? 'Checked In' : 'Absent'

    attendanceHTML += `
      <tr>
        <td>${formatDate(record.date)}</td>
        <td>${record.check_in ? formatTime(record.check_in) : '-'}</td>
        <td>${record.check_out ? formatTime(record.check_out) : '-'}</td>
        <td>${totalHours}</td>
        <td><span class="status-badge status-${status.toLowerCase().replace(' ', '-')}">${status}</span></td>
      </tr>
    `
  })

  attendanceTableBody.innerHTML = attendanceHTML || '<tr><td colspan="5">No attendance records found</td></tr>'
}

async function loadReportsData() {
  try {
    console.log('Loading reports for user:', currentUser.id)

    const { data: reports, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading reports:', error)
      throw error
    }

    console.log('Loaded reports:', reports.length)
    const reportsList = document.getElementById('reportsList')

    let reportsHTML = ''
    reports.forEach(report => {
      reportsHTML += `
        <div class="report-card">
          <h4>Report - ${formatDate(report.report_date)}</h4>
          <p class="report-summary">${report.summary}</p>
          <small>Generated: ${formatDate(report.created_at)}</small>
        </div>
      `
    })

    reportsList.innerHTML = reportsHTML || '<p>No reports generated yet</p>'

  } catch (error) {
    console.error('Error loading reports:', error)
    showMessage('Failed to load reports: ' + error.message, 'error')
  }
}

// Attendance Functions
async function handleCheckIn() {
  try {
    // Show loading state
    checkInBtn.disabled = true
    checkInBtn.classList.add('btn-loading')
    const originalText = checkInBtn.querySelector('.action-text').textContent
    checkInBtn.querySelector('.action-text').textContent = 'Checking In...'

    const now = new Date().toISOString()
    const today = now.split('T')[0]

    const { data, error } = await supabase
      .from('attendance')
      .insert([{
        user_id: currentUser.id,
        date: today,
        check_in: now
      }])
      .select()

    if (error) throw error

    // Update local data
    todayAttendance = data[0]

    // Update UI immediately
    updateTodayStatus()
    updateQuickActionButtons()

    showMessage('Checked in successfully! Have a productive day!', 'success')

  } catch (error) {
    console.error('Error checking in:', error)
    showMessage('Failed to check in. Please try again.', 'error')

    // Reset button state on error
    checkInBtn.disabled = false
    checkInBtn.classList.remove('btn-loading')
    checkInBtn.querySelector('.action-text').textContent = 'Check In'
  }
}

async function handleCheckOut() {
  try {
    // Show loading state
    checkOutBtn.disabled = true
    checkOutBtn.classList.add('btn-loading')
    checkOutBtn.querySelector('.action-text').textContent = 'Checking Out...'

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('attendance')
      .update({ check_out: now })
      .eq('id', todayAttendance.id)

    if (error) throw error

    // Update local data
    todayAttendance.check_out = now

    // Update UI immediately
    updateTodayStatus()
    updateQuickActionButtons()

    const hoursWorked = calculateHours(todayAttendance.check_in, todayAttendance.check_out)
    showMessage(`Checked out successfully! You worked ${hoursWorked} today.`, 'success')

  } catch (error) {
    console.error('Error checking out:', error)
    showMessage('Failed to check out. Please try again.', 'error')

    // Reset button state on error
    checkOutBtn.disabled = false
    checkOutBtn.classList.remove('btn-loading')
    checkOutBtn.querySelector('.action-text').textContent = 'Check Out'
  }
}

// Task Functions
window.updateTaskStatus = async function(taskId, newStatus) {
  try {
    // Find the clicked button
    const button = event.target.closest('button')
    const btnText = button.querySelector('.btn-text')
    const originalText = btnText.textContent

    // Show loading state
    button.disabled = true
    button.classList.add('btn-loading')
    btnText.textContent = 'Updating...'

    // Add optimistic update to UI
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`)
    if (taskCard) {
      const statusBadge = taskCard.querySelector('.status-badge')
      statusBadge.className = `status-badge status-${newStatus}`
      statusBadge.textContent = newStatus.toUpperCase()
    }

    const { error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)

    if (error) throw error

    // Update local task data
    const taskIndex = myTasks.findIndex(t => t.id === taskId)
    if (taskIndex !== -1) {
      myTasks[taskIndex].status = newStatus
      myTasks[taskIndex].updated_at = new Date().toISOString()
    }

    // Refresh the tasks grid to show new action buttons
    renderTasksGrid()

    // Update overview if we're on that section
    if (currentSection === 'overview') {
      updateTodayStatus()
    }

    showMessage(`Task ${newStatus} successfully`, 'success')

  } catch (error) {
    console.error('Error updating task status:', error)
    showMessage('Failed to update task status', 'error')

    // Revert optimistic update on error
    renderTasksGrid()
  }
}

// Report Functions
function showReportForm() {
  document.getElementById('reportForm').style.display = 'block'
}

function hideReportForm() {
  document.getElementById('reportForm').style.display = 'none'
  document.getElementById('newReportForm').reset()
}

async function handleReportSubmit(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  const reportData = {
    user_id: currentUser.id,
    summary: formData.get('summary'),
    report_date: new Date().toISOString().split('T')[0]
  }

  try {
    const { data, error } = await supabase
      .from('reports')
      .insert([reportData])
      .select()

    if (error) throw error

    showMessage('Report submitted successfully', 'success')
    hideReportForm()
    await loadReportsData()

  } catch (error) {
    console.error('Error submitting report:', error)
    showMessage('Failed to submit report', 'error')
  }
}

// Filter Functions
function filterTasks() {
  const statusFilter = document.getElementById('taskStatusFilter').value

  let filteredTasks = myTasks

  if (statusFilter) {
    filteredTasks = filteredTasks.filter(task => task.status === statusFilter)
  }

  // Update the tasks array temporarily for rendering
  const originalTasks = myTasks
  myTasks = filteredTasks
  renderTasksGrid()
  myTasks = originalTasks
}

function filterAttendance() {
  const selectedMonth = document.getElementById('attendanceMonth').value

  if (selectedMonth) {
    loadAttendanceData()
  }
}

// Utility Functions
function formatDate(dateString) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString()
}

function formatTime(timeString) {
  if (!timeString) return '-'
  return new Date(timeString).toLocaleTimeString()
}

function calculateHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '-'

  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const diff = end - start
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return `${hours}:${minutes.toString().padStart(2, '0')}`
}

function showMessage(message, type = 'info') {
  // Remove existing messages
  const existingMessages = document.querySelectorAll('.message')
  existingMessages.forEach(msg => msg.remove())

  // Create new message element
  const messageElement = document.createElement('div')
  messageElement.className = `message message-${type}`

  // Add icon based on type
  const icons = {
    success: '✓',
    error: '✗',
    info: 'ℹ'
  }

  messageElement.innerHTML = `
    <div class="message-content">
      <span class="message-icon">${icons[type] || icons.info}</span>
      <span class="message-text">${message}</span>
    </div>
  `

  // Add styles
  messageElement.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 12px;
    color: white;
    font-weight: 600;
    z-index: 10000;
    max-width: 400px;
    word-wrap: break-word;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    animation: slideIn 0.3s ease-out;
    ${type === 'error' ? 'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);' : ''}
    ${type === 'success' ? 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);' : ''}
    ${type === 'info' ? 'background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);' : ''}
  `

  // Add animation styles
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    .message-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .message-icon {
      font-size: 18px;
      font-weight: 900;
    }
    .message-text {
      font-size: 14px;
      line-height: 1.4;
    }
  `
  document.head.appendChild(style)

  document.body.appendChild(messageElement)

  // Auto remove after 5 seconds with fade out
  setTimeout(() => {
    if (messageElement.parentNode) {
      messageElement.style.animation = 'slideOut 0.3s ease-in forwards'
      messageElement.style.animationName = 'slideOut'

      // Add slide out animation
      const slideOutStyle = document.createElement('style')
      slideOutStyle.textContent = `
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(slideOutStyle)

      setTimeout(() => {
        messageElement.remove()
        style.remove()
        slideOutStyle.remove()
      }, 300)
    }
  }, 5000)
}

// Chart Functions
function createPerformanceCharts() {
  createWeeklyPerformanceChart()
  createTaskCompletionChart()
}

function createWeeklyPerformanceChart() {
  const ctx = document.getElementById('weeklyPerformanceChart')
  if (!ctx) return

  // Destroy existing chart
  if (weeklyPerformanceChart) {
    weeklyPerformanceChart.destroy()
  }

  // Calculate weekly data
  const weeklyData = calculateWeeklyPerformance()

  weeklyPerformanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Hours Worked',
        data: weeklyData.hours,
        borderColor: '#1e293b',
        backgroundColor: 'rgba(30, 41, 59, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9'
          }
        },
        x: {
          grid: {
            color: '#f1f5f9'
          }
        }
      }
    }
  })
}

function createTaskCompletionChart() {
  const ctx = document.getElementById('taskCompletionChart')
  if (!ctx) return

  // Destroy existing chart
  if (taskCompletionChart) {
    taskCompletionChart.destroy()
  }

  // Calculate task completion data
  const taskData = calculateTaskCompletion()

  taskCompletionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Running', 'Pending', 'Paused'],
      datasets: [{
        data: [taskData.completed, taskData.running, taskData.pending, taskData.paused],
        backgroundColor: [
          '#10b981',
          '#3b82f6',
          '#f59e0b',
          '#ef4444'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  })
}

function calculateWeeklyPerformance() {
  const now = new Date()
  const weekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1))
  const weeklyHours = [0, 0, 0, 0, 0, 0, 0]

  myAttendance.forEach(record => {
    const recordDate = new Date(record.date)
    if (recordDate >= weekStart && record.check_in && record.check_out) {
      const dayIndex = recordDate.getDay() === 0 ? 6 : recordDate.getDay() - 1
      const hours = (new Date(record.check_out) - new Date(record.check_in)) / (1000 * 60 * 60)
      weeklyHours[dayIndex] = hours
    }
  })

  return { hours: weeklyHours }
}

function calculateTaskCompletion() {
  const taskCounts = {
    completed: 0,
    running: 0,
    pending: 0,
    paused: 0
  }

  myTasks.forEach(task => {
    if (taskCounts.hasOwnProperty(task.status)) {
      taskCounts[task.status]++
    }
  })

  return taskCounts
}

// PDF Export Functions
window.exportDashboardPDF = function() {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()

  // Company branding and styling
  const primaryColor = [30, 41, 59] // #1e293b
  const secondaryColor = [100, 116, 139] // #64748b
  const accentColor = [16, 185, 129] // #10b981

  let currentPage = 1
  let yPos = 40

  // Helper function to add header
  function addHeader() {
    // Company header with background
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.rect(0, 0, 210, 25, 'F')

    // Company logo/title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('TIME TRACK HUB', 20, 16)

    // Report type
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Employee Dashboard Report', 140, 16)

    // Reset text color
    doc.setTextColor(0, 0, 0)
  }

  // Helper function to add footer
  function addFooter() {
    const pageHeight = doc.internal.pageSize.height

    // Footer line
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.setLineWidth(0.5)
    doc.line(20, pageHeight - 20, 190, pageHeight - 20)

    // Footer text
    doc.setFontSize(8)
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, pageHeight - 12)
    doc.text(`Page ${currentPage}`, 180, pageHeight - 12)
    doc.text('Time Track Hub - Confidential', 20, pageHeight - 6)
  }

  // Helper function to check page break
  function checkPageBreak(requiredSpace = 20) {
    if (yPos > 250) {
      addFooter()
      doc.addPage()
      currentPage++
      addHeader()
      yPos = 40
    }
  }

  // Add header to first page
  addHeader()

  // Employee Information Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('EMPLOYEE INFORMATION', 20, yPos)
  yPos += 15

  // Employee details box
  doc.setFillColor(248, 250, 252) // #f8fafc
  doc.rect(20, yPos - 5, 170, 25, 'F')
  doc.setDrawColor(226, 232, 240) // #e2e8f0
  doc.rect(20, yPos - 5, 170, 25, 'S')

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Name: ${currentUser.user_metadata?.full_name || 'Employee User'}`, 25, yPos + 5)
  doc.text(`Email: ${currentUser.email}`, 25, yPos + 12)
  doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 120, yPos + 5)
  doc.text(`Employee ID: ${currentUser.id.substring(0, 8)}...`, 120, yPos + 12)
  yPos += 35

  checkPageBreak()

  // Today's Performance Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('TODAY\'S PERFORMANCE', 20, yPos)
  yPos += 15

  const todayCheckInText = document.getElementById('todayCheckIn').textContent
  const todayCheckOutText = document.getElementById('todayCheckOut').textContent
  const hoursWorkedText = document.getElementById('hoursWorked').textContent
  const activeTasksText = document.getElementById('activeTasks').textContent

  // Performance metrics table
  const performanceData = [
    ['Metric', 'Value', 'Status'],
    ['Check In Time', todayCheckInText, todayCheckInText !== '-' ? 'On Time' : 'Not Checked In'],
    ['Check Out Time', todayCheckOutText, todayCheckOutText !== '-' ? 'Completed' : 'Pending'],
    ['Hours Worked', hoursWorkedText, hoursWorkedText !== '-' && hoursWorkedText !== '0:00' ? 'Active' : 'No Activity'],
    ['Active Tasks', activeTasksText, activeTasksText > 0 ? 'In Progress' : 'No Active Tasks']
  ]

  // Draw table
  let tableY = yPos
  const colWidths = [60, 60, 50]
  const rowHeight = 8

  performanceData.forEach((row, index) => {
    let tableX = 20

    if (index === 0) {
      // Header row
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.rect(tableX, tableY, colWidths.reduce((a, b) => a + b), rowHeight, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
    } else {
      // Data rows
      doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255)
      doc.rect(tableX, tableY, colWidths.reduce((a, b) => a + b), rowHeight, 'F')
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
    }

    doc.setFontSize(10)
    row.forEach((cell, cellIndex) => {
      doc.text(cell, tableX + 2, tableY + 5)
      tableX += colWidths[cellIndex]
    })

    tableY += rowHeight
  })

  yPos = tableY + 15
  checkPageBreak()

  // Task Summary Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('TASK SUMMARY', 20, yPos)
  yPos += 15

  const taskSummary = calculateTaskCompletion()
  const totalTasks = Object.values(taskSummary).reduce((a, b) => a + b, 0)

  // Task summary cards
  let cardX = 20
  const cardWidth = 40
  const cardHeight = 30

  Object.entries(taskSummary).forEach(([status, count]) => {
    // Card background
    const colors = {
      pending: [245, 158, 11],
      running: [59, 130, 246],
      paused: [239, 68, 68],
      completed: [16, 185, 129]
    }

    const color = colors[status] || [107, 114, 128]
    doc.setFillColor(color[0], color[1], color[2])
    doc.rect(cardX, yPos, cardWidth, cardHeight, 'F')

    // Card text
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(count.toString(), cardX + cardWidth/2, yPos + 12, { align: 'center' })

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(status.toUpperCase(), cardX + cardWidth/2, yPos + 20, { align: 'center' })

    if (totalTasks > 0) {
      const percentage = Math.round((count / totalTasks) * 100)
      doc.text(`${percentage}%`, cardX + cardWidth/2, yPos + 26, { align: 'center' })
    }

    cardX += cardWidth + 5
  })

  yPos += cardHeight + 20
  checkPageBreak()

  // Recent Tasks Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('RECENT TASKS', 20, yPos)
  yPos += 15

  if (myTasks.length === 0) {
    doc.setFontSize(12)
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.text('No tasks assigned', 20, yPos)
    yPos += 15
  } else {
    // Tasks table
    const tasksData = [['Task Title', 'Status', 'Created Date']]
    myTasks.slice(0, 10).forEach(task => {
      tasksData.push([
        task.title.length > 30 ? task.title.substring(0, 30) + '...' : task.title,
        task.status.toUpperCase(),
        formatDate(task.created_at)
      ])
    })

    // Draw tasks table
    let tasksTableY = yPos
    const tasksColWidths = [80, 30, 40]
    const tasksRowHeight = 8

    tasksData.forEach((row, index) => {
      checkPageBreak(10)
      if (yPos !== tasksTableY) {
        tasksTableY = yPos
      }

      let tasksTableX = 20

      if (index === 0) {
        // Header row
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
        doc.rect(tasksTableX, tasksTableY, tasksColWidths.reduce((a, b) => a + b), tasksRowHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
      } else {
        // Data rows
        doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255)
        doc.rect(tasksTableX, tasksTableY, tasksColWidths.reduce((a, b) => a + b), tasksRowHeight, 'F')
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
      }

      doc.setFontSize(9)
      row.forEach((cell, cellIndex) => {
        doc.text(cell, tasksTableX + 2, tasksTableY + 5)
        tasksTableX += tasksColWidths[cellIndex]
      })

      tasksTableY += tasksRowHeight
    })
    yPos = tasksTableY + 15
  }

  // Add footer to last page
  addFooter()

  // Save the PDF
  const fileName = `Dashboard_Report_${currentUser.user_metadata?.full_name?.replace(/\s+/g, '_') || 'Employee'}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
  showMessage('Professional dashboard report exported successfully!', 'success')
}

window.exportReportsPDF = function() {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()

  // Company branding and styling
  const primaryColor = [30, 41, 59] // #1e293b
  const secondaryColor = [100, 116, 139] // #64748b
  const accentColor = [16, 185, 129] // #10b981

  let currentPage = 1
  let yPos = 40

  // Helper function to add header
  function addHeader() {
    // Company header with background
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.rect(0, 0, 210, 25, 'F')

    // Company logo/title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('TIME TRACK HUB', 20, 16)

    // Report type
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Employee Reports Collection', 140, 16)

    // Reset text color
    doc.setTextColor(0, 0, 0)
  }

  // Helper function to add footer
  function addFooter() {
    const pageHeight = doc.internal.pageSize.height

    // Footer line
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.setLineWidth(0.5)
    doc.line(20, pageHeight - 20, 190, pageHeight - 20)

    // Footer text
    doc.setFontSize(8)
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 20, pageHeight - 12)
    doc.text(`Page ${currentPage}`, 180, pageHeight - 12)
    doc.text('Time Track Hub - Confidential', 20, pageHeight - 6)
  }

  // Helper function to check page break
  function checkPageBreak(requiredSpace = 30) {
    if (yPos > 250) {
      addFooter()
      doc.addPage()
      currentPage++
      addHeader()
      yPos = 40
    }
  }

  // Add header to first page
  addHeader()

  // Employee Information Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('EMPLOYEE REPORTS COLLECTION', 20, yPos)
  yPos += 15

  // Employee details box
  doc.setFillColor(248, 250, 252) // #f8fafc
  doc.rect(20, yPos - 5, 170, 25, 'F')
  doc.setDrawColor(226, 232, 240) // #e2e8f0
  doc.rect(20, yPos - 5, 170, 25, 'S')

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Employee: ${currentUser.user_metadata?.full_name || 'Employee User'}`, 25, yPos + 5)
  doc.text(`Email: ${currentUser.email}`, 25, yPos + 12)
  doc.text(`Export Date: ${new Date().toLocaleDateString()}`, 120, yPos + 5)
  doc.text(`Total Reports: ${document.querySelectorAll('.report-card').length}`, 120, yPos + 12)
  yPos += 35

  checkPageBreak()

  // Reports Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('DETAILED REPORTS', 20, yPos)
  yPos += 15

  // Get reports from the DOM
  const reportElements = document.querySelectorAll('.report-card')

  if (reportElements.length === 0) {
    // No reports message
    doc.setFillColor(254, 242, 242) // Light red background
    doc.rect(20, yPos - 5, 170, 20, 'F')
    doc.setDrawColor(239, 68, 68) // Red border
    doc.rect(20, yPos - 5, 170, 20, 'S')

    doc.setFontSize(12)
    doc.setTextColor(185, 28, 28) // Red text
    doc.text('No reports available for this employee', 25, yPos + 8)
    yPos += 25
  } else {
    reportElements.forEach((reportElement, index) => {
      checkPageBreak(50)

      const title = reportElement.querySelector('h4')?.textContent || `Report ${index + 1}`
      const summary = reportElement.querySelector('.report-summary')?.textContent || 'No summary available'
      const date = reportElement.querySelector('small')?.textContent || 'No date available'

      // Report card background
      doc.setFillColor(249, 250, 251) // #f9fafb
      doc.rect(20, yPos - 5, 170, 45, 'F')
      doc.setDrawColor(209, 213, 219) // #d1d5db
      doc.rect(20, yPos - 5, 170, 45, 'S')

      // Report number badge
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
      doc.circle(30, yPos + 5, 8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text((index + 1).toString(), 30, yPos + 8, { align: 'center' })

      // Report title
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(title, 45, yPos + 8)

      // Report date
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(date, 45, yPos + 18)

      // Report summary
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(summary, 140)
      doc.text(lines, 25, yPos + 28)

      yPos += 55
    })
  }

  // Summary section
  checkPageBreak(40)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('REPORT SUMMARY', 20, yPos)
  yPos += 15

  // Summary box
  doc.setFillColor(240, 253, 244) // Light green background
  doc.rect(20, yPos - 5, 170, 25, 'F')
  doc.setDrawColor(34, 197, 94) // Green border
  doc.rect(20, yPos - 5, 170, 25, 'S')

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Total Reports Generated: ${reportElements.length}`, 25, yPos + 5)
  doc.text(`Report Period: All Time`, 25, yPos + 12)
  doc.text(`Export Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 120, yPos + 5)
  doc.text(`Status: Complete`, 120, yPos + 12)

  // Add footer to last page
  addFooter()

  // Save the PDF
  const fileName = `Reports_Collection_${currentUser.user_metadata?.full_name?.replace(/\s+/g, '_') || 'Employee'}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
  showMessage('Professional reports collection exported successfully!', 'success')
}
