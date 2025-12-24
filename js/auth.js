// Authentication JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
});

// Initialize application
async function initializeApp() {
    try {
        // Check if user is already logged in
        const currentUser = sessionStorage.getItem('currentUser');
        if (currentUser) {
            const user = JSON.parse(currentUser);
            if (user.isAdmin) {
                window.location.href = 'admin-dashboard.html';
            } else {
                window.location.href = 'dashboard.html';
            }
            return;
        }
        
        // Check GitHub access
        const hasAccess = await githubAPI.checkAccess();
        if (!hasAccess) {
            showMessage('login-message', '⚠️ GitHub connection failed. Please check configuration.', 'error');
            return;
        }
        
        // Initialize repository structure
        await githubAPI.initializeRepo();
        
        // Check if admin user exists, if not create one
        await ensureAdminUserExists();
        
    } catch (error) {
        console.error('Initialization failed:', error);
        showMessage('login-message', '⚠️ Failed to initialize application. Please check GitHub configuration.', 'error');
    }
}

// Ensure admin user exists
async function ensureAdminUserExists() {
    try {
        const users = await githubAPI.getAllUsers();
        
        // Check if admin user exists
        const adminUser = users.find(u => u.userId === '00000000');
        
        if (!adminUser) {
            // Create admin user
            const adminUserData = {
                id: '00000000',
                userId: '00000000',
                username: 'admin',
                password: 'admin123',
                fullName: 'Administrator',
                email: 'admin@example.com',
                whatsapp: '03001234567',
                balance: 0,
                level: 10,
                totalFriends: 0,
                verifiedFriends: 0,
                pendingFriends: 0,
                declinedFriends: 0,
                isAdmin: true,
                joined: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            };
            
            users.push(adminUserData);
            await githubAPI.saveAllUsers(users, 'Created admin user');
            
            // Create admin user file
            const adminUserFile = {
                user: adminUserData,
                friends: [],
                withdrawals: [],
                activities: [{
                    type: 'account_created',
                    date: new Date().toISOString(),
                    message: 'Admin account created'
                }]
            };
            
            await githubAPI.createUserFile('00000000', adminUserFile);
            
            console.log('Admin user created successfully');
        }
    } catch (error) {
        console.error('Failed to ensure admin user exists:', error);
    }
}

// Show message
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `message ${type}`;
        element.classList.remove('hidden');
        
        setTimeout(() => {
            element.classList.add('hidden');
        }, 5000);
    }
}

// Switch between login and signup tabs
document.getElementById('login-tab').addEventListener('click', function() {
    document.getElementById('login-tab').classList.add('active');
    document.getElementById('signup-tab').classList.remove('active');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');
});

document.getElementById('signup-tab').addEventListener('click', function() {
    document.getElementById('signup-tab').classList.add('active');
    document.getElementById('login-tab').classList.remove('active');
    document.getElementById('signup-form').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
});

// Handle signup
document.getElementById('signup-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('full-name').value.trim();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const whatsapp = document.getElementById('whatsapp').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    
    // Validation
    if (password !== confirmPassword) {
        showMessage('signup-message', 'Passwords do not match!', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('signup-message', 'Password must be at least 6 characters!', 'error');
        return;
    }
    
    if (username.length < 3) {
        showMessage('signup-message', 'Username must be at least 3 characters!', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showMessage('signup-message', 'Please enter a valid email address!', 'error');
        return;
    }
    
    if (!whatsapp || whatsapp.length < 10) {
        showMessage('signup-message', 'Please enter a valid WhatsApp number!', 'error');
        return;
    }
    
    try {
        // Get existing users
        const users = await githubAPI.getAllUsers();
        
        // Check if username already exists
        if (users.find(u => u.username === username)) {
            showMessage('signup-message', 'Username already exists!', 'error');
            return;
        }
        
        // Check if email already exists
        if (users.find(u => u.email === email)) {
            showMessage('signup-message', 'Email already registered!', 'error');
            return;
        }
        
        // Create new user
        const userId = generateUserId();
        const newUser = {
            id: userId,
            userId: userId,
            username: username,
            password: password,
            fullName: fullName,
            email: email,
            whatsapp: whatsapp,
            balance: 0,
            level: 1,
            totalFriends: 0,
            verifiedFriends: 0,
            pendingFriends: 0,
            declinedFriends: 0,
            isAdmin: false,
            joined: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        
        // Add to users array
        users.push(newUser);
        await githubAPI.saveAllUsers(users, `New user signup: ${username}`);
        
        // Create user file
        const userData = {
            user: newUser,
            friends: [],
            withdrawals: [],
            activities: [{
                type: 'account_created',
                date: new Date().toISOString(),
                message: 'Account created successfully'
            }]
        };
        
        await githubAPI.createUserFile(userId, userData);
        
        showMessage('signup-message', `🎉 Account created successfully! Your User ID: ${userId}`, 'success');
        
        // Clear form
        document.getElementById('signup-form').reset();
        
        // Switch to login tab after 3 seconds
        setTimeout(() => {
            document.getElementById('login-tab').click();
            document.getElementById('login-identifier').value = username;
        }, 3000);
        
    } catch (error) {
        console.error('Signup error:', error);
        showMessage('signup-message', 'Failed to create account. Please try again.', 'error');
    }
});

// Handle login
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const identifier = document.getElementById('login-identifier').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    
    try {
        // Get all users
        const users = await githubAPI.getAllUsers();
        
        // Find user by username, email, or userId
        const user = users.find(u => 
            u.username === identifier || 
            u.email === identifier || 
            u.userId === identifier
        );
        
        if (!user) {
            showMessage('login-message', 'User not found!', 'error');
            return;
        }
        
        if (user.password !== password) {
            showMessage('login-message', 'Incorrect password!', 'error');
            return;
        }
        
        // Update last login
        user.lastLogin = new Date().toISOString();
        const userIndex = users.findIndex(u => u.userId === user.userId);
        if (userIndex !== -1) {
            users[userIndex] = user;
            await githubAPI.saveAllUsers(users, `User login: ${user.username}`);
        }
        
        // Update user's data file
        const userData = await githubAPI.getUserFile(user.userId);
        if (userData) {
            userData.user = user;
            userData.activities = userData.activities || [];
            userData.activities.push({
                type: 'login',
                date: new Date().toISOString(),
                message: 'User logged in'
            });
            
            await githubAPI.createUserFile(user.userId, userData);
        }
        
        // Login successful - store user in session
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        
        // Show success message
        showMessage('login-message', '✅ Login successful! Redirecting...', 'success');
        
        // Redirect to dashboard after 1 second
        setTimeout(() => {
            if (user.isAdmin) {
                window.location.href = 'admin-dashboard.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }, 1000);
        
    } catch (error) {
        console.error('Login error:', error);
        showMessage('login-message', 'Login failed. Please try again.', 'error');
    }
});

// Add email field to signup form dynamically
document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        // Insert email field after full name
        const emailField = `
            <div class="form-group">
                <label for="email">Email Address *</label>
                <div class="input-with-icon">
                    <i class="fas fa-envelope"></i>
                    <input type="email" id="email" placeholder="Enter your email address" required>
                </div>
                <small>We'll use this email for verification and communication</small>
            </div>
        `;
        
        const fullNameField = signupForm.querySelector('#full-name').closest('.form-group');
        fullNameField.insertAdjacentHTML('afterend', emailField);
    }
});
