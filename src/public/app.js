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
const roomModal = document.getElementById('room-modal');
const btnAddRoom = document.getElementById('btn-add-room');
const btnShowCreateRoom = document.getElementById('btn-show-create-room');
const btnShowJoinRoom = document.getElementById('btn-show-join-room');
const createRoomForm = document.getElementById('create-room-form');
const joinRoomForm = document.getElementById('join-room-form');
const createRoomError = document.getElementById('create-room-error');
const joinRoomError = document.getElementById('join-room-error');
const btnCloseRoomModal = document.getElementById('btn-close-room-modal');
const roomsList = document.getElementById('rooms-list');

// State
let socket = null;
let currentUser = null;
let selectedUserId = null; // null means 'public' or custom room
let selectedCustomRoomId = null;
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

// Room Modal Toggle
if (btnAddRoom) {
    btnAddRoom.addEventListener('click', () => {
        roomModal.classList.remove('hidden');
    });
}
btnCloseRoomModal.addEventListener('click', () => {
    roomModal.classList.add('hidden');
});
btnShowCreateRoom.addEventListener('click', () => {
    btnShowCreateRoom.classList.add('active');
    btnShowJoinRoom.classList.remove('active');
    createRoomForm.style.display = 'block';
    joinRoomForm.style.display = 'none';
});
btnShowJoinRoom.addEventListener('click', () => {
    btnShowJoinRoom.classList.add('active');
    btnShowCreateRoom.classList.remove('active');
    joinRoomForm.style.display = 'block';
    createRoomForm.style.display = 'none';
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
        socket.emit('getCustomRooms', renderCustomRooms);
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
        const isCurrentCustom = selectedCustomRoomId && message.room === `custom_${selectedCustomRoomId}`;
        
        if ((!selectedUserId && !selectedCustomRoomId && isPublicMsg) || 
            (selectedUserId && isCurrentPrivate) ||
            (selectedCustomRoomId && isCurrentCustom)) {
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
    
    const starredUsers = filteredUsers.filter(u => u.isStarred);
    const onlineUsers = filteredUsers.filter(u => !u.isStarred && onlineUsersIds.includes(u._id));
    const offlineUsers = filteredUsers.filter(u => !u.isStarred && !onlineUsersIds.includes(u._id));

    const createSection = (title, users, icon) => {
        if (users.length === 0) return;
        const divider = document.createElement('li');
        divider.className = 'list-divider';
        divider.innerHTML = `<span>${icon} ${title}</span>`;
        usersList.appendChild(divider);
        
        users.sort((a,b) => a.username.localeCompare(b.username)).forEach(user => {
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
    };

    createSection('Starred Contacts', starredUsers, '⭐');
    createSection('Online Users', onlineUsers, '🟢');
    createSection('Offline Users', offlineUsers, '⚫');
}

let customRooms = [];

function renderCustomRooms(rooms) {
    customRooms = rooms;
    roomsList.innerHTML = `
        <li class="room-item ${(!selectedUserId && !selectedCustomRoomId) ? 'active' : ''}" id="room-public" onclick="selectConversation(null, 'Global Chat', this)">
            <div class="room-avatar"><i class="fas fa-globe"></i></div>
            <div class="room-info"><span class="room-name">Global Chat</span></div>
        </li>
    `;
    
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.className = 'room-item custom-room';
        if (selectedCustomRoomId === room._id) li.classList.add('active');
        
        li.innerHTML = `
            <div class="room-avatar"><i class="fas fa-users"></i></div>
            <div class="room-info"><span class="room-name">${escapeHTML(room.name)}</span></div>
        `;
        li.onclick = () => selectConversation(null, room.name, li, true, room._id);
        roomsList.appendChild(li);
    });
}

createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    createRoomError.innerText = '';
    const name = document.getElementById('create-room-name').value.trim();
    const pin = document.getElementById('create-room-pin').value.trim();
    if(socket) {
        socket.emit('createRoom', { name, pin }, (res) => {
            if(res.success) {
                roomModal.classList.add('hidden');
                createRoomForm.reset();
                if(socket) socket.emit('getCustomRooms', renderCustomRooms);
                selectConversation(null, res.room.name, null, true, res.room._id);
            } else {
                createRoomError.innerText = res.message;
            }
        });
    }
});

joinRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    joinRoomError.innerText = '';
    const name = document.getElementById('join-room-name').value.trim();
    const pin = document.getElementById('join-room-pin').value.trim();
    if(socket) {
        socket.emit('joinRoomWithPin', { name, pin }, (res) => {
            if(res.success) {
                roomModal.classList.add('hidden');
                joinRoomForm.reset();
                if(socket) socket.emit('getCustomRooms', renderCustomRooms);
                selectConversation(null, res.room.name, null, true, res.room._id);
            } else {
                joinRoomError.innerText = res.message;
            }
        });
    }
});

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
window.selectConversation = (userId, displayName, element, isCustomRoom = false, roomId = null) => {
    // UI Update active list item
    document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
    if(element) element.classList.add('active');
    else {
        // Try to find it if we just created/joined
        if (isCustomRoom) {
            setTimeout(() => {
                const items = document.querySelectorAll('.custom-room');
                items.forEach(i => { if(i.innerText.includes(displayName)) i.classList.add('active'); });
            }, 100);
        }
    }
    
    chatTitle.innerText = displayName;
    selectedUserId = userId;
    selectedCustomRoomId = isCustomRoom ? roomId : null;
    
    if (userId) {
        socket.emit('joinPrivateRoom', userId);
    } else if (isCustomRoom) {
        socket.emit('joinCustomRoomSocket', roomId);
    }
    
    // Clear chat and load history
    messagesContainer.innerHTML = '<div class="welcome-message"><p>Loading...</p></div>';
    loadHistory(userId, selectedCustomRoomId);
}

function loadHistory(userId, customRoomId = null) {
    socket.emit('getHistory', { targetUserId: userId, customRoomId }, (messages) => {
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
        customRoomId: selectedCustomRoomId,
        message: content
    });

    messageInput.value = '';
    socket.emit('typing', { isTyping: false, targetUserId: selectedUserId, customRoomId: selectedCustomRoomId });
});

// Typing Indicator Emission
messageInput.addEventListener('input', () => {
    if (!socket) return;
    
    socket.emit('typing', { isTyping: true, targetUserId: selectedUserId, customRoomId: selectedCustomRoomId });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { isTyping: false, targetUserId: selectedUserId, customRoomId: selectedCustomRoomId });
    }, 2000);
});

// Helper: Escape HTML
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
