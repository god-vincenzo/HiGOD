// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const appContainer = document.getElementById('app-container');
const btnShowLogin = document.getElementById('btn-show-login');
const btnShowRegister = document.getElementById('btn-show-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const currentUsernameEl = document.getElementById('current-username');
const btnLogout = document.getElementById('btn-logout');
const usersList = document.getElementById('users-list');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const searchInput = document.getElementById('search-users');
const chatTitle = document.getElementById('chat-title');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');

// State
let socket = null;
let currentUser = null;
let selectedUserId = null; // null means 'public'
let allUsers = [];
let onlineUsersIds = [];
let typingTimeout = null;
let searchQuery = '';

searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderUsers();
});

// Auth Forms Toggle
btnShowLogin.addEventListener('click', () => {
    btnShowLogin.classList.add('active');
    btnShowRegister.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
});

btnShowRegister.addEventListener('click', () => {
    btnShowRegister.classList.add('active');
    btnShowLogin.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
});

// Check if already logged in
const storedToken = localStorage.getItem('token');
const storedUsername = localStorage.getItem('username');
const storedUserId = localStorage.getItem('userId');

if (storedToken && storedUsername && storedUserId) {
    currentUser = { username: storedUsername, id: storedUserId, token: storedToken };
    showChatApp();
}

