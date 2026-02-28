const API_URL = 'http://127.0.0.1:5000/api';

// --- State Management ---
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let currentToken = localStorage.getItem('token') || null;
let selectedChatUser = null;

// --- Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        const icon = document.querySelector('#theme-toggle i');
        if (icon) icon.className = 'fas fa-sun';
    }
    initApp();
});

function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    if (isDark) {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
        document.querySelector('#theme-toggle i').className = 'fas fa-moon';
    } else {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        document.querySelector('#theme-toggle i').className = 'fas fa-sun';
    }

    // Re-render chart colors if on dashboard
    if (document.getElementById('trustChart')) {
        initDashboardCharts();
    }
}

function initApp() {
    if (currentToken && currentUser) {
        if (currentUser.is_admin) {
            window.location.href = 'admin.html';
            return;
        }

        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('topbar').classList.remove('hidden');

        // Populate Top Navbar User Details
        document.getElementById('nav-username').textContent = currentUser.name.split(' ')[0];
        if (currentUser.profile_photo) {
            document.getElementById('nav-avatar').src = `http://127.0.0.1:5000${currentUser.profile_photo}`;
        }

        navigate('dashboard');
    } else {
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('topbar').classList.add('hidden');
        navigate('login');
    }
}

// --- Navigation/Router ---
function navigate(view) {
    const app = document.getElementById('app');

    // Check auth
    if (view !== 'login' && view !== 'signup' && !currentToken) {
        navigate('login');
        return;
    }

    switch (view) {
        case 'login':
            app.innerHTML = renderLogin();
            break;
        case 'signup':
            app.innerHTML = renderSignup();
            break;
        case 'dashboard':
            app.innerHTML = renderDashboard();
            fetchRecommendations();
            setTimeout(() => initDashboardCharts(), 100);
            break;
        case 'profile':
            app.innerHTML = renderProfile();
            break;
        case 'feed':
            app.innerHTML = renderFeed();
            fetchFeed();
            break;
        case 'events':
            app.innerHTML = renderEvents();
            fetchEvents();
            break;
        case 'chat':
            app.innerHTML = renderChat();
            fetchRecentChats();
            break;
        case 'skill_gap':
            app.innerHTML = renderSkillGap();
            fetchProjectsForSkillGap();
            break;
        case 'attendance':
            app.innerHTML = renderAttendance();
            fetchAttendanceSummary();
            break;
        case 'admin':
            if (currentUser.is_admin) {
                window.location.href = 'admin.html';
            } else {
                navigate('dashboard');
            }
            break;
    }

    // Update active state in sidebar
    if (currentToken && view !== 'login' && view !== 'signup') {
        document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
        const activeNav = document.getElementById(`nav-${view}`);
        if (activeNav) activeNav.classList.add('active');
    }
}

// --- API Helpers ---
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }

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

// --- UI Helpers ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.className = 'toast hidden'; }, 3000);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    currentToken = null;
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('topbar').classList.add('hidden');
    navigate('login');
    showToast('Logged out successfully');
}

// ==== VIEWS ====

function renderLogin() {
    return `
    <div class="container" style="display: flex; justify-content: center; align-items: center; min-height: 80vh;">
        <div class="card" style="width: 100%; max-width: 400px;">
            <div class="text-center mb-2">
                <h1 style="color: var(--primary)"><i class="fas fa-network-wired"></i> Login</h1>
                <p>CampusConnect</p>
            </div>
            <form onsubmit="handleLogin(event)">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="login-email" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="login-password" required>
                </div>
                <button type="submit" class="btn mt-2">Sign In</button>
            </form>
            <p class="text-center mt-2">
                Don't have an account? <a href="#" onclick="navigate('signup')" style="color: var(--primary)">Sign up</a>
            </p>
            <div class="text-center mt-2" style="display:flex; justify-content:center; gap:0.5rem">
                <button onclick="document.getElementById('login-email').value='student1@college.edu'; document.getElementById('login-password').value='password123';" class="btn-outline" style="font-size: 0.8rem">Demo Student</button>
            </div>
        </div>
    </div>
    `;
}

function renderSignup() {
    return `
    <div class="container" style="display: flex; justify-content: center; align-items: center; min-height: 80vh;">
        <div class="card" style="width: 100%; max-width: 450px;">
            <div class="text-center mb-2">
                <h2 style="color: var(--primary)">Create Account</h2>
                <p>Join CampusConnect</p>
            </div>
            <form onsubmit="handleSignup(event)">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="signup-name" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="signup-email" required>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <div class="form-group" style="flex: 1;">
                        <label>Branch</label>
                        <input type="text" id="signup-branch" placeholder="e.g. CS" required>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Year</label>
                        <select id="signup-year" required>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="signup-password" required>
                </div>
                <button type="submit" class="btn mt-2">Sign Up</button>
            </form>
            <p class="text-center mt-2">
                Already have an account? <a href="#" onclick="navigate('login')" style="color: var(--primary)">Login</a>
            </p>
        </div>
    </div>
    `;
}

