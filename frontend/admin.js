const API_URL = window.location.origin + '/api';

let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let currentToken = localStorage.getItem('token') || null;

document.addEventListener('DOMContentLoaded', () => {
    if (!currentToken || !currentUser || !currentUser.is_admin) {
        window.location.href = 'index.html'; // Kick out non-admins
        return;
    }

    document.getElementById('nav-username').textContent = currentUser.name;
    navigateAdmin('dashboard');
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.className = 'toast hidden'; }, 3000);
}

async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'API request failed');
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

function navigateAdmin(view) {
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById(`nav-${view}`).classList.add('active');

    const titles = {
        'dashboard': 'Platform Analytics',
        'users': 'User Management',
        'fake': 'Fake Profile Detection',
        'attendance': 'Attendance Monitoring',
        'events': 'Event Management'
    };
    document.getElementById('top-title').textContent = titles[view];

    const app = document.getElementById('admin-app');

    switch (view) {
        case 'dashboard':
            app.innerHTML = renderAdminDashboard();
            fetchAdminStats();
            break;
        case 'users':
            app.innerHTML = renderUserManagement();
            fetchUsersList();
            break;
        case 'fake':
            app.innerHTML = renderFakeDetection();
            break;
        case 'attendance':
            app.innerHTML = renderAttendanceMonitor();
            fetchLowAttendance();
            break;
        case 'events':
            app.innerHTML = renderEventManagement();
            fetchAdminEvents();
            break;
    }
}

// ==================== RENDERS ====================

function renderAdminDashboard() {
    return `
        <div class="grid mb-2">
            <div class="card stat-card border-left-primary">
                <h3>Total Users</h3>
                <div class="value" id="stat-users">--</div>
                <i class="fas fa-users"></i>
            </div>
            <div class="card stat-card">
                <h3>Total Events</h3>
                <div class="value" id="stat-events">--</div>
                <i class="fas fa-calendar-alt"></i>
            </div>
            <div class="card stat-card">
                <h3>Messages Sent</h3>
                <div class="value" id="stat-msgs">--</div>
                <i class="fas fa-envelope"></i>
            </div>
            <div class="card stat-card" style="border-left: 4px solid var(--danger);">
                <h3 class="text-danger">Fake Accounts Detected</h3>
                <div class="value text-danger" id="stat-fakes">--</div>
                <i class="fas fa-user-secret text-danger" style="opacity: 0.2"></i>
            </div>
        </div>
        
        <div class="card">
            <h3>System Status</h3>
            <p class="text-muted mb-1">All systems operational. Machine learning models for recommendations and isolation forest anomaly detection are nominal.</p>
        </div>
    `;
}

function renderUserManagement() {
    return `
        <div class="card">
            <div class="flex-between mb-1">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" id="admin-search-users" placeholder="Search users by name..." onkeyup="filterUsersTable(event)">
                </div>
                <button class="btn btn-sm" onclick="fetchUsersList()"><i class="fas fa-sync"></i> Refresh</button>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th> <th>Name</th> <th>Email</th> <th>Trust Score</th> <th>Status</th> <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="admin-users-tbody">
                        <tr><td colspan="6" class="text-center">Loading users...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Warning Modal -->
        <div id="warning-modal" class="card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:90%; max-width:400px; box-shadow:0 0 50px rgba(0,0,0,0.5);">
            <h3>Send Warning</h3>
            <p class="text-muted mb-1 text-sm">Send an official platform warning message directly to the user's inbox.</p>
            <input type="hidden" id="warn-user-id">
            <textarea id="warning-message" rows="3" style="width:100%; margin-bottom:1rem; border-radius:6px; padding:0.8rem; background: var(--dark); color: white; border:1px solid var(--border);" placeholder="You are violating platform policies..."></textarea>
            <div class="flex-between">
                <button class="btn btn-outline" onclick="document.getElementById('warning-modal').style.display='none'">Cancel</button>
                <button class="btn btn-warning" onclick="submitWarning()">Send Warning</button>
            </div>
        </div>
        <div id="modal-bg" style="display:none; position:fixed; top:0;left:0;right:0;bottom:0; background:rgba(0,0,0,0.7); z-index:999;" onclick="document.getElementById('warning-modal').style.display='none'; this.style.display='none';"></div>
    `;
}