// API Call Wrapper
async function apiCall(endpoint, method, body) {
    try {
        const response = await fetch(`/api/auth${endpoint}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error occurred');
        return data;
    } catch (err) {
        throw err;
    }
}

// Login Submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.innerText = '';
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    try {
        const data = await apiCall('/login', 'POST', { username, password });
        handleAuthSuccess(data);
    } catch (err) { loginError.innerText = err.message; }
});

// Register Submit
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.innerText = '';
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    
    try {
        const data = await apiCall('/register', 'POST', { username, password });
        handleAuthSuccess(data);
    } catch (err) { registerError.innerText = err.message; }
});

// Logout
btnLogout.addEventListener('click', () => {
    localStorage.clear();
    if (socket) socket.disconnect();
    location.reload();
});

function handleAuthSuccess(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    localStorage.setItem('userId', data._id);
    currentUser = { username: data.username, id: data._id, token: data.token };
    showChatApp();
}

function showChatApp() {
    authOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    currentUsernameEl.innerText = currentUser.username;
    initSocket();
}

// Socket Initialization
function initSocket() {
    socket = io({
        auth: { token: currentUser.token }
    });

    socket.on('connect', () => {
        console.log('Connected to socket server');
        socket.emit('getUsers', (users) => {
            allUsers = users.filter(u => u._id !== currentUser.id);
            renderUsers();
        });
        // Initial history load for public
        loadHistory(null);
    });

    socket.on('connect_error', (err) => {
        if (err.message === 'Authentication error') {
            localStorage.clear();
            location.reload();
        }
    });

    socket.on('onlineUsers', (userIds) => {
        onlineUsersIds = userIds;
        // Refresh full user list whenever presence changes to capture new registrations
        socket.emit('getUsers', (users) => {
            allUsers = users.filter(u => u._id !== currentUser.id);
            renderUsers();
        });
    });

    socket.on('newMessage', (message) => {
        // Only append if it's for the currently open window
        const isPublicMsg = message.room === 'public';
        const isCurrentPrivate = selectedUserId && message.room.includes(currentUser.id) && message.room.includes(selectedUserId);
        
        if ((!selectedUserId && isPublicMsg) || (selectedUserId && isCurrentPrivate)) {
            appendMessage(message);
        } else {
            // Future UI enhancement: Add badge unread count to user in sidebar
        }
    });

    socket.on('userTyping', (data) => {
        const { username, isTyping } = data;
        if (isTyping) {
            typingText.innerText = `${username} is typing`;
            typingIndicator.classList.remove('hidden');
        } else {
            typingIndicator.classList.add('hidden');
        }
    });
}

// Render Users List
function renderUsers() {
    usersList.innerHTML = '';
    
    let filteredUsers = allUsers.filter(u => u.username.toLowerCase().includes(searchQuery));
    
    filteredUsers.sort((a, b) => {
        const aOnline = onlineUsersIds.includes(a._id) ? 1 : 0;
        const bOnline = onlineUsersIds.includes(b._id) ? 1 : 0;
        const aStar = a.isStarred ? 1 : 0;
        const bStar = b.isStarred ? 1 : 0;
        
        let scoreA = aStar * 100 + aOnline * 10;
        let scoreB = bStar * 100 + bOnline * 10;
        
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.username.localeCompare(b.username);
    });

    filteredUsers.forEach(user => {
        const isOnline = onlineUsersIds.includes(user._id);
        const li = document.createElement('li');
        li.className = 'room-item';
        if (selectedUserId === user._id) li.classList.add('active');
        
        li.innerHTML = `
            <div class="user-avatar">
                ${user.username.charAt(0)}
                <span class="status-dot ${isOnline ? 'online' : ''}"></span>
            </div>
            <div class="room-info"><span class="room-name">${user.username}</span></div>
            <div class="user-item-star" onclick="toggleStar('${user._id}', event)">
                <i class="${user.isStarred ? 'fas' : 'far'} fa-star ${user.isStarred ? 'text-warning' : ''}"></i>
            </div>
        `;
        li.onclick = () => selectConversation(user._id, user.username, li);
        usersList.appendChild(li);
    });
}

window.toggleStar = async (userId, e) => {
    e.stopPropagation();
    const user = allUsers.find(u => u._id === userId);
    if (!user) return;
    
    const isCurrentlyStarred = user.isStarred;
    user.isStarred = !isCurrentlyStarred;
    renderUsers();
    
    try {
        const response = await fetch(`/api/users/star/${userId}`, {
            method: isCurrentlyStarred ? 'DELETE' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            }
        });
        const data = await response.json();
        if (!response.ok) throw new Error('Failed to update star');
        user.isStarred = data.starredUsers.includes(userId);
    } catch (err) {
        console.error(err);
        user.isStarred = isCurrentlyStarred;
    }
    renderUsers();
};

// Select Conversation
window.selectConversation = (userId, displayName, element) => {
    // UI Update active list item
    document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    
    chatTitle.innerText = displayName;
    selectedUserId = userId;
    
    if (userId) {
        socket.emit('joinPrivateRoom', userId);
    }
    
    // Clear chat and load history
    messagesContainer.innerHTML = '<div class="welcome-message"><p>Loading...</p></div>';
    loadHistory(userId);
}

function loadHistory(userId) {
    socket.emit('getHistory', { targetUserId: userId }, (messages) => {
        messagesContainer.innerHTML = '';
        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <p>No messages yet. Say hello!</p>
                </div>
            `;
        } else {
            messages.forEach(msg => appendMessage(msg));
        }
    });
}

// Append Message to UI
function appendMessage(msg) {
    const isSelf = msg.sender._id === currentUser.id;
    const time = new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Remove welcome msg if exists
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    const div = document.createElement('div');
    div.className = `message ${isSelf ? 'self' : 'other'}`;
    div.innerHTML = `
        <div class="msg-header">
            <span class="username">${isSelf ? 'You' : msg.sender.username}</span>
            <span class="time">${time}</span>
        </div>
        <div class="msg-content">${escapeHTML(msg.content)}</div>
    `;
    
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send Message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    socket.emit('sendMessage', {
        targetUserId: selectedUserId,
        message: content
    });

    messageInput.value = '';
    socket.emit('typing', { isTyping: false, targetUserId: selectedUserId });
});

// Typing Indicator Emission
messageInput.addEventListener('input', () => {
    if (!socket) return;
    
    socket.emit('typing', { isTyping: true, targetUserId: selectedUserId });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { isTyping: false, targetUserId: selectedUserId });
    }, 2000);
});

// Helper: Escape HTML
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