function renderDashboard() {
    return `
    <div class="container">
        <!-- TOP 4 STAT CARDS (Mimicking the Telecom Mockup) -->
        <div class="grid mb-2" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
            
            <div class="card" onclick="navigate('profile')" style="cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); transition: transform 0.2s, box-shadow 0.2s;">
                <h4 style="color: var(--text-main); font-size: 1rem; margin-bottom: 1.5rem;">Total Skills Added</h4>
                <div style="display: flex; align-items: flex-end; justify-content: space-between;">
                    <div style="background: var(--primary); color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: bold;">
                        ${currentUser.skills ? currentUser.skills.length : 0}
                    </div>
                    <i class="fas fa-laptop-code" style="font-size: 3rem; color: #f3f4f6; margin-bottom: -5px; margin-right: -5px;"></i>
                </div>
            </div>

            <div class="card" onclick="navigate('profile')" style="cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); transition: transform 0.2s, box-shadow 0.2s;">
                <h4 style="color: var(--text-main); font-size: 1rem; margin-bottom: 1.5rem;">Active Interests</h4>
                <div style="display: flex; align-items: flex-end; justify-content: space-between;">
                    <div style="background: var(--primary); color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: bold;">
                        ${currentUser.interests ? currentUser.interests.length : 0}
                    </div>
                    <i class="fas fa-heart" style="font-size: 3rem; color: #f3f4f6; margin-bottom: -5px; margin-right: -5px;"></i>
                </div>
            </div>

            <div class="card" onclick="navigate('profile')" style="cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); transition: transform 0.2s, box-shadow 0.2s;">
                <h4 style="color: var(--text-main); font-size: 1rem; margin-bottom: 1.5rem;">Trust Score</h4>
                <div style="display: flex; align-items: flex-end; justify-content: space-between;">
                    <div style="background: var(--primary); color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: bold;">
                        ${currentUser.trust_score}
                    </div>
                    <i class="fas fa-shield-alt" style="font-size: 3rem; color: #f3f4f6; margin-bottom: -5px; margin-right: -5px;"></i>
                </div>
            </div>

            <div class="card" onclick="navigate('events')" style="cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); transition: transform 0.2s, box-shadow 0.2s;">
                <h4 style="color: var(--text-main); font-size: 1rem; margin-bottom: 1.5rem;">Hackathon Events</h4>
                <div style="display: flex; align-items: flex-end; justify-content: space-between;">
                    <div style="background: var(--primary); color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: bold;">
                        <i class="fas fa-calendar-check" style="font-size: 1.25rem;"></i>
                    </div>
                    <i class="fas fa-calendar-alt" style="font-size: 3rem; color: #f3f4f6; margin-bottom: -5px; margin-right: -5px;"></i>
                </div>
            </div>

        </div>

        <!-- CHARTS ROW -->
        <div class="grid mb-2" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
            <div class="card" style="border: 1px solid var(--border); display: flex; flex-direction: column; align-items: center;">
                <h3 class="mb-1 text-center" style="font-size: 1.1rem; color: var(--text-main);">Trust Score Analysis</h3>
                <div style="width: 100%; max-width: 250px; position: relative;">
                    <canvas id="trustChart"></canvas>
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) translate(0, 10px); font-size: 1.5rem; font-weight: bold; color: var(--text-main);">
                        ${currentUser.trust_score}%
                    </div>
                </div>
            </div>
            
            <div class="card" style="border: 1px solid var(--border); display: flex; flex-direction: column; align-items: center;">
                <h3 class="mb-1 text-center" style="font-size: 1.1rem; color: var(--text-main);">Predicted Attendance Trend</h3>
                <div style="width: 100%; height: 250px;">
                    <canvas id="attendanceChart"></canvas>
                </div>
            </div>
        </div>

        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
            <!-- Left col: Quick profile (now styled like Quick Links card) -->
            <div style="flex: 1; min-width: 300px;">
                <div class="card mb-2" style="border-left: 5px solid var(--primary);">
                    <h3 class="mb-2">Profile Links</h3>
                    <button class="btn btn-outline mb-1" onclick="navigate('profile')" style="width: 100%; border-radius: 20px; text-align: left;"><i class="fas fa-user-edit mr-2"></i> Edit Profile Information</button>
                    <button class="btn btn-outline mb-1" onclick="navigate('attendance')" style="width: 100%; border-radius: 20px; text-align: left;"><i class="fas fa-calendar-check mr-2"></i> View Attendance Records</button>
                    <button class="btn btn-outline" onclick="navigate('skill_gap')" style="width: 100%; border-radius: 20px; text-align: left;"><i class="fas fa-robot mr-2"></i> Skill Gap Analyzer</button>
                    <div class="mt-2">
                        <strong>Skills:</strong>
                        <div class="mt-1">
                            ${currentUser.skills.length > 0 ? currentUser.skills.map(s => `<span class="badge">${s}</span>`).join('') : '<span class="text-muted">No skills added yet.</span>'}
                        </div>
                    </div>
                    <button class="btn btn-outline mt-2" onclick="navigate('profile')" style="width: 100%">Edit Profile</button>
                </div>
            </div>

            <!-- Right col: ML Recommendations -->
            <div style="flex: 2; min-width: 300px;">
                <div class="card" style="border-left: 4px solid var(--secondary)">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap;" class="mb-2">
                        <h3><i class="fas fa-magic" style="color: var(--secondary)"></i> Smart Project Partner Recommendations</h3>
                        <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--secondary)">Powered by Scikit-Learn</span>
                    </div>
                    <p class="mb-2 text-muted" style="font-size:0.9rem;">Cosine similarity model recommends these peers based on your skill vector.</p>
                    <div id="recs-container" class="grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
                        Loading recommendations...
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

function renderProfile() {
    return `
    <div class="container" style="max-width: 1000px;">
        
        <!-- Top Banner & Avatar Section -->
        <div class="card mb-2" style="padding: 0; overflow: hidden; border: 1px solid var(--border);">
            <!-- Banner Image -->
            <div style="height: 150px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%); position: relative;">
                <!-- Decorative circles -->
                <div style="position: absolute; width: 100px; height: 100px; border-radius: 50%; background: rgba(255,255,255,0.1); top: -20px; left: -20px;"></div>
                <div style="position: absolute; width: 200px; height: 200px; border-radius: 50%; background: rgba(255,255,255,0.1); bottom: -100px; right: 10%;"></div>
            </div>
            
            <!-- Profile Info Bar -->
            <div style="padding: 1.5rem; position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: -60px;">
                <!-- Avatar -->
                <div style="position: relative; margin-bottom: 1rem;">
                    <img id="profile-avatar-img" src="${currentUser.profile_photo ? 'http://127.0.0.1:5000' + currentUser.profile_photo : 'https://via.placeholder.com/100'}" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid var(--card-bg); background: var(--card-bg); object-fit: cover; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <label style="position: absolute; bottom: 0; right: 0; background: var(--primary); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid var(--card-bg); transition: transform 0.2s;">
                        <i class="fas fa-camera" style="font-size: 0.8rem;"></i>
                        <input type="file" id="upload-photo-input" accept="image/png, image/jpeg" style="display: none;" onchange="handlePhotoUpload(event)">
                    </label>
                </div>
                
                <h2 style="margin-bottom: 0.2rem; color: var(--text-main); font-size: 1.5rem;">${currentUser.name}</h2>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;"><i class="fas fa-envelope mr-1"></i> ${currentUser.email}</p>
                
                <!-- Stats Row -->
                <div style="display: flex; gap: 2rem; justify-content: center; width: 100%; border-top: 1px solid var(--border); padding-top: 1rem; flex-wrap: wrap;">
                    <div style="text-align: center;">
                        <p style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Status</p>
                        <p style="font-weight: 600; color: var(--secondary);">Active Student</p>
                    </div>
                    <div style="text-align: center; border-left: 1px solid var(--border); padding-left: 2rem;">
                        <p style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Trust Score</p>
                        <p style="font-weight: 600; color: ${currentUser.trust_score >= 80 ? 'var(--secondary)' : (currentUser.trust_score >= 40 ? 'var(--warning)' : 'var(--danger)')};">
                            ${currentUser.trust_score} / 100
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Details Grid -->
        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); align-items: stretch; gap: 1.5rem;">
            
            <!-- Column 1: About Info -->
            <div class="card mb-2" style="border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                    <i class="fas fa-address-card" style="color: var(--text-muted); font-size: 1.2rem;"></i>
                    <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-main); text-transform: uppercase;">About</h3>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.2rem;">Branch</p>
                        <p style="font-weight: 500; color: var(--text-main);">${currentUser.branch}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.2rem;">Academic Year</p>
                        <p style="font-weight: 500; color: var(--text-main);">${currentUser.year}</p>
                    </div>
                </div>
            </div>

            <!-- Column 2: Skills & Interests Editor -->
            <div class="card mb-2" style="border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                    <i class="fas fa-laptop-code" style="color: var(--text-muted); font-size: 1.2rem;"></i>
                    <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-main); text-transform: uppercase;">Update Profile Vectors</h3>
                </div>
                
                <p class="mb-1" style="font-size: 0.85rem; color: var(--text-muted);">Add a comma-separated list of skills and interests to improve your ML matches.</p>
                <form onsubmit="handleProfileUpdate(event)">
                    <div class="form-group">
                        <label>Skills <span style="font-size:0.75rem; font-weight:normal;">(e.g. React, Python)</span></label>
                        <input type="text" id="update-skills" value="${currentUser.skills.join(', ')}">
                    </div>
                    <div class="form-group">
                        <label>Interests <span style="font-size:0.75rem; font-weight:normal;">(e.g. ML, Web Dev)</span></label>
                        <input type="text" id="update-interests" value="${currentUser.interests.join(', ')}">
                    </div>
                    <button type="submit" class="btn mt-1" style="width: 100%;">Save Changes</button>
                </form>
            </div>

            <!-- Column 3: Performance/Activity History (Mocking the UI layout) -->
            <div class="card mb-2" style="border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                    <i class="fas fa-chart-line" style="color: var(--text-muted); font-size: 1.2rem;"></i>
                    <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-main); text-transform: uppercase;">Performance History</h3>
                </div>

                <!-- Timeline Item 1 -->
                <div style="position: relative; padding-left: 1.5rem; margin-bottom: 1.5rem; border-left: 2px solid var(--primary);">
                    <div style="position: absolute; left: -4px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--primary);"></div>
                    <p style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.2rem;">Joined CampusConnect</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Semester Start</p>
                    <ul style="font-size: 0.85rem; color: var(--text-muted); padding-left: 1rem; margin: 0;">
                        <li>Created initial profile vectors</li>
                        <li>Engaged with dynamic project matching</li>
                    </ul>
                </div>

                <!-- Timeline Item 2 -->
                <div style="position: relative; padding-left: 1.5rem; border-left: 2px solid var(--primary);">
                    <div style="position: absolute; left: -4px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--primary);"></div>
                    <p style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.2rem;">Trust Score Established</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Current Standing</p>
                    <ul style="font-size: 0.85rem; color: var(--text-muted); padding-left: 1rem; margin: 0;">
                        <li>Maintained ${currentUser.trust_score}% rating</li>
                        <li>Consistent attendance metrics recorded</li>
                    </ul>
                </div>

            </div>

        </div>
    </div>
    `;
}

function renderFeed() {
    return `
    <div class="container" style="max-width: 800px; margin: 0 auto;">
        <h1 class="mb-2"><i class="fas fa-stream text-primary"></i> Social Feed</h1>
        
        <!-- Create Post Card -->
        <div class="card mb-2" style="background: var(--card-bg); padding: 1.5rem;">
            <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <img src="${(currentUser && currentUser.profile_photo) ? 'http://127.0.0.1:5000' + currentUser.profile_photo : 'https://via.placeholder.com/40'}" class="avatar-small">
                <form id="create-post-form" style="flex:1; display:flex; flex-direction:column; gap:0.5rem;" onsubmit="handleCreatePost(event)">
                    <textarea id="post-content" rows="3" placeholder="What's on your mind? Start a discussion..." style="width: 100%; border: none; background: transparent; resize: none; color: var(--text-main); outline: none;" required></textarea>
                    <hr style="border: 0; border-top: 1px solid var(--border); margin: 0.5rem 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label style="cursor: pointer; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-image"></i> Photo
                            <input type="file" id="post-image" accept="image/png, image/jpeg" style="display:none;">
                        </label>
                        <button type="submit" class="btn" style="padding: 0.4rem 1.5rem;">Post</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="feed-container">
            <div class="text-center text-muted mt-2">Loading feed...</div>
        </div>
    </div>
    `;
}

function renderEvents() {
    return `
    <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap;" class="mb-2">
            <h1>Campus Events</h1>
            <button class="btn" onclick="toggleEventModal()">+ Create Event</button>
        </div>
        
        <div id="events-container" class="grid">
            Loading events...
        </div>

        <!-- Create Event Modal -->
        <div id="event-modal" class="card" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000; width: 90%; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between;" class="mb-1">
                <h2>Create New Event</h2>
                <i class="fas fa-times" style="cursor: pointer;" onclick="toggleEventModal()"></i>
            </div>
            <form onsubmit="handleCreateEvent(event)">
                <div class="form-group">
                    <label>Event Title</label>
                    <input type="text" id="event-title" required>
                </div>
                <div class="form-group">
                    <label>Date</label>
                    <input type="date" id="event-date" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="event-desc" rows="3" required></textarea>
                </div>
                <div class="form-group">
                    <label>Tags (Comma separated)</label>
                    <input type="text" id="event-tags" placeholder="e.g. AI, Workshop">
                </div>
                <button type="submit" class="btn mt-1">Create</button>
            </form>
        </div>
        <div id="modal-backdrop" style="display: none; position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.7); z-index: 999;" onclick="toggleEventModal()"></div>
    </div>
    `;
}

function renderChat() {
    return `
    <div class="container">
        <h1 class="mb-2"><i class="fas fa-comment-dots text-primary"></i> Messages</h1>
        <div style="display: flex; gap: 1rem; height: 70vh; flex-wrap:wrap;">
            
            <!-- Left Side: Conversation List -->
            <div class="card" style="flex:1; min-width: 280px; display: flex; flex-direction: column; padding: 0; background: var(--card-bg);">
                <div style="padding: 1rem; border-bottom: 1px solid var(--border);">
                    <div class="search-bar" style="width: 100%;">
                        <i class="fas fa-search"></i>
                        <input type="text" id="chat-search" placeholder="Search conversations..." style="width: 100%;" onkeyup="filterChats(event)">
                    </div>
                </div>
                <div id="chat-users-list" style="flex: 1; overflow-y: auto;">
                    <p class="text-center text-muted mt-2">Loading chats...</p>
                </div>
            </div>
            
            <!-- Right Side: Active Chat -->
            <div class="card" style="flex:2; min-width: 300px; display: flex; flex-direction: column; padding: 0; background: var(--card-bg);">
                <div id="chat-header" style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); background: rgba(124, 58, 237, 0.05);">
                    <h3 style="margin: 0; color: var(--text-muted); text-align: center; margin-top: 1rem;">Select a conversation</h3>
                </div>
                
                <div id="chat-window" style="flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                    <!-- Messages -->
                </div>
                
                <div id="typing-indicator" class="hidden" style="padding: 0.5rem 1.5rem; font-size: 0.8rem; color: var(--primary); font-style: italic;">
                    Typing<span class="dot-anim">...</span>
                </div>

                <div id="chat-form-container" style="padding: 1rem; border-top: 1px solid var(--border); display: none;">
                    <form id="chat-form" style="display: flex; gap: 0.8rem;" onsubmit="handleSendMessage(event)">
                        <input type="text" id="chat-input" style="flex: 1; border-radius: 20px;" placeholder="Type a message..." required oninput="handleTyping()">
                        <button type="submit" class="btn" style="border-radius: 50%; width: 45px; height: 45px; padding: 0; display:flex; justify-content:center; align-items:center;">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
    `;
}

function renderSkillGap() {
    return `
    <div class="container">
        <h1 class="mb-2"><i class="fas fa-layer-group" style="color: var(--secondary)"></i> AI Skill Gap Analyzer</h1>
        <p class="text-muted mb-2">Select a project below to compare your current skill vector against its requirements using Scikit-Learn.</p>
        
        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
            <!-- Left: Project list -->
            <div style="flex: 1; min-width: 300px;">
                <div class="card">
                    <h3 class="mb-1">Available Projects</h3>
                    <div id="projects-list" style="max-height: 400px; overflow-y: auto;">
                        Loading projects...
                    </div>
                </div>
            </div>
            
            <!-- Right: Analysis Results -->
            <div style="flex: 2; min-width: 300px;">
                <div class="card" id="skill-gap-results" style="min-height: 400px; display: flex; flex-direction: column; justify-content: center;">
                    <div style="text-align: center; color: var(--text-muted);">
                        <i class="fas fa-robot mb-1" style="font-size: 3rem; opacity: 0.5;"></i>
                        <p>Select a project to analyze your skill gap.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