function renderFakeDetection() {
    return `
        <div class="card mb-2" style="border-left: 4px solid var(--danger); background: rgba(239, 68, 68, 0.05);">
            <div class="flex-between gap-1 flex-wrap">
                <div>
                    <h3 class="text-danger"><i class="fas fa-robot"></i> Run ML Anomaly Scan</h3>
                    <p class="text-sm">Initiates an Isolation Forest algorithm to detect outliers in user behavior combinations (skills, events, message sending rates).</p>
                </div>
                <button class="btn btn-danger" onclick="executeMLScan()" id="btn-scan">Execute System Scan</button>
            </div>
        </div>
        
        <div class="card">
            <h3>Flagged Accounts</h3>
            <p class="text-muted mb-1 text-sm">Accounts identified as suspicious by the ML model. Manual review recommended.</p>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr><th>ID</th> <th>Name</th> <th>Trust Score</th> <th>ML Status</th> <th>Action</th></tr>
                    </thead>
                    <tbody id="flagged-users-tbody">
                        <tr><td colspan="5" class="text-center text-muted">Run scan to populate or loading from DB...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderAttendanceMonitor() {
    return `
        <div class="card mb-2 flex-between">
            <div>
                <h3><i class="fas fa-exclamation-triangle text-warning"></i> Low Attendance Risk Report</h3>
                <p class="text-sm text-muted">Students falling below the 75% threshold across their total aggregate classes.</p>
            </div>
            <button class="btn btn-outline" onclick="exportAttendanceCSV()"><i class="fas fa-download"></i> Export CSV</button>
        </div>
        
        <div class="card">
            <div class="table-responsive">
                <table id="attendance-table">
                    <thead>
                        <tr><th>User ID</th> <th>Student Name</th> <th>Aggregate %</th> <th>Risk Level</th> <th>Action</th></tr>
                    </thead>
                    <tbody id="attendance-tbody">
                        <tr><td colspan="5" class="text-center">Loading risk data...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderEventManagement() {
    return `
        <div class="card">
            <h3>Platform Events Overview</h3>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr><th>ID</th> <th>Title</th> <th>Creator</th> <th>Date</th> <th>Participants</th> <th>Action</th></tr>
                    </thead>
                    <tbody id="events-tbody">
                        <tr><td colspan="6" class="text-center">Loading events...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ==================== LOGIC / API CALLS ====================

async function fetchAdminStats() {
    try {
        const data = await apiCall('/admin/stats');
        document.getElementById('stat-users').innerHTML = data.stats.total_users;
        document.getElementById('stat-events').innerHTML = data.stats.total_events;
        document.getElementById('stat-msgs').innerHTML = data.stats.total_messages;
        document.getElementById('stat-fakes').innerHTML = data.stats.fake_accounts;
    } catch (e) { }
}

let cachedUsers = [];

async function fetchUsersList() {
    try {
        const data = await apiCall('/admin/users');
        cachedUsers = data.users;
        populateUsersTable(data.users);
    } catch (e) { }
}

function populateUsersTable(users) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => {
        const statusBadge = u.is_suspended
            ? '<span class="badge badge-danger">Suspended</span>'
            : '<span class="badge badge-success">Active</span>';

        return `
            <tr>
                <td class="text-muted">#${u.id}</td>
                <td style="font-weight:500;">${u.name} ${u.is_admin ? '<i class="fas fa-shield-alt text-primary" title="Admin"></i>' : ''}</td>
                <td class="text-muted">${u.email}</td>
                <td><span class="${u.trust_score < 40 ? 'text-danger fw-bold' : ''}">${u.trust_score}</span></td>
                <td>${statusBadge}</td>
                <td>
                    ${!u.is_admin ? `
                        <button class="btn btn-sm btn-outline mb-1" onclick="openWarnModal(${u.id})" style="padding:0.2rem 0.5rem;" title="Send Warning"><i class="fas fa-envelope"></i></button>
                        <button class="btn btn-sm ${u.is_suspended ? 'btn-success' : 'btn-warning'} mb-1" onclick="toggleSuspend(${u.id})" style="padding:0.2rem 0.5rem;" title="Suspend/Unsuspend"><i class="fas fa-ban"></i></button>
                        <button class="btn btn-sm btn-danger mb-1" onclick="deleteUser(${u.id}, '${u.name}')" style="padding:0.2rem 0.5rem;" title="Delete Data"><i class="fas fa-trash"></i></button>
                    ` : '<span class="text-muted text-sm">Protected</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

function filterUsersTable(e) {
    const term = e.target.value.toLowerCase();
    const filtered = cachedUsers.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
    populateUsersTable(filtered);
}

async function toggleSuspend(userId) {
    try {
        const res = await apiCall(`/admin/suspend/${userId}`, 'POST');
        showToast(res.message);
        fetchUsersList(); // refresh
    } catch (e) { }
}

async function deleteUser(userId, name) {
    if (confirm(`WARNING: This will permanently delete user ${name} and all associated data. Proceed?`)) {
        try {
            await apiCall(`/admin/user/${userId}`, 'DELETE');
            showToast('User deleted forever', 'success');
            fetchUsersList();
        } catch (e) { }
    }
}

function openWarnModal(userId) {
    document.getElementById('warn-user-id').value = userId;
    document.getElementById('warning-modal').style.display = 'block';
    document.getElementById('modal-bg').style.display = 'block';
}

async function submitWarning() {
    const id = document.getElementById('warn-user-id').value;
    const msg = document.getElementById('warning-message').value;
    if (!msg) return;

    try {
        await apiCall('/admin/send_warning', 'POST', { user_id: id, message: msg });
        showToast('Warning sent to user inbox');
        document.getElementById('warning-modal').style.display = 'none';
        document.getElementById('modal-bg').style.display = 'none';
        document.getElementById('warning-message').value = '';
    } catch (e) { }
}

async function executeMLScan() {
    const btn = document.getElementById('btn-scan');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    btn.disabled = true;

    try {
        const res = await apiCall('/admin/run_fake_detection', 'POST');
        showToast(res.message);
        // Refresh users to get latest suspicious flags
        const data = await apiCall('/admin/users');
        populateFlaggedUsers(data.users);
    } catch (e) {
    } finally {
        btn.innerHTML = 'Execute System Scan';
        btn.disabled = false;
    }
}

function populateFlaggedUsers(users) {
    const tbody = document.getElementById('flagged-users-tbody');
    if (!tbody) return;

    const flagged = users.filter(u => u.is_suspicious);

    if (flagged.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-success"><i class="fas fa-check-circle"></i> No suspicious accounts detected</td></tr>';
        return;
    }

    tbody.innerHTML = flagged.map(u => `
        <tr>
            <td class="text-muted">#${u.id}</td>
            <td>${u.name}</td>
            <td class="text-danger fw-bold">${u.trust_score}</td>
            <td><span class="badge badge-danger">ML Anomaly Detected</span></td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="toggleSuspend(${u.id})">Suspend</button>
            </td>
        </tr>
    `).join('');
}

// Low Attendance 
let attendanceExportData = [];

async function fetchLowAttendance() {
    try {
        const data = await apiCall('/admin/low_attendance');
        attendanceExportData = data.low_attendance;
        const tbody = document.getElementById('attendance-tbody');

        if (!attendanceExportData || attendanceExportData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-success">All students are above attendance thresholds.</td></tr>';
            return;
        }

        tbody.innerHTML = attendanceExportData.map(r => `
            <tr>
                <td class="text-muted">#${r.user_id}</td>
                <td style="font-weight:500;">${r.name}</td>
                <td class="${r.overall_attendance < 65 ? 'text-danger' : 'text-warning'} fw-bold">${r.overall_attendance}%</td>
                <td><span class="badge ${r.overall_attendance < 65 ? 'badge-danger' : 'badge-warning'}">${r.status}</span></td>
                <td><button class="btn btn-sm btn-outline" onclick="openWarnModal(${r.user_id})">Warn Student</button></td>
            </tr>
        `).join('');

    } catch (e) { }
}

function exportAttendanceCSV() {
    if (attendanceExportData.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student ID,Student Name,Aggregate Attendance(%),Risk Status\n";

    attendanceExportData.forEach(row => {
        csvContent += `${row.user_id},"${row.name}",${row.overall_attendance},"${row.status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_risk_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function fetchAdminEvents() {
    try {
        const data = await apiCall('/events');
        const tbody = document.getElementById('events-tbody');

        if (data.events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No active events.</td></tr>';
            return;
        }

        tbody.innerHTML = data.events.map(e => `
            <tr>
                <td class="text-muted">#${e.id}</td>
                <td style="font-weight:500;">${e.title}</td>
                <td class="text-muted">${e.creator_name || 'System Generated'}</td>
                <td>${e.date}</td>
                <td>${e.participants}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteAdminEvent(${e.id}, '${e.title}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) { }
}

async function deleteAdminEvent(eventId, title) {
    if (confirm(`Remove event "${title}" from the platform?`)) {
        try {
            await apiCall(`/admin/event/${eventId}`, 'DELETE');
            showToast('Event removed', 'success');
            fetchAdminEvents();
        } catch (e) { }
    }
}
