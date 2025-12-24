// Task Page JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    await loadTaskPage();
});

// Check authentication
async function checkAuth() {
    const currentUser = sessionStorage.getItem('currentUser');
    if (!currentUser) {
        window.location.href = 'index.html';
        return null;
    }
    
    try {
        const user = JSON.parse(currentUser);
        
        // Verify user exists in GitHub
        const users = await githubAPI.getAllUsers();
        const latestUser = users.find(u => u.userId === user.userId);
        
        if (!latestUser) {
            sessionStorage.removeItem('currentUser');
            window.location.href = 'index.html';
            return null;
        }
        
        // Update session storage with latest data
        sessionStorage.setItem('currentUser', JSON.stringify(latestUser));
        return latestUser;
    } catch (error) {
        console.error('Auth check failed:', error);
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
        return null;
    }
}

// Calculate current rate based on verified friends
function calculateCurrentRate(verifiedFriends) {
    if (verifiedFriends >= 100) return 150;
    if (verifiedFriends >= 51) return 130;
    if (verifiedFriends >= 31) return 110;
    if (verifiedFriends >= 21) return 100;
    return 90;
}

// Load task page data
async function loadTaskPage() {
    const user = await checkAuth();
    if (!user) return;
    
    // Update user info
    document.getElementById('current-user-id').textContent = `User ID: ${user.userId}`;
    document.getElementById('user-level-display').textContent = user.level;
    document.getElementById('verified-count').textContent = user.verifiedFriends;
    
    // Calculate and display current rate
    const currentRate = calculateCurrentRate(user.verifiedFriends);
    document.getElementById('current-rate').textContent = `Rs. ${currentRate}/friend`;
    
    // Load user's friends data
    try {
        const userData = await githubAPI.getUserFile(user.userId);
        if (userData) {
            const friends = userData.friends || [];
            
            // Calculate total earnings
            const totalEarnings = calculateTotalEarnings(friends);
            document.getElementById('total-earnings').textContent = `Rs. ${totalEarnings}`;
            
            // Display friends list
            displayFriendsList(friends);
        } else {
            document.getElementById('friends-list').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-friends"></i>
                    <p>No friends added yet</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load friends:', error);
        document.getElementById('friends-list').innerHTML = `
            <div class="error" style="color: var(--error); text-align: center;">
                Failed to load friends. Please try refreshing the page.
            </div>
        `;
    }
}

// Calculate total earnings from friends
function calculateTotalEarnings(friends) {
    return friends.reduce((total, friend) => {
        if (friend.status === 'verified') {
            const rate = calculateCurrentRate(friend.verifiedAtVerifiedCount || 0);
            return total + rate;
        }
        return total;
    }, 0);
}

// Display friends list
function displayFriendsList(friends) {
    const friendsList = document.getElementById('friends-list');
    
    if (!friends || friends.length === 0) {
        friendsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-friends"></i>
                <p>No friends added yet</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Add your first friend above!</p>
            </div>
        `;
        return;
    }
    
    // Sort friends by date (newest first)
    const sortedFriends = [...friends].sort((a, b) => 
        new Date(b.addedAt || b.date || 0) - new Date(a.addedAt || a.date || 0)
    );
    
    let html = '';
    
    sortedFriends.forEach(friend => {
        const status = friend.status || 'pending';
        const statusClass = `friend-${status}`;
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);
        
        const domain = getEmailDomain(friend.email || '');
        const date = friend.addedAt ? new Date(friend.addedAt) : new Date();
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="friend-item ${statusClass}">
                <div class="friend-header">
                    <div>
                        <div class="friend-email">${friend.email || 'Unknown Email'}</div>
                        <div class="friend-domain">${domain}</div>
                    </div>
                    <div class="friend-status status-${status}">${statusText}</div>
                </div>
                <div class="friend-date">
                    Added: ${dateStr}
                    ${friend.verifiedAt ? ` | Verified: ${new Date(friend.verifiedAt).toLocaleDateString()}` : ''}
                </div>
                ${friend.notes ? `<div style="margin-top: 5px; font-size: 0.9rem; color: var(--text-muted);">${friend.notes}</div>` : ''}
            </div>
        `;
    });
    
    friendsList.innerHTML = html;
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

// Handle add friend form submission
document.getElementById('add-friend-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    const originalBtnText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding Friend...';
    submitBtn.disabled = true;
    
    const friendEmail = document.getElementById('friend-email').value.trim().toLowerCase();
    const friendPassword = document.getElementById('friend-password').value;
    const friendWhatsapp = document.getElementById('friend-whatsapp').value.trim();
    
    // Basic validation
    if (!friendEmail || !friendPassword) {
        showMessage('friend-message', 'Please fill in all required fields!', 'error');
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
    }
    
    // Validate email
    if (!isValidEmail(friendEmail)) {
        showMessage('friend-message', 'Please enter a valid email address from supported domains!', 'error');
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
    }
    
    if (friendPassword.length < 6) {
        showMessage('friend-message', 'Password must be at least 6 characters!', 'error');
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
    }
    
    const user = await checkAuth();
    if (!user) {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
    }
    
    try {
        // Check if email already exists in friends
        const allFriends = await githubAPI.getAllFriends();
        const existingFriend = allFriends.find(f => 
            f.email === friendEmail && f.addedBy === user.userId
        );
        
        if (existingFriend) {
            showMessage('friend-message', 'You have already added this email as a friend!', 'error');
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            return;
        }
        
        // Create friend object with email
        const newFriend = {
            id: Date.now().toString(),
            email: friendEmail,
            domain: getEmailDomain(friendEmail),
            password: friendPassword,
            whatsapp: friendWhatsapp || '',
            addedBy: user.userId,
            addedByUsername: user.username,
            addedByName: user.fullName,
            status: 'pending',
            addedAt: new Date().toISOString()
        };
        
        // Get all users
        const users = await githubAPI.getAllUsers();
        
        // Find current user index
        const userIndex = users.findIndex(u => u.userId === user.userId);
        if (userIndex === -1) {
            showMessage('friend-message', 'User not found! Please login again.', 'error');
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            return;
        }
        
        // Update user stats
        users[userIndex].totalFriends = (users[userIndex].totalFriends || 0) + 1;
        users[userIndex].pendingFriends = (users[userIndex].pendingFriends || 0) + 1;
        
        // Update user level based on total friends
        const totalFriends = users[userIndex].totalFriends;
        if (totalFriends >= 100) users[userIndex].level = 5;
        else if (totalFriends >= 50) users[userIndex].level = 4;
        else if (totalFriends >= 30) users[userIndex].level = 3;
        else if (totalFriends >= 10) users[userIndex].level = 2;
        else users[userIndex].level = 1;
        
        // Save updated users
        await githubAPI.saveAllUsers(users, `User ${user.username} added a friend`);
        
        // Update session storage
        sessionStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
        
        // Update user's data file
        const userData = await githubAPI.getUserFile(user.userId);
        if (userData) {
            userData.friends = userData.friends || [];
            userData.friends.push(newFriend);
            
            // Add activity log
            userData.activities = userData.activities || [];
            userData.activities.push({
                type: 'friend_added',
                date: new Date().toISOString(),
                message: `Added friend email: ${friendEmail}`,
                friendId: newFriend.id
            });
            
            await githubAPI.createUserFile(user.userId, userData);
        }
        
        // Add to all friends list for admin
        allFriends.push(newFriend);
        await githubAPI.saveAllFriends(allFriends, `New friend added by ${user.username}`);
        
        // Show success message
        showMessage('friend-message', `✅ Friend "${friendEmail}" added successfully! It will be verified within 72 hours.`, 'success');
        
        // Reset form
        document.getElementById('add-friend-form').reset();
        
        // Reload page data
        setTimeout(() => {
            loadTaskPage();
        }, 1000);
        
    } catch (error) {
        console.error('Failed to add friend:', error);
        showMessage('friend-message', '❌ Failed to add friend. Please try again.', 'error');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
});

// Logout button
document.getElementById('logout-btn').addEventListener('click', function() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});