// --- ATTENDANCE TRACKER UI ---
function renderAttendance() {
    return `
    <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap; margin-bottom: 2rem;">
            <div>
                <h1 style="color: var(--secondary);"><i class="fas fa-calendar-check"></i> Attendance Tracker & ML Risk</h1>
                <p class="text-muted">Track your classes and predict attendance risks using Logistic Regression AI.</p>
            </div>
            <button class="btn btn-outline" style="border-color: var(--danger); color: var(--danger);" onclick="predictAttendanceRisk()">
                <i class="fas fa-brain"></i> Predict Future Risk
            </button>
        </div>
        
        <div class="card" style="overflow-x: auto;">
            <table style="width: 100%; text-align: left; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border);">
                        <th style="padding: 1rem 0;">Subject</th>
                        <th>%</th>
                        <th>Classes</th>
                        <th>Status</th>
                        <th>Predictive AI Alert</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="attendance-tbody">
                    <tr><td colspan="6" class="text-center text-muted">Loading attendance data...</td></tr>
                </tbody>
            </table>
        </div>
        
        <!-- Legend -->
        <div class="mt-2" style="font-size: 0.8rem; color: var(--text-muted); display:flex; gap:1rem; flex-wrap:wrap;">
            <span><i class="fas fa-circle" style="color: var(--secondary)"></i> Safe (>75%)</span>
            <span><i class="fas fa-circle" style="color: var(--warning)"></i> At Risk</span>
            <span><i class="fas fa-circle" style="color: var(--danger)"></i> Low Attendance (<75%)</span>
        </div>
    </div>
    `;
}

