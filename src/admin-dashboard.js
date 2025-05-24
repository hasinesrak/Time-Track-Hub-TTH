import './style.css'
import './dashboard.css'
import { createClient } from '@supabase/supabase-js'
import { supabaseConfig, appConfig } from './config.js'

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey)

// Application state
let currentUser = null
let currentSection = 'overview'
let employees = []
let tasks = []
let attendance = []
let taskStatusChart = null
let employeePerformanceChart = null
let attendanceTrendsChart = null

// DOM Elements
const navButtons = document.querySelectorAll('.nav-btn')
const contentSections = document.querySelectorAll('.content-section')
const logoutBtn = document.getElementById('logoutBtn')
const adminName = document.getElementById('adminName')

// Modal elements
const taskModal = document.getElementById('taskModal')
const attendanceModal = document.getElementById('attendanceModal')
const taskForm = document.getElementById('taskForm')
const attendanceForm = document.getElementById('attendanceForm')

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initializeApp()
})

async function initializeApp() {
  try {
    console.log('Initializing admin dashboard...')

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

    // Verify admin role
    const userRole = user.user_metadata?.role || 'employee'
    if (userRole !== 'admin') {
      console.log('User is not admin, redirecting')
      alert('Access denied. Admin privileges required.')
      window.location.href = '/'
      return
    }

    currentUser = user
    adminName.textContent = user.user_metadata?.full_name || 'Admin User'
    console.log('Admin user set:', currentUser.email)

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
    case 'employees':
      await loadEmployeesData()
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

  // Task management
  document.getElementById('addTaskBtn').addEventListener('click', () => {
    openTaskModal()
  })

  // Modal close buttons
  document.getElementById('closeTaskModal').addEventListener('click', () => {
    closeTaskModal()
  })

  document.getElementById('closeAttendanceModal').addEventListener('click', () => {
    closeAttendanceModal()
  })

  document.getElementById('closeEmployeeModal').addEventListener('click', () => {
    closeEmployeeModal()
  })

  // Form submissions
  taskForm.addEventListener('submit', handleTaskSubmit)
  attendanceForm.addEventListener('submit', handleAttendanceSubmit)

  const employeeForm = document.getElementById('employeeForm')
  employeeForm.addEventListener('submit', handleEmployeeSubmit)

  // Cancel buttons
  document.getElementById('cancelEmployeeBtn').addEventListener('click', closeEmployeeModal)

  // Filters
  document.getElementById('taskStatusFilter').addEventListener('change', filterTasks)
  document.getElementById('taskEmployeeFilter').addEventListener('change', filterTasks)
  document.getElementById('filterAttendanceBtn').addEventListener('click', filterAttendance)

  // Report generation and filtering
  document.getElementById('generateReportBtn').addEventListener('click', generateReport)
  document.getElementById('filterReportsBtn').addEventListener('click', filterReports)
  document.getElementById('clearReportsFilterBtn').addEventListener('click', clearReportsFilter)
  document.getElementById('reportEmployeeFilter').addEventListener('change', filterReports)
}

async function loadDashboardData() {
  try {
    console.log('Loading dashboard data...')

    // Load employees (including all users for reference)
    const { data: employeesData, error: employeesError } = await supabase
      .from('users')
      .select('*')

    if (employeesError) {
      console.error('Error loading employees:', employeesError)
      throw employeesError
    }
    employees = employeesData || []
    console.log('Loaded all users:', employees.length)
    console.log('Employee names:', employees.map(emp => emp.full_name))

    // Load tasks with simpler query first
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')

    if (tasksError) {
      console.error('Error loading tasks:', tasksError)
      throw tasksError
    }
    tasks = tasksData || []
    console.log('Loaded tasks:', tasks.length)

    // Load attendance with simpler query first
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .order('created_at', { ascending: false })

    if (attendanceError) {
      console.error('Error loading attendance:', attendanceError)
      throw attendanceError
    }
    attendance = attendanceData || []
    console.log('Loaded attendance:', attendance.length)
    console.log('Sample attendance record:', attendance[0])

    // Load initial overview
    await loadOverviewData()
    console.log('Dashboard data loaded successfully')

  } catch (error) {
    console.error('Error loading dashboard data:', error)
    showMessage('Failed to load dashboard data: ' + error.message, 'error')
  }
}

async function loadOverviewData() {
  try {
    // Update stats
    document.getElementById('totalEmployees').textContent = employees.length
    document.getElementById('activeTasks').textContent = tasks.filter(t => t.status === 'running').length
    document.getElementById('completedTasks').textContent = tasks.filter(t => t.status === 'completed').length

    // Get today's attendance
    const today = new Date().toISOString().split('T')[0]
    const todayAttendance = attendance.filter(a => a.date === today && a.check_in)
    document.getElementById('presentToday').textContent = todayAttendance.length

    // Load recent activity
    loadRecentActivity()

    // Create analytics charts
    createAnalyticsCharts()

  } catch (error) {
    console.error('Error loading overview data:', error)
  }
}

function loadRecentActivity() {
  const recentActivity = document.getElementById('recentActivity')

  // Create array to hold all activities with timestamps for sorting
  let activities = []

  // Add recent task activities
  tasks.slice(0, 5).forEach(task => {
    // Get assigned user name
    let assignedUserName = 'Unassigned'
    if (task.assigned_to) {
      const assignedUser = employees.find(emp => emp.id === task.assigned_to)
      assignedUserName = assignedUser ? assignedUser.full_name : 'Unknown User'
    }

    activities.push({
      text: `📋 Task "${task.title}" assigned to ${assignedUserName}`,
      time: task.created_at,
      displayTime: formatDate(task.created_at),
      timestamp: new Date(task.created_at).getTime()
    })
  })

  // Add recent attendance activities
  attendance.slice(0, 8).forEach(record => {
    // Get user name from employees array
    let userName = 'Unknown User'
    if (record.user_id) {
      const user = employees.find(emp => emp.id === record.user_id)
      userName = user ? user.full_name : 'Unknown User'
    }

    if (record.check_in) {
      activities.push({
        text: `✅ ${userName} checked in`,
        time: record.check_in,
        displayTime: formatTime(record.check_in),
        timestamp: new Date(record.check_in).getTime()
      })
    }

    if (record.check_out) {
      activities.push({
        text: `🏁 ${userName} checked out`,
        time: record.check_out,
        displayTime: formatTime(record.check_out),
        timestamp: new Date(record.check_out).getTime()
      })
    }
  })

  // Sort activities by timestamp (most recent first) and take top 8
  activities.sort((a, b) => b.timestamp - a.timestamp)
  activities = activities.slice(0, 8)

  // Generate HTML
  let activityHTML = ''
  activities.forEach(activity => {
    activityHTML += `
      <div class="activity-item">
        <span class="activity-text">${activity.text}</span>
        <span class="activity-time">${activity.displayTime}</span>
      </div>
    `
  })

  recentActivity.innerHTML = activityHTML || '<p>No recent activity</p>'
}

async function loadTasksData() {
  try {
    // Fetch fresh task data from database
    const { data: tasksData, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Update the global tasks array
    tasks = tasksData || []

    const tasksTableBody = document.getElementById('tasksTableBody')
    const taskEmployeeFilter = document.getElementById('taskEmployeeFilter')
    const taskAssignee = document.getElementById('taskAssignee')

    // Populate employee filters
    let employeeOptions = '<option value="">All Employees</option>'
    employees.forEach(emp => {
      employeeOptions += `<option value="${emp.id}">${emp.full_name}</option>`
    })
    taskEmployeeFilter.innerHTML = employeeOptions
    taskAssignee.innerHTML = '<option value="">Select Employee</option>' +
      employees.map(emp => `<option value="${emp.id}">${emp.full_name}</option>`).join('')

    renderTasksTable()

  } catch (error) {
    console.error('Error loading tasks data:', error)
    showMessage('Failed to load tasks data', 'error')
  }
}

async function renderTasksTable() {
  const tasksTableBody = document.getElementById('tasksTableBody')

  if (tasks.length === 0) {
    tasksTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No tasks found</td></tr>'
    return
  }

  let tasksHTML = ''

  for (const task of tasks) {
    // Get assigned user name
    let assignedUserName = 'Unassigned'
    if (task.assigned_to) {
      const assignedUser = employees.find(emp => emp.id === task.assigned_to)
      assignedUserName = assignedUser ? assignedUser.full_name : 'Unknown User'
    }

    tasksHTML += `
      <tr data-task-id="${task.id}">
        <td>
          <div class="task-title">${task.title}</div>
          ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
        </td>
        <td>
          <div class="user-info">
            <span class="user-name">${assignedUserName}</span>
          </div>
        </td>
        <td><span class="status-badge status-${task.status}">${task.status.toUpperCase()}</span></td>
        <td>${formatDate(task.created_at)}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn edit" onclick="editTask('${task.id}')" title="Edit Task">
              <span class="btn-text">Edit</span>
            </button>
            <button class="action-btn delete" onclick="deleteTask('${task.id}')" title="Delete Task">
              <span class="btn-text">Delete</span>
            </button>
          </div>
        </td>
      </tr>
    `
  }

  tasksTableBody.innerHTML = tasksHTML
}

async function loadAttendanceData() {
  renderAttendanceTable()
}

function renderAttendanceTable() {
  const attendanceTableBody = document.getElementById('attendanceTableBody')

  let attendanceHTML = ''
  attendance.forEach(record => {
    // Get user name
    let userName = 'Unknown'
    if (record.user_id) {
      const user = employees.find(emp => emp.id === record.user_id)
      userName = user ? user.full_name : 'Unknown User'
    }

    const totalHours = calculateHours(record.check_in, record.check_out)
    attendanceHTML += `
      <tr>
        <td>${userName}</td>
        <td>${formatDate(record.date)}</td>
        <td>${record.check_in ? formatTime(record.check_in) : '-'}</td>
        <td>${record.check_out ? formatTime(record.check_out) : '-'}</td>
        <td>${totalHours}</td>
        <td>
          <button class="action-btn edit" onclick="editAttendance('${record.id}')">Edit</button>
        </td>
      </tr>
    `
  })

  attendanceTableBody.innerHTML = attendanceHTML || '<tr><td colspan="6">No attendance records found</td></tr>'
}

async function loadEmployeesData() {
  try {
    // Fetch fresh employee data from database
    const { data: employeesData, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Update the global employees array
    employees = employeesData || []

    const employeesTableBody = document.getElementById('employeesTableBody')

    let employeesHTML = ''
    employees.forEach(employee => {
      const status = employee.status || 'active'
      const statusClass = status === 'active' ? 'completed' : status === 'inactive' ? 'paused' : 'cancelled'

      employeesHTML += `
        <tr>
          <td>${employee.full_name}</td>
          <td>${employee.email}</td>
          <td><span class="status-badge status-${employee.role}">${employee.role.toUpperCase()}</span></td>
          <td>${formatDate(employee.created_at)}</td>
          <td><span class="status-badge status-${statusClass}">${status.toUpperCase()}</span></td>
          <td>
            <div class="action-buttons">
              <button class="action-btn edit" onclick="editEmployee('${employee.id}')" title="Edit Employee">
                <span class="btn-text">Edit</span>
              </button>
              <button class="action-btn delete" onclick="deleteEmployee('${employee.id}')" title="Delete Employee">
                <span class="btn-text">Delete</span>
              </button>
            </div>
          </td>
        </tr>
      `
    })

    employeesTableBody.innerHTML = employeesHTML || '<tr><td colspan="6">No employees found</td></tr>'

  } catch (error) {
    console.error('Error loading employees data:', error)
    showMessage('Failed to load employees data', 'error')
  }
}

async function loadReportsData() {
  try {
    const { data: reports, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Store reports globally for filtering
    window.allReports = reports || []

    // Populate employee filter dropdown
    const reportEmployeeFilter = document.getElementById('reportEmployeeFilter')
    let employeeOptions = '<option value="">All Employees</option>'
    employees.forEach(emp => {
      employeeOptions += `<option value="${emp.id}">${emp.full_name}</option>`
    })
    reportEmployeeFilter.innerHTML = employeeOptions

    // Render reports
    renderReports(reports)

  } catch (error) {
    console.error('Error loading reports:', error)
    showMessage('Failed to load reports', 'error')
  }
}

function renderReports(reports) {
  const reportsContainer = document.getElementById('reportsContainer')

  if (!reports || reports.length === 0) {
    reportsContainer.innerHTML = '<div class="empty-state"><h3>No reports found</h3><p>No reports match the current filter criteria.</p></div>'
    return
  }

  let reportsHTML = ''
  reports.forEach(report => {
    // Get user name
    let userName = 'Unknown'
    if (report.user_id) {
      const user = employees.find(emp => emp.id === report.user_id)
      userName = user ? user.full_name : 'Unknown User'
    }

    reportsHTML += `
      <div class="report-card" data-report-id="${report.id}" data-user-id="${report.user_id}">
        <div class="report-header">
          <h4>${userName}</h4>
          <div class="report-actions">
            <button class="action-btn delete" onclick="deleteReport('${report.id}')" title="Delete Report">
              <span class="btn-text">Delete</span>
            </button>
          </div>
        </div>
        <p class="report-date">${formatDate(report.report_date)}</p>
        <p class="report-summary">${report.summary}</p>
        <small>Generated: ${formatDate(report.created_at)}</small>
      </div>
    `
  })

  reportsContainer.innerHTML = reportsHTML
}

// Task Management Functions
function openTaskModal(taskId = null) {
  const modal = document.getElementById('taskModal')
  const title = document.getElementById('taskModalTitle')

  if (taskId) {
    title.textContent = 'Edit Task'
    // Load task data for editing
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      // Add hidden input for task ID
      let hiddenIdInput = document.getElementById('taskId')
      if (!hiddenIdInput) {
        hiddenIdInput = document.createElement('input')
        hiddenIdInput.type = 'hidden'
        hiddenIdInput.name = 'id'
        hiddenIdInput.id = 'taskId'
        taskForm.appendChild(hiddenIdInput)
      }
      hiddenIdInput.value = taskId

      document.getElementById('taskTitle').value = task.title
      document.getElementById('taskDescription').value = task.description || ''
      document.getElementById('taskAssignee').value = task.assigned_to || ''
    }
  } else {
    title.textContent = 'Add New Task'
    taskForm.reset()
    // Remove hidden ID input if it exists
    const hiddenIdInput = document.getElementById('taskId')
    if (hiddenIdInput) {
      hiddenIdInput.remove()
    }
  }

  modal.classList.add('active')
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('active')
  taskForm.reset()
}

async function handleTaskSubmit(e) {
  e.preventDefault()

  const formData = new FormData(taskForm)
  const taskId = formData.get('id') // Check if this is an edit
  const taskData = {
    title: formData.get('title'),
    description: formData.get('description'),
    assigned_to: formData.get('assigned_to')
  }

  // Only set created_by and status for new tasks
  if (!taskId) {
    taskData.created_by = currentUser.id
    taskData.status = 'pending'
  }

  try {
    let error

    if (taskId) {
      // Update existing task
      const result = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskId)
      error = result.error

      if (!error) {
        showMessage('Task updated successfully', 'success')
      }
    } else {
      // Create new task
      const result = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
      error = result.error

      if (!error) {
        showMessage('Task created successfully', 'success')
      }
    }

    if (error) throw error

    closeTaskModal()

    // Refresh all related data
    await loadTasksData()
    await loadOverviewData()

  } catch (error) {
    console.error('Error saving task:', error)
    showMessage('Failed to save task', 'error')
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

// Global functions for onclick handlers
window.editTask = function(taskId) {
  openTaskModal(taskId)
}

window.deleteTask = async function(taskId) {
  if (confirm('Are you sure you want to delete this task?')) {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error

      showMessage('Task deleted successfully', 'success')

      // Refresh all related data
      await loadTasksData()
      await loadOverviewData()

    } catch (error) {
      console.error('Error deleting task:', error)
      showMessage('Failed to delete task', 'error')
    }
  }
}

window.editAttendance = function(attendanceId) {
  const record = attendance.find(a => a.id === attendanceId)
  if (record) {
    document.getElementById('attendanceId').value = record.id
    document.getElementById('attendanceCheckIn').value = record.check_in ?
      new Date(record.check_in).toISOString().slice(0, 16) : ''
    document.getElementById('attendanceCheckOut').value = record.check_out ?
      new Date(record.check_out).toISOString().slice(0, 16) : ''

    document.getElementById('attendanceModal').classList.add('active')
  }
}

window.editEmployee = function(employeeId) {
  const employee = employees.find(emp => emp.id === employeeId)
  if (employee) {
    // Populate the form with employee data
    document.getElementById('employeeId').value = employee.id
    document.getElementById('employeeFullName').value = employee.full_name || ''
    document.getElementById('employeeEmail').value = employee.email || ''
    document.getElementById('employeeRole').value = employee.role || 'employee'
    document.getElementById('employeeStatus').value = employee.status || 'active'

    // Show the modal
    document.getElementById('employeeModal').classList.add('active')
  } else {
    showMessage('Employee not found', 'error')
  }
}

window.deleteEmployee = async function(employeeId) {
  const employee = employees.find(emp => emp.id === employeeId)
  if (!employee) {
    showMessage('Employee not found', 'error')
    return
  }

  // Prevent deleting the current admin user
  if (employee.id === currentUser.id) {
    showMessage('You cannot delete your own account', 'error')
    return
  }

  if (confirm(`Are you sure you want to delete employee "${employee.full_name}"? This action cannot be undone.`)) {
    try {
      // First, check if employee has any associated data
      const { data: employeeTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('assigned_to', employeeId)

      const { data: employeeAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', employeeId)

      if (employeeTasks?.length > 0 || employeeAttendance?.length > 0) {
        const confirmDelete = confirm(
          `This employee has ${employeeTasks?.length || 0} tasks and ${employeeAttendance?.length || 0} attendance records. ` +
          'Deleting will remove all associated data. Continue?'
        )
        if (!confirmDelete) return
      }

      // Delete associated data first
      if (employeeTasks?.length > 0) {
        await supabase.from('tasks').delete().eq('assigned_to', employeeId)
      }

      if (employeeAttendance?.length > 0) {
        await supabase.from('attendance').delete().eq('user_id', employeeId)
      }

      // Delete reports
      await supabase.from('reports').delete().eq('user_id', employeeId)

      // Finally delete the user
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', employeeId)

      if (error) throw error

      // Remove from local array
      const employeeIndex = employees.findIndex(emp => emp.id === employeeId)
      if (employeeIndex !== -1) {
        employees.splice(employeeIndex, 1)
      }

      showMessage('Employee deleted successfully', 'success')

      // Refresh all data
      await loadEmployeesData()
      await loadTasksData()
      await loadAttendanceData()
      await loadOverviewData()

    } catch (error) {
      console.error('Error deleting employee:', error)
      showMessage('Failed to delete employee: ' + error.message, 'error')
    }
  }
}

// Report Management Functions
window.deleteReport = async function(reportId) {
  if (!reportId) {
    showMessage('Report ID not found', 'error')
    return
  }

  if (confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId)

      if (error) throw error

      // Remove the report card from the UI
      const reportCard = document.querySelector(`[data-report-id="${reportId}"]`)
      if (reportCard) {
        reportCard.remove()
      }

      showMessage('Report deleted successfully', 'success')

      // Refresh reports data
      await loadReportsData()

    } catch (error) {
      console.error('Error deleting report:', error)
      showMessage('Failed to delete report: ' + error.message, 'error')
    }
  }
}

// Additional functions for filters and attendance
function filterTasks() {
  const statusFilter = document.getElementById('taskStatusFilter').value
  const employeeFilter = document.getElementById('taskEmployeeFilter').value

  let filteredTasks = tasks

  if (statusFilter) {
    filteredTasks = filteredTasks.filter(task => task.status === statusFilter)
  }

  if (employeeFilter) {
    filteredTasks = filteredTasks.filter(task => task.assigned_to === employeeFilter)
  }

  // Update the tasks array temporarily for rendering
  const originalTasks = tasks
  tasks = filteredTasks
  renderTasksTable()
  tasks = originalTasks
}

function filterReports() {
  const startDate = document.getElementById('reportStartDate').value
  const endDate = document.getElementById('reportEndDate').value
  const employeeFilter = document.getElementById('reportEmployeeFilter').value

  let filteredReports = window.allReports || []

  // Filter by employee
  if (employeeFilter) {
    filteredReports = filteredReports.filter(report => report.user_id === employeeFilter)
  }

  // Filter by date range
  if (startDate) {
    filteredReports = filteredReports.filter(report => {
      const reportDate = new Date(report.report_date || report.created_at)
      return reportDate >= new Date(startDate)
    })
  }

  if (endDate) {
    filteredReports = filteredReports.filter(report => {
      const reportDate = new Date(report.report_date || report.created_at)
      return reportDate <= new Date(endDate)
    })
  }

  // Render filtered reports
  renderReports(filteredReports)

  // Show filter status message
  const totalReports = window.allReports ? window.allReports.length : 0
  const filteredCount = filteredReports.length

  if (employeeFilter || startDate || endDate) {
    const employeeName = employeeFilter ?
      employees.find(emp => emp.id === employeeFilter)?.full_name || 'Selected Employee' :
      'All Employees'

    const dateRange = startDate && endDate ?
      ` from ${startDate} to ${endDate}` :
      startDate ? ` from ${startDate}` :
      endDate ? ` until ${endDate}` : ''

    showMessage(`Showing ${filteredCount} of ${totalReports} reports for ${employeeName}${dateRange}`, 'info')
  }
}

function clearReportsFilter() {
  // Clear all filter inputs
  document.getElementById('reportStartDate').value = ''
  document.getElementById('reportEndDate').value = ''
  document.getElementById('reportEmployeeFilter').value = ''

  // Show all reports
  renderReports(window.allReports || [])

  const totalReports = window.allReports ? window.allReports.length : 0
  showMessage(`Showing all ${totalReports} reports`, 'info')
}

function filterAttendance() {
  const selectedDate = document.getElementById('attendanceDate').value

  if (selectedDate) {
    const filteredAttendance = attendance.filter(record =>
      record.date === selectedDate
    )

    // Update the attendance array temporarily for rendering
    const originalAttendance = attendance
    attendance = filteredAttendance
    renderAttendanceTable()
    attendance = originalAttendance
  } else {
    renderAttendanceTable()
  }
}

async function handleAttendanceSubmit(e) {
  e.preventDefault()

  const formData = new FormData(attendanceForm)
  const attendanceData = {
    check_in: formData.get('check_in') || null,
    check_out: formData.get('check_out') || null
  }

  try {
    const { error } = await supabase
      .from('attendance')
      .update(attendanceData)
      .eq('id', formData.get('id'))

    if (error) throw error

    showMessage('Attendance updated successfully', 'success')
    closeAttendanceModal()
    await loadAttendanceData()

  } catch (error) {
    console.error('Error updating attendance:', error)
    showMessage('Failed to update attendance', 'error')
  }
}

function closeAttendanceModal() {
  document.getElementById('attendanceModal').classList.remove('active')
  attendanceForm.reset()
}

// Employee Management Functions
function closeEmployeeModal() {
  document.getElementById('employeeModal').classList.remove('active')
  document.getElementById('employeeForm').reset()
}

async function handleEmployeeSubmit(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  const employeeId = formData.get('id')
  const employeeData = {
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    role: formData.get('role'),
    status: formData.get('status') || 'active'
  }

  try {
    // Update user in Supabase
    const { data, error } = await supabase
      .from('users')
      .update(employeeData)
      .eq('id', employeeId)
      .select()

    if (error) throw error

    // Update local employees array
    const employeeIndex = employees.findIndex(emp => emp.id === employeeId)
    if (employeeIndex !== -1) {
      employees[employeeIndex] = { ...employees[employeeIndex], ...employeeData }
    }

    showMessage('Employee updated successfully', 'success')
    closeEmployeeModal()

    // Refresh the employees table
    await loadEmployeesData()

    // Refresh other data that might depend on employee info
    await loadTasksData()
    await loadOverviewData()

  } catch (error) {
    console.error('Error updating employee:', error)
    showMessage('Failed to update employee: ' + error.message, 'error')
  }
}

async function generateReport() {
  const startDate = document.getElementById('reportStartDate').value
  const endDate = document.getElementById('reportEndDate').value
  const employeeId = document.getElementById('reportEmployeeFilter').value

  if (!startDate || !endDate) {
    showMessage('Please select date range', 'error')
    return
  }

  try {
    let query = supabase
      .from('reports')
      .select(`
        *,
        user:users(full_name)
      `)
      .gte('report_date', startDate)
      .lte('report_date', endDate)

    if (employeeId) {
      query = query.eq('user_id', employeeId)
    }

    const { data: reports, error } = await query.order('report_date', { ascending: false })

    if (error) throw error

    // Generate report summary
    const reportSummary = {
      totalReports: reports.length,
      dateRange: `${startDate} to ${endDate}`,
      employees: [...new Set(reports.map(r => r.user?.full_name))].length
    }

    showMessage(`Generated report: ${reportSummary.totalReports} reports from ${reportSummary.employees} employees`, 'success')

    // Update reports display
    const reportsContainer = document.getElementById('reportsContainer')
    let reportsHTML = `
      <div class="report-summary">
        <h3>Report Summary</h3>
        <p>Period: ${reportSummary.dateRange}</p>
        <p>Total Reports: ${reportSummary.totalReports}</p>
        <p>Employees: ${reportSummary.employees}</p>
      </div>
    `

    reports.forEach(report => {
      reportsHTML += `
        <div class="report-card">
          <h4>${report.user?.full_name || 'Unknown'}</h4>
          <p class="report-date">${formatDate(report.report_date)}</p>
          <p class="report-summary">${report.summary}</p>
          <small>Generated: ${formatDate(report.created_at)}</small>
        </div>
      `
    })

    reportsContainer.innerHTML = reportsHTML || '<p>No reports found for the selected criteria</p>'

  } catch (error) {
    console.error('Error generating report:', error)
    showMessage('Failed to generate report', 'error')
  }
}

// Chart Functions
function createAnalyticsCharts() {
  createTaskStatusChart()
  createEmployeePerformanceChart()
  createAttendanceTrendsChart()
}

function createTaskStatusChart() {
  const ctx = document.getElementById('taskStatusChart')
  if (!ctx) return

  // Destroy existing chart
  if (taskStatusChart) {
    taskStatusChart.destroy()
  }

  // Calculate task status distribution
  const statusCounts = {
    pending: 0,
    running: 0,
    paused: 0,
    completed: 0,
    cancelled: 0
  }

  tasks.forEach(task => {
    if (statusCounts.hasOwnProperty(task.status)) {
      statusCounts[task.status]++
    }
  })

  taskStatusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Running', 'Paused', 'Completed', 'Cancelled'],
      datasets: [{
        data: [statusCounts.pending, statusCounts.running, statusCounts.paused, statusCounts.completed, statusCounts.cancelled],
        backgroundColor: [
          '#f59e0b',
          '#3b82f6',
          '#ef4444',
          '#10b981',
          '#6b7280'
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

function createEmployeePerformanceChart() {
  const ctx = document.getElementById('employeePerformanceChart')
  if (!ctx) return

  // Destroy existing chart
  if (employeePerformanceChart) {
    employeePerformanceChart.destroy()
  }

  // Calculate employee task completion
  const employeeStats = {}

  employees.forEach(emp => {
    employeeStats[emp.full_name] = {
      completed: 0,
      total: 0
    }
  })

  tasks.forEach(task => {
    if (task.assigned_to) {
      const employee = employees.find(emp => emp.id === task.assigned_to)
      if (employee) {
        employeeStats[employee.full_name].total++
        if (task.status === 'completed') {
          employeeStats[employee.full_name].completed++
        }
      }
    }
  })

  const labels = Object.keys(employeeStats)
  const completionRates = labels.map(name => {
    const stats = employeeStats[name]
    return stats.total > 0 ? (stats.completed / stats.total * 100) : 0
  })

  employeePerformanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Completion Rate (%)',
        data: completionRates,
        backgroundColor: '#1e293b',
        borderRadius: 4
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
          max: 100,
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

function createAttendanceTrendsChart() {
  const ctx = document.getElementById('attendanceTrendsChart')
  if (!ctx) return

  // Destroy existing chart
  if (attendanceTrendsChart) {
    attendanceTrendsChart.destroy()
  }

  // Calculate last 7 days attendance
  const last7Days = []
  const attendanceCounts = []

  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    last7Days.push(date.toLocaleDateString('en-US', { weekday: 'short' }))

    const dayAttendance = attendance.filter(a => a.date === dateStr && a.check_in)
    attendanceCounts.push(dayAttendance.length)
  }

  attendanceTrendsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last7Days,
      datasets: [{
        label: 'Employees Present',
        data: attendanceCounts,
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

// PDF Export Functions
window.exportAdminDashboardPDF = function() {
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
    doc.text('Administrative Dashboard Report', 130, 16)

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
    doc.text('Time Track Hub - Administrative Report - Confidential', 20, pageHeight - 6)
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

  // Admin Information Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('ADMINISTRATIVE OVERVIEW', 20, yPos)
  yPos += 15

  // Admin details box
  doc.setFillColor(248, 250, 252) // #f8fafc
  doc.rect(20, yPos - 5, 170, 25, 'F')
  doc.setDrawColor(226, 232, 240) // #e2e8f0
  doc.rect(20, yPos - 5, 170, 25, 'S')

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Administrator: ${currentUser.user_metadata?.full_name || 'Admin User'}`, 25, yPos + 5)
  doc.text(`Email: ${currentUser.email}`, 25, yPos + 12)
  doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 120, yPos + 5)
  doc.text(`Report Time: ${new Date().toLocaleTimeString()}`, 120, yPos + 12)
  yPos += 35

  checkPageBreak()

  // Key Metrics Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('KEY PERFORMANCE METRICS', 20, yPos)
  yPos += 15

  const totalEmployeesText = document.getElementById('totalEmployees')?.textContent || '0'
  const activeTasksText = document.getElementById('activeTasks')?.textContent || '0'
  const completedTasksText = document.getElementById('completedTasks')?.textContent || '0'
  const presentTodayText = document.getElementById('presentToday')?.textContent || '0'

  // Metrics cards
  const metrics = [
    { label: 'Total Employees', value: totalEmployeesText, color: [59, 130, 246] },
    { label: 'Active Tasks', value: activeTasksText, color: [245, 158, 11] },
    { label: 'Completed Tasks', value: completedTasksText, color: [16, 185, 129] },
    { label: 'Present Today', value: presentTodayText, color: [139, 92, 246] }
  ]

  let cardX = 20
  const cardWidth = 40
  const cardHeight = 30

  metrics.forEach(metric => {
    // Card background
    doc.setFillColor(metric.color[0], metric.color[1], metric.color[2])
    doc.rect(cardX, yPos, cardWidth, cardHeight, 'F')

    // Card text
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(metric.value, cardX + cardWidth/2, yPos + 12, { align: 'center' })

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(metric.label.toUpperCase(), cardX + cardWidth/2, yPos + 20, { align: 'center' })

    cardX += cardWidth + 5
  })

  yPos += cardHeight + 20
  checkPageBreak()

  // Task Status Analysis
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('TASK STATUS ANALYSIS', 20, yPos)
  yPos += 15

  const statusCounts = {
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    paused: tasks.filter(t => t.status === 'paused').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    cancelled: tasks.filter(t => t.status === 'cancelled').length
  }

  const totalTasks = Object.values(statusCounts).reduce((a, b) => a + b, 0)

  // Task status table
  const taskStatusData = [
    ['Status', 'Count', 'Percentage', 'Trend'],
    ['Pending', statusCounts.pending.toString(), totalTasks > 0 ? `${Math.round((statusCounts.pending / totalTasks) * 100)}%` : '0%', 'Stable'],
    ['Running', statusCounts.running.toString(), totalTasks > 0 ? `${Math.round((statusCounts.running / totalTasks) * 100)}%` : '0%', 'Active'],
    ['Paused', statusCounts.paused.toString(), totalTasks > 0 ? `${Math.round((statusCounts.paused / totalTasks) * 100)}%` : '0%', 'Review'],
    ['Completed', statusCounts.completed.toString(), totalTasks > 0 ? `${Math.round((statusCounts.completed / totalTasks) * 100)}%` : '0%', 'Success'],
    ['Cancelled', statusCounts.cancelled.toString(), totalTasks > 0 ? `${Math.round((statusCounts.cancelled / totalTasks) * 100)}%` : '0%', 'Closed']
  ]

  // Draw task status table
  let tableY = yPos
  const colWidths = [40, 25, 30, 25]
  const rowHeight = 8

  taskStatusData.forEach((row, index) => {
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

  yPos = tableY + 20
  checkPageBreak()

  // Employee Performance Summary
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('EMPLOYEE PERFORMANCE SUMMARY', 20, yPos)
  yPos += 15

  if (employees.length === 0) {
    doc.setFontSize(12)
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.text('No employees found', 20, yPos)
    yPos += 15
  } else {
    // Employee performance table
    const employeeData = [['Employee Name', 'Tasks Assigned', 'Completed', 'Completion Rate']]

    employees.slice(0, 15).forEach(employee => {
      const employeeTasks = tasks.filter(t => t.assigned_to === employee.id)
      const completedTasks = employeeTasks.filter(t => t.status === 'completed')
      const completionRate = employeeTasks.length > 0 ? Math.round((completedTasks.length / employeeTasks.length) * 100) : 0

      employeeData.push([
        employee.full_name.length > 25 ? employee.full_name.substring(0, 25) + '...' : employee.full_name,
        employeeTasks.length.toString(),
        completedTasks.length.toString(),
        `${completionRate}%`
      ])
    })

    // Draw employee table
    let empTableY = yPos
    const empColWidths = [60, 30, 30, 30]
    const empRowHeight = 8

    employeeData.forEach((row, index) => {
      checkPageBreak(10)
      if (yPos !== empTableY) {
        empTableY = yPos
      }

      let empTableX = 20

      if (index === 0) {
        // Header row
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
        doc.rect(empTableX, empTableY, empColWidths.reduce((a, b) => a + b), empRowHeight, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
      } else {
        // Data rows
        doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255)
        doc.rect(empTableX, empTableY, empColWidths.reduce((a, b) => a + b), empRowHeight, 'F')
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
      }

      doc.setFontSize(9)
      row.forEach((cell, cellIndex) => {
        doc.text(cell, empTableX + 2, empTableY + 5)
        empTableX += empColWidths[cellIndex]
      })

      empTableY += empRowHeight
    })
    yPos = empTableY + 15
  }

  // Add footer to last page
  addFooter()

  // Save the PDF
  const fileName = `Admin_Dashboard_Report_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
  showMessage('Professional admin dashboard report exported successfully!', 'success')
}

window.exportAllReportsPDF = function() {
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
    doc.text('Comprehensive Employee Reports', 125, 16)

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
    doc.text('Time Track Hub - All Employee Reports - Confidential', 20, pageHeight - 6)
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

  // Report Overview Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('COMPREHENSIVE EMPLOYEE REPORTS', 20, yPos)
  yPos += 15

  // Generation details box
  doc.setFillColor(248, 250, 252) // #f8fafc
  doc.rect(20, yPos - 5, 170, 25, 'F')
  doc.setDrawColor(226, 232, 240) // #e2e8f0
  doc.rect(20, yPos - 5, 170, 25, 'S')

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Generated by: ${currentUser.user_metadata?.full_name || 'Admin User'}`, 25, yPos + 5)
  doc.text(`Administrator Email: ${currentUser.email}`, 25, yPos + 12)
  doc.text(`Export Date: ${new Date().toLocaleDateString()}`, 120, yPos + 5)
  doc.text(`Export Time: ${new Date().toLocaleTimeString()}`, 120, yPos + 12)
  yPos += 35

  checkPageBreak()

  // Get reports from the DOM
  const reportElements = document.querySelectorAll('.report-card')

  // Reports Summary Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('REPORTS SUMMARY', 20, yPos)
  yPos += 15

  // Summary metrics
  doc.setFillColor(240, 253, 244) // Light green background
  doc.rect(20, yPos - 5, 170, 20, 'F')
  doc.setDrawColor(34, 197, 94) // Green border
  doc.rect(20, yPos - 5, 170, 20, 'S')

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Total Reports: ${reportElements.length}`, 25, yPos + 5)
  doc.text(`Active Employees: ${employees.length}`, 120, yPos + 5)
  yPos += 25

  checkPageBreak()

  // Individual Reports Section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('DETAILED EMPLOYEE REPORTS', 20, yPos)
  yPos += 15

  if (reportElements.length === 0) {
    // No reports message
    doc.setFillColor(254, 242, 242) // Light red background
    doc.rect(20, yPos - 5, 170, 30, 'F')
    doc.setDrawColor(239, 68, 68) // Red border
    doc.rect(20, yPos - 5, 170, 30, 'S')

    doc.setFontSize(14)
    doc.setTextColor(185, 28, 28) // Red text
    doc.text('No Employee Reports Available', 25, yPos + 8)

    doc.setFontSize(12)
    doc.setTextColor(107, 114, 128) // Gray text
    doc.text('No reports have been generated by employees yet.', 25, yPos + 18)
    yPos += 35
  } else {
    let reportCounter = 1

    reportElements.forEach((reportElement, index) => {
      checkPageBreak(60)

      const employeeName = reportElement.querySelector('h4')?.textContent || `Employee ${index + 1}`
      const reportDate = reportElement.querySelector('.report-date')?.textContent || 'No date available'
      const summary = reportElement.querySelector('.report-summary')?.textContent || 'No summary available'
      const generated = reportElement.querySelector('small')?.textContent || 'No generation date'

      // Report section background
      doc.setFillColor(249, 250, 251) // #f9fafb
      doc.rect(20, yPos - 5, 170, 55, 'F')
      doc.setDrawColor(209, 213, 219) // #d1d5db
      doc.rect(20, yPos - 5, 170, 55, 'S')

      // Report number badge
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
      doc.circle(30, yPos + 8, 10, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(reportCounter.toString(), 30, yPos + 12, { align: 'center' })

      // Employee name
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(employeeName, 45, yPos + 8)

      // Report metadata
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Report Date: ${reportDate}`, 45, yPos + 18)
      doc.text(generated, 45, yPos + 26)

      // Report content
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(summary, 140)
      doc.text(lines, 25, yPos + 36)

      yPos += 65
      reportCounter++
    })
  }

  // Final Summary Section
  checkPageBreak(50)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('EXPORT SUMMARY', 20, yPos)
  yPos += 15

  // Final summary box
  doc.setFillColor(240, 249, 255) // Light blue background
  doc.rect(20, yPos - 5, 170, 35, 'F')
  doc.setDrawColor(59, 130, 246) // Blue border
  doc.rect(20, yPos - 5, 170, 35, 'S')

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Total Reports Exported: ${reportElements.length}`, 25, yPos + 8)
  doc.text(`Total Employees: ${employees.length}`, 25, yPos + 16)
  doc.text(`Export Completion: 100%`, 25, yPos + 24)
  doc.text(`Generated by: ${currentUser.user_metadata?.full_name || 'Admin User'}`, 120, yPos + 8)
  doc.text(`Export Date: ${new Date().toLocaleDateString()}`, 120, yPos + 16)
  doc.text(`Status: Complete`, 120, yPos + 24)

  // Add footer to last page
  addFooter()

  // Save the PDF
  const fileName = `All_Employee_Reports_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
  showMessage('Professional comprehensive reports exported successfully!', 'success')
}