// ==== EVENT HANDLERS & API CALLS ====

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const data = await apiCall('/login', 'POST', { email, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentToken = data.token;
        currentUser = data.user;
        showToast('Login successful!');
        initApp();
    } catch (e) { console.error(e); }
}

async function handleSignup(e) {
    e.preventDefault();
    const body = {
        name: document.getElementById('signup-name').value,
        email: document.getElementById('signup-email').value,
        branch: document.getElementById('signup-branch').value,
        year: document.getElementById('signup-year').value,
        password: document.getElementById('signup-password').value
    };
    try {
        await apiCall('/signup', 'POST', body);
        showToast('Account created! Please login.');
        navigate('login');
    } catch (e) { console.error(e); }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const skills = document.getElementById('update-skills').value.split(',').map(s => s.trim()).filter(s => s);
    const interests = document.getElementById('update-interests').value.split(',').map(s => s.trim()).filter(s => s);

    try {
        const data = await apiCall('/add_skills', 'POST', { skills, interests });
        currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        showToast('Profile updated successfully!');
        navigate('dashboard');
    } catch (e) { console.error(e); }
}

async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profile_photo', file);

    try {
        const response = await fetch(API_URL + '/upload_profile_photo', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + currentToken },
            body: formData
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to upload photo');

        currentUser.profile_photo = data.profile_photo_url;
        localStorage.setItem('user', JSON.stringify(currentUser));
        document.getElementById('profile-avatar-img').src = 'http://127.0.0.1:5000' + data.profile_photo_url;
        document.getElementById('nav-avatar').src = 'http://127.0.0.1:5000' + data.profile_photo_url;
        showToast('Profile photo updated!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

let trustChartInstance = null;
let attChartInstance = null;
function initDashboardCharts() {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#9ca3af' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    const ctxTrust = document.getElementById('trustChart');
    if (ctxTrust) {
        if (trustChartInstance) trustChartInstance.destroy();
        trustChartInstance = new Chart(ctxTrust, {
            type: 'doughnut',
            data: {
                labels: ['Trust Score', 'Suspicion Risk'],
                datasets: [{
                    data: [currentUser.trust_score, 100 - currentUser.trust_score],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) { return ' ' + context.label + ': ' + context.raw + '%'; }
                        }
                    }
                }
            }
        });
    }

    const ctxAtt = document.getElementById('attendanceChart');
    if (ctxAtt) {
        if (attChartInstance) attChartInstance.destroy();
        // Mock data for attendance trend over months
        attChartInstance = new Chart(ctxAtt, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                datasets: [{
                    label: 'Overall Attendance %',
                    data: [80, 85, 82, 90, 88],
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#7c3aed',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 60,
                        max: 100,
                        ticks: { color: textColor },
                        grid: { color: gridColor, drawBorder: false }
                    },
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false, drawBorder: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

async function fetchRecommendations() {
    try {
        const data = await apiCall('/recommend_students');
        const container = document.getElementById('recs-container');
        if (data.recommendations.length === 0) {
            container.innerHTML = `<p class="text-muted">No recommendations generated yet. Add more skills to find matches!</p>`;
            return;
        }

        container.innerHTML = data.recommendations.map(user => `
            <div class="card" style="padding: 1.5rem; background: var(--card-bg); border-left: 4px solid var(--secondary); display: flex; flex-direction: column; gap: 0.5rem; align-items: center; text-align: center;">
                <img src="${user.profile_photo ? 'http://127.0.0.1:5000' + user.profile_photo : 'https://via.placeholder.com/60'}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--secondary);">
                
                <div style="width: 100%;">
                    <div style="display:flex; justify-content:space-between; align-items: center; width: 100%;">
                        <h4 style="margin: 0; font-size:1.1rem; color:var(--text-main);">${user.name}</h4>
                        <span class="badge" style="background: rgba(37, 99, 235, 0.1); color: var(--secondary); margin: 0;">${user.similarity_score}% Match</span>
                    </div>
                </div>
                
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${user.branch} • ${user.year}</p>
                <div style="display: flex; gap: 0.3rem; flex-wrap: wrap; justify-content: center; margin-top: 0.5rem;">
                    ${user.skills.map(s => `<span class="badge" style="font-size: 0.7rem; padding: 0.2rem 0.6rem;">${s}</span>`).join('')}
                </div>
                <button class="btn btn-outline mt-1" style="width:100%;" onclick="viewPublicProfile(${user.id})">View Profile</button>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('recs-container').innerHTML = `<p class="text-danger">Failed to load recommendations.</p>`;
    }
}

async function viewPublicProfile(userId) {
    try {
        const data = await apiCall(`/user/${userId}`);
        const app = document.getElementById('app');
        app.innerHTML = renderPublicProfile(data);
    } catch (e) { console.error(e); }
}

function renderPublicProfile(u) {
    return `
    <div class="container" style="max-width: 800px; margin: 0 auto;">
        <button class="btn-outline mb-2" onclick="navigate('dashboard')"><i class="fas fa-arrow-left"></i> Back</button>
        <div class="card mb-2" style="position: relative; padding-top: 4rem;">
            <!-- Dummy banner -->
            <div style="position: absolute; top:0; left:0; right:0; height: 80px; background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); border-radius: 16px 16px 0 0;"></div>
            
            <div style="position: relative; display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
                <img src="${u.profile_photo ? 'http://127.0.0.1:5000' + u.profile_photo : 'https://via.placeholder.com/100'}" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid var(--card-bg); background: var(--card-bg); object-fit: cover;">
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn" style="padding: 0.5rem 1.5rem;" onclick="selectChatUser(${u.id}, '${u.name.replace(/'/g, "\\'")}', '${u.profile_photo || ''}'); navigate('chat');"><i class="fas fa-paper-plane"></i> Message</button>
                </div>
            </div>
            
            <h1 style="color: var(--text-main); margin-bottom: 0.2rem;">${u.name}</h1>
            <p style="color: var(--text-muted); font-size: 1rem; margin-bottom: 0.5rem;">${u.branch} • ${u.year}</p>
            <p style="color: var(--text-main); margin-bottom: 1.5rem;">${u.bio || 'This user likes to keep things mysterious.'}</p>
            
            <div style="display: flex; gap: 2rem; border-top: 1px solid var(--border); padding-top: 1.5rem;">
                <div>
                    <strong style="font-size: 1.4rem; color: var(--text-main);">${u.trust_score}</strong>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Trust Score</p>
                </div>
                <div>
                    <strong style="font-size: 1.4rem; color: var(--text-main);">${u.events_created}</strong>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Events Created</p>
                </div>
                <div>
                    <strong style="font-size: 1.4rem; color: var(--text-main);">${u.posts_count}</strong>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Posts</p>
                </div>
            </div>
        </div>

        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
            <div class="card" style="flex: 1; min-width: 300px;">
                <h3 class="mb-1">Skills</h3>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${u.skills && u.skills.length > 0 ? u.skills.map(s => `<span class="badge" style="background: rgba(124, 58, 237, 0.1); color: var(--primary);">${s}</span>`).join('') : '<span class="text-muted">No skills listed.</span>'}
                </div>
            </div>
            <div class="card" style="flex: 1; min-width: 300px;">
                <h3 class="mb-1">Interests</h3>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${u.interests && u.interests.length > 0 ? u.interests.map(i => `<span class="badge" style="background: rgba(37, 99, 235, 0.1); color: var(--secondary);">${i}</span>`).join('') : '<span class="text-muted">No interests listed.</span>'}
                </div>
            </div>
        </div>
    </div>
    `;
}

function toggleEventModal() {
    const modal = document.getElementById('event-modal');
    const backdrop = document.getElementById('modal-backdrop');
    if (modal.style.display === 'none') {
        modal.style.display = 'block';
        backdrop.style.display = 'block';
    } else {
        modal.style.display = 'none';
        backdrop.style.display = 'none';
    }
}

async function handleCreateEvent(e) {
    e.preventDefault();
    const body = {
        title: document.getElementById('event-title').value,
        date: document.getElementById('event-date').value,
        description: document.getElementById('event-desc').value,
        tags: document.getElementById('event-tags').value
    };
    try {
        await apiCall('/create_event', 'POST', body);
        showToast('Event created!');
        toggleEventModal();
        fetchEvents();
    } catch (e) { console.error(e); }
}

async function fetchEvents() {
    try {
        const data = await apiCall('/events');
        const container = document.getElementById('events-container');
        if (data.events.length === 0) {
            container.innerHTML = `<p class="text-muted">No events taking place right now.</p>`;
            return;
        }
        container.innerHTML = data.events.map(ev => `
            <div class="card">
                <div style="display:flex; justify-content:space-between;">
                    <h3>${ev.title}</h3>
                    <span style="font-size:0.8rem; color:var(--text-muted)"><i class="far fa-calendar-alt"></i> ${ev.date}</span>
                </div>
                <p class="mb-1 mt-1" style="font-size:0.9rem;">${ev.description}</p>
                <p style="font-size:0.8rem; color:var(--primary)">Organized by: ${ev.creator_name || 'System'}</p>
                <div class="mt-1 mb-1">
                    ${ev.tags ? ev.tags.split(',').map(t => `<span class="badge">${t.trim()}</span>`).join('') : ''}
                </div>
                <button class="btn btn-outline" style="width:100%" onclick="joinEvent(${ev.id})">Join Event (${ev.participants} joined)</button>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function joinEvent(id) {
    try {
        await apiCall('/join_event', 'POST', { event_id: id });
        showToast('Successfully joined the event!');
        fetchEvents();
    } catch (e) { console.error(e); }
}

let rawChatList = [];

async function fetchRecentChats() {
    try {
        const data = await apiCall('/recent_chats');
        rawChatList = data.recent_chats || [];
        renderChatList(rawChatList);
    } catch (e) { console.error(e); }
}

function renderChatList(list) {
    const container = document.getElementById('chat-users-list');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = '<p class="text-center text-muted mt-2">No active conversations.</p>';
        return;
    }

    container.innerHTML = list.map(c => `
        <div style="padding: 1rem; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; gap: 1rem; align-items: center; transition: background 0.2s;" 
             onclick="selectChatUser(${c.other_user_id}, '${c.other_user_name.replace(/'/g, "\\'")}', '${c.other_user_photo || ''}')" class="hover-bg">
            <div style="position: relative;">
                <img src="${c.other_user_photo ? 'http://127.0.0.1:5000' + c.other_user_photo : 'https://via.placeholder.com/40'}" class="avatar-small">
                ${c.is_unread ? '<span class="badge-dot" style="width:12px; height:12px; border: 2px solid white; right: 0;"></span>' : ''}
            </div>
            <div style="flex: 1; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <strong style="color: var(--text-main); font-size: 0.95rem;">${c.other_user_name}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${c.timestamp.split(' ')[1].substring(0, 5)}</span>
                </div>
                <p style="margin: 0; font-size: 0.85rem; color: ${c.is_unread ? 'var(--text-main)' : 'var(--text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: ${c.is_unread ? '600' : 'normal'};">
                    ${c.latest_message}
                </p>
            </div>
        </div>
    `).join('');
}

function filterChats(e) {
    const term = e.target.value.toLowerCase();
    const filtered = rawChatList.filter(c => c.other_user_name.toLowerCase().includes(term) || c.latest_message.toLowerCase().includes(term));
    renderChatList(filtered);
}

function selectChatUser(id, name, photoUrl) {
    selectedChatUser = { id, name };

    // Update Header
    document.getElementById('chat-header').innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
            <img src="${photoUrl ? 'http://127.0.0.1:5000' + photoUrl : 'https://via.placeholder.com/40'}" class="avatar-small">
            <h3 style="margin: 0; color: var(--text-main);">${name}</h3>
        </div>
    `;

    document.getElementById('chat-form-container').style.display = 'block';
    fetchChatHistory();
}

let typingTimeout;
function handleTyping() {
    // In a real app with WebSockets, this emits a 'typing' event.
    // We are simulating it as requested.
}

async function fetchChatHistory() {
    if (!selectedChatUser) return;
    try {
        const data = await apiCall(`/chat/${selectedChatUser.id}`);
        const win = document.getElementById('chat-window');

        if (data.messages.length === 0) {
            win.innerHTML = '<p class="text-muted text-center mt-2">No messages yet. Say hi!</p>';
            return;
        }

        win.innerHTML = data.messages.map(m => {
            const isMe = m.sender_id === currentUser.id;
            return `
            <div style="display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'}; gap: 0.2rem;">
                <div style="background: ${isMe ? 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' : 'rgba(124, 58, 237, 0.05)'}; 
                            color: ${isMe ? 'white' : 'var(--text-main)'}; 
                            padding: 0.8rem 1.2rem; 
                            border-radius: ${isMe ? '16px 16px 0 16px' : '16px 16px 16px 0'}; 
                            max-width: 75%; 
                            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                            border: ${isMe ? 'none' : '1px solid var(--border)'};">
                    <p style="margin:0; font-size: 0.95rem;">${m.content}</p>
                </div>
                <span style="font-size:0.7rem; color:var(--text-muted); padding: 0 0.5rem;">${m.timestamp}</span>
            </div>
            `;
        }).join('');

        // Auto-scroll Down
        win.scrollTop = win.scrollHeight;

        // Mock typing indicator randomly after a message is fetched if we aren't the last sender
        const lastMsg = data.messages[data.messages.length - 1];
        if (lastMsg.sender_id !== currentUser.id) {
            simulateTypingReply();
        }

    } catch (e) { console.error(e); }
}

function simulateTypingReply() {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        const ind = document.getElementById('typing-indicator');
        if (ind) {
            ind.classList.remove('hidden');
            setTimeout(() => {
                if (ind) ind.classList.add('hidden');
            }, 3000);
        }
    }, 2000);
}

async function handleSendMessage(e) {
    e.preventDefault();
    if (!selectedChatUser) return;
    const input = document.getElementById('chat-input');
    const content = input.value;
    if (!content.trim()) return;

    // Optimistic UI append
    const win = document.getElementById('chat-window');
    win.innerHTML += `
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.2rem;">
            <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); 
                        color: white; padding: 0.8rem 1.2rem; border-radius: 16px 16px 0 16px; max-width: 75%; opacity: 0.7;">
                <p style="margin:0; font-size: 0.95rem;">${content}</p>
            </div>
            <span style="font-size:0.7rem; color:var(--text-muted); padding: 0 0.5rem;">Sending...</span>
        </div>
    `;
    win.scrollTop = win.scrollHeight;
    input.value = '';

    try {
        await apiCall('/chat', 'POST', { receiver_id: selectedChatUser.id, content });
        fetchChatHistory();
        fetchRecentChats(); // refresh list to bump to top
    } catch (e) { console.error(e); }
}

async function fetchProjectsForSkillGap() {
    try {
        const data = await apiCall('/projects');
        const container = document.getElementById('projects-list');

        if (data.projects.length === 0) {
            container.innerHTML = '<p class="text-muted">No projects available.</p>';
            return;
        }

        container.innerHTML = data.projects.map(p => `
            <div style="padding: 1rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;" 
                 onclick="analyzeSkillGap(${p.id}, '${p.project_name}')" class="chat-user-item hover-bg">
                <h4 class="mb-1" style="color: var(--primary)">${p.project_name}</h4>
                <p style="font-size: 0.8rem;" class="mb-1">${p.description}</p>
                <div style="display: flex; gap: 0.2rem; flex-wrap: wrap;">
                    ${p.required_skills.map(s => `<span class="badge">${s}</span>`).join('')}
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function analyzeSkillGap(projectId, projectName) {
    try {
        const container = document.getElementById('skill-gap-results');
        container.innerHTML = `<div style="text-align: center; margin-top: 3rem;"><p>Analyzing skill vectors for ${projectName}...</p></div>`;

        const data = await apiCall('/skill_gap', 'POST', { project_id: projectId });

        const scoreColor = data.match_score >= 80 ? 'var(--secondary)' : (data.match_score >= 50 ? 'var(--warning)' : 'var(--danger)');

        container.innerHTML = `
            <h2 class="mb-1">${projectName} Analysis</h2>
            
            <div class="card mb-2" style="background: #f9fafb; border: 1px solid #e5e7eb;">
                <h3>Overall Match Score</h3>
                <div style="display: flex; align-items: center; gap: 1rem; margin-top: 1rem;">
                    <div style="flex: 1; height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden;">
                        <div style="height: 100%; width: ${data.match_score}%; background: ${scoreColor}; transition: width 1s ease-in-out;"></div>
                    </div>
                    <strong><span style="color: ${scoreColor}; font-size: 1.2rem;">${data.match_score}%</span></strong>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px;">
                    <h4 class="mb-1 text-danger">Missing Skills (${data.missing_skills.length})</h4>
                    ${data.missing_skills.length === 0 ?
                '<p class="text-secondary"><i class="fas fa-check-circle"></i> You have all required skills!</p>' :
                '<ul style="list-style-position: inside; color: var(--text-muted);">' +
                data.missing_skills.map(s => `<li class="mb-1">${s}</li>`).join('') +
                '</ul>'
            }
                </div>
                
                <div style="flex: 1; min-width: 250px;">
                    <h4 class="mb-1 text-warning">Recommended Learning Resources</h4>
                    ${data.recommended_courses.length === 0 ?
                '<p class="text-muted">No courses needed. You are ready!</p>' :
                '<div style="display: flex; flex-direction: column; gap: 0.5rem;">' +
                data.recommended_courses.map(r => `
                            <div style="padding: 0.5rem; border-left: 3px solid var(--warning); background: rgba(245, 158, 11, 0.1); font-size: 0.9rem;">
                                ${r}
                            </div>
                        `).join('') +
                '</div>'
            }
                </div>
            </div>
        `;
    } catch (e) {
        document.getElementById('skill-gap-results').innerHTML = `<p class="text-danger">Failed to run analysis.</p>`;
        console.error(e);
    }
}

// --- SOCIAL FEED LOGIC ---
async function fetchFeed() {
    try {
        const data = await apiCall('/feed', 'GET');
        const container = document.getElementById('feed-container');
        if (!container) return;

        if (data.feed.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No posts yet. Be the first to post!</div>';
            return;
        }

        container.innerHTML = data.feed.map(post => `
            <div class="card mb-2" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <img src="${post.author_photo ? 'http://127.0.0.1:5000' + post.author_photo : 'https://via.placeholder.com/40'}" class="avatar-small">
                        <div>
                            <h4 style="margin: 0; color: var(--text-main);">${post.author_name}</h4>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${formatTimeAgo(post.created_at)}</span>
                        </div>
                    </div>
                </div>
                
                <p style="margin-bottom: 1rem; white-space: pre-wrap; color: var(--text-main);">${post.content}</p>
                
                ${post.image_url ? `<img src="http://127.0.0.1:5000${post.image_url}" style="max-width: 100%; border-radius: 8px; margin-bottom: 1rem;">` : ''}
                
                <div style="display: flex; gap: 1rem; border-top: 1px solid var(--border); padding-top: 0.8rem;">
                    <button class="icon-btn ${post.user_has_liked ? 'text-danger' : 'text-muted'}" style="color: ${post.user_has_liked ? 'var(--danger)' : 'var(--text-muted)'}; display:flex; align-items:center; gap:0.4rem;" onclick="likePost(${post.id})">
                        <i class="${post.user_has_liked ? 'fas' : 'far'} fa-heart"></i> ${post.likes_count}
                    </button>
                    <button class="icon-btn text-muted" style="display:flex; align-items:center; gap:0.4rem;" onclick="document.getElementById('comment-box-${post.id}').classList.toggle('hidden')">
                        <i class="far fa-comment"></i> ${post.comments_count}
                    </button>
                </div>

                <div id="comment-box-${post.id}" class="hidden mt-1">
                    <form onsubmit="handleCommentPost(event, ${post.id})" style="display:flex; gap:0.5rem; margin-top: 1rem;">
                        <input type="text" id="comment-input-${post.id}" placeholder="Write a comment..." required style="flex:1;">
                        <button type="submit" class="btn" style="padding: 0.4rem 1rem;"><i class="fas fa-paper-plane"></i></button>
                    </form>
                    <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.8rem;">
                        ${post.comments_data.map(c => `
                            <div style="display: flex; gap: 0.8rem;">
                                <img src="${c.author_photo ? 'http://127.0.0.1:5000' + c.author_photo : 'https://via.placeholder.com/30'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                                <div style="background: rgba(124, 58, 237, 0.05); padding: 0.6rem 0.8rem; border-radius: 8px; flex: 1;">
                                    <strong style="font-size: 0.85rem; color: var(--text-main);">${c.author_name}</strong>
                                    <p style="font-size: 0.85rem; margin: 0; color: var(--text-main);">${c.content}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function handleCreatePost(e) {
    e.preventDefault();
    const content = document.getElementById('post-content').value;
    const imageInput = document.getElementById('post-image');

    if (!content && (!imageInput.files || imageInput.files.length === 0)) return;

    const formData = new FormData();
    formData.append('content', content);
    if (imageInput.files[0]) {
        formData.append('image', imageInput.files[0]);
    }

    try {
        const response = await fetch(API_URL + '/create_post', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + currentToken },
            body: formData
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        showToast('Post created!', 'success');
        fetchFeed(); // refresh
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function likePost(postId) {
    try {
        await apiCall('/like_post', 'POST', { post_id: postId });
        fetchFeed(); // silent refresh
    } catch (e) { console.error(e); }
}

async function handleCommentPost(e, postId) {
    e.preventDefault();
    const contentInput = document.getElementById(`comment-input-${postId}`);
    const content = contentInput.value;
    if (!content) return;

    try {
        await apiCall('/comment_post', 'POST', { post_id: postId, content: content });
        contentInput.value = '';
        fetchFeed(); // refresh
    } catch (e) { console.error(e); }
}

// Utility for Time
function formatTimeAgo(dateString) {
    // Basic formatting for time
    const date = new Date(dateString);
    const now = new Date();
    // Assuming backend returns UTC, calculate difference
    const diff = Math.floor((now - date) / 1000) - (now.getTimezoneOffset() * 60);

    const seconds = Math.max(0, diff);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m";
    return Math.floor(seconds) + "s";
}


// --- ATTENDANCE LOGIC ---
async function fetchAttendanceSummary() {
    try {
        const data = await apiCall(`/attendance_summary/${currentUser.id}`);
        const tbody = document.getElementById('attendance-tbody');

        if (data.attendance.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No subjects found.</td></tr>';
            return;
        }

        // Build the table rows with default Safe/Risk coloring based on Can Bunk math
        tbody.innerHTML = data.attendance.map(a => {
            let color = 'var(--secondary)'; // Safe
            if (a.status === 'Risk') color = 'var(--warning)';
            if (a.status === 'Low Attendance') color = 'var(--danger)';

            return `
            <tr style="border-bottom: 1px solid var(--border);" id="subj-row-${a.subject_id}">
                <td style="padding: 1rem 0;"><strong>${a.subject}</strong></td>
                <td>
                    <span style="font-size: 1.1rem; font-weight: bold; color: ${color}">${a.attendance_percentage}%</span>
                </td>
                <td class="text-muted" style="font-size: 0.9rem;">
                    ${a.classes_attended} / ${a.total_classes}<br>
                    <span style="font-size: 0.8rem;">Allowed Skips: ${a.can_bunk_more < 0 ? 0 : a.can_bunk_more}</span>
                </td>
                <td>
                    <span class="badge" style="background: transparent; border: 1px solid ${color}; color: ${color}">${a.status}</span>
                </td>
                <td id="ai-alert-${a.subject_id}" style="font-size: 0.85rem;" class="text-muted">
                    <em>Click "Predict" above</em>
                </td>
                <td>
                    <div style="display:flex; gap: 0.5rem;">
                        <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; border-color: var(--secondary); color: var(--secondary);" onclick="markAttendance(${a.subject_id}, true)"><i class="fas fa-check"></i></button>
                        <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; border-color: var(--danger); color: var(--danger);" onclick="markAttendance(${a.subject_id}, false)"><i class="fas fa-times"></i></button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        showToast("Error loading attendance", "error");
    }
}

async function markAttendance(subjectId, attendedState) {
    try {
        await apiCall('/mark_attendance', 'POST', { subject_id: subjectId, attended: attendedState });
        fetchAttendanceSummary(); // re-fetch to live update math
    } catch (e) {
        console.error(e);
    }
}

async function predictAttendanceRisk() {
    try {
        showToast('Running AI ML Prediction Model...', 'success');
        const data = await apiCall(`/predict_attendance_risk/${currentUser.id}`);

        // Loop over the AI predictions and inject them into the table
        data.predictions.forEach(p => {
            const alertCell = document.getElementById(`ai-alert-${p.subject_id}`);
            if (!alertCell) return;

            let badgeColor = 'var(--secondary)';
            let icon = 'fa-check';
            if (p.status === 'Medium Risk') { badgeColor = 'var(--warning)'; icon = 'fa-exclamation'; }
            if (p.status === 'HIGH RISK') { badgeColor = 'var(--danger)'; icon = 'fa-skull-crossbones'; }

            alertCell.innerHTML = `
                <strong style="color: ${badgeColor};"><i class="fas ${icon}"></i> ${p.status}</strong><br>
                <span>${p.recommendation}</span>
             `;
        });

    } catch (e) {
        console.error(e);
        // Fallback if admin has not triggered training yet
        showToast('Error: AI model may need to be trained by Admin first!', 'error');
    }
}
