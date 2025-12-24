// Withdraw Page JavaScript with GitHub API
document.addEventListener('DOMContentLoaded', async function() {
    await loadWithdrawPage();
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

// Check withdrawal eligibility
function checkEligibility(user) {
    const minBalance = 1550;
    const minVerifiedFriends = 10;
    
    const isBalanceEligible = user.balance >= minBalance;
    const isFriendsEligible = user.verifiedFriends >= minVerifiedFriends;
    const isEligible = isBalanceEligible && isFriendsEligible;
    
    return {
        isEligible,
        isBalanceEligible,
        isFriendsEligible,
        minBalance,
        minVerifiedFriends,
        currentBalance: user.balance,
        currentVerifiedFriends: user.verifiedFriends
    };
}

// Update eligibility display
function updateEligibilityDisplay(eligibility) {
    const eligibilityList = document.getElementById('eligibility-list');
    
    let html = '';
    
    // Balance check
    html += `
        <div class="eligibility-item ${eligibility.isBalanceEligible ? 'eligible' : 'not-eligible'}">
            <i class="fas ${eligibility.isBalanceEligible ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            <div>
                <strong>Balance:</strong> Rs. ${eligibility.currentBalance} / ${eligibility.minBalance}+
                ${!eligibility.isBalanceEligible ? 
                    ` <span style="color: var(--error);">(Need Rs. ${eligibility.minBalance - eligibility.currentBalance} more)</span>` : 
                    ' ✅'}
            </div>
        </div>
    `;
    
    // Friends check
    html += `
        <div class="eligibility-item ${eligibility.isFriendsEligible ? 'eligible' : 'not-eligible'}">
            <i class="fas ${eligibility.isFriendsEligible ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            <div>
                <strong>Verified Friends:</strong> ${eligibility.currentVerifiedFriends} / ${eligibility.minVerifiedFriends}+
                ${!eligibility.isFriendsEligible ? 
                    ` <span style="color: var(--error);">(Need ${eligibility.minVerifiedFriends - eligibility.currentVerifiedFriends} more)</span>` : 
                    ' ✅'}
            </div>
        </div>
    `;
    
    // Overall eligibility
    html += `
        <div class="eligibility-item ${eligibility.isEligible ? 'eligible' : 'not-eligible'}" 
             style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
            <i class="fas ${eligibility.isEligible ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            <div>
                <strong>Overall Status:</strong> 
                <span style="color: ${eligibility.isEligible ? 'var(--success)' : 'var(--error)'}; font-weight: 700;">
                    ${eligibility.isEligible ? 'ELIGIBLE FOR WITHDRAWAL' : 'NOT ELIGIBLE'}
                </span>
            </div>
        </div>
    `;
    
    eligibilityList.innerHTML = html;
}

// Load withdraw page data
async function loadWithdrawPage() {
    const user = await checkAuth();
    if (!user) return;
    
    // Update user info
    document.getElementById('current-user-id').textContent = `User ID: ${user.userId}`;
    document.getElementById('balance-amount').textContent = user.balance.toLocaleString();
    
    // Update max amount
    const maxAmountInput = document.getElementById('withdraw-amount');
    const maxAmountSpan = document.getElementById('max-amount');
    maxAmountInput.max = user.balance;
    maxAmountSpan.textContent = user.balance.toLocaleString();
    
    // Set default amount (minimum or balance if less than minimum)
    const defaultAmount = Math.min(user.balance, 1550);
    maxAmountInput.value = defaultAmount;
    
    // Check eligibility
    const eligibility = checkEligibility(user);
    updateEligibilityDisplay(eligibility);
    
    // Disable form if not eligible
    const form = document.getElementById('withdraw-form');
    const submitBtn = document.getElementById('submit-btn');
    
    if (!eligibility.isEligible) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-ban"></i> Not Eligible';
        submitBtn.style.opacity = '0.6';
        submitBtn.style.cursor = 'not-allowed';
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Withdrawal Request';
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
    }
    
    // Load withdrawal history
    try {
        const userData = await githubAPI.getUserFile(user.userId);
        if (userData) {
            const withdrawals = userData.withdrawals || [];
            
            // Display withdrawals list
            displayWithdrawalsList(withdrawals);
        } else {
            document.getElementById('withdrawals-list').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>No withdrawal history</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load withdrawals:', error);
        document.getElementById('withdrawals-list').innerHTML = `
            <div class="error" style="color: var(--error); text-align: center;">
                Failed to load withdrawal history. Please try refreshing.
            </div>
        `;
    }
}

// Display withdrawals list
function displayWithdrawalsList(withdrawals) {
    const withdrawalsList = document.getElementById('withdrawals-list');
    
    if (!withdrawals || withdrawals.length === 0) {
        withdrawalsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>No withdrawal history</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Submit your first withdrawal above!</p>
            </div>
        `;
        return;
    }
    
    // Sort withdrawals by date (newest first)
    const sortedWithdrawals = [...withdrawals].sort((a, b) => 
        new Date(b.requestedAt || b.date || 0) - new Date(a.requestedAt || a.date || 0)
    );
    
    let html = '';
    
    sortedWithdrawals.forEach(withdrawal => {
        const status = withdrawal.status || 'pending';
        const statusClass = `withdrawal-${status}`;
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);
        
        const date = withdrawal.requestedAt ? new Date(withdrawal.requestedAt) : new Date();
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="withdrawal-item ${statusClass}">
                <div class="withdrawal-header">
                    <div class="withdrawal-amount">Rs. ${withdrawal.amount || 0}</div>
                    <div class="withdrawal-status status-${status}">${statusText}</div>
                </div>
                <div class="withdrawal-details">
                    <div><strong>Method:</strong> ${withdrawal.method || 'N/A'}</div>
                    <div><strong>Account:</strong> ${withdrawal.accountTitle || 'N/A'}</div>
                </div>
                <div class="withdrawal-date">
                    Requested: ${dateStr}
                    ${withdrawal.processedAt ? ` | Processed: ${new Date(withdrawal.processedAt).toLocaleDateString()}` : ''}
                </div>
                ${withdrawal.notes ? `<div style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 5px; font-size: 0.9rem;">${withdrawal.notes}</div>` : ''}
            </div>
        `;
    });
    
    withdrawalsList.innerHTML = html;
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

// Handle withdrawal form submission
document.getElementById('withdraw-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    const originalBtnText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    submitBtn.disabled = true;
    
    const method = document.getElementById('withdraw-method').value;
    const accountNumber = document.getElementById('account-number').value.trim();
    const accountTitle = document.getElementById('account-title').value.trim();
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    
    // Basic validation
    if (!method || !accountNumber || !accountTitle || !amount) {
        showMessage('withdraw-message', 'Please fill in all required fields!', 'error');
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
    }
    
    if (amount < 1550) {
        showMessage('withdraw-message', 'Minimum withdrawal amount is Rs. 1550!', 'error');
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
    
    // Check eligibility again
    const eligibility = checkEligibility(user);
    if (!eligibility.isEligible) {
        showMessage('withdraw-message', 'You are not eligible for withdrawal. Check requirements above.', 'error');
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
    }
    
    if (amount > user.balance) {
        showMessage('withdraw-message', 'Withdrawal amount exceeds your balance!', 'error');
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        return;
    }
    
    try {
        // Create withdrawal object
        const newWithdrawal = {
            id: Date.now().toString(),
            userId: user.userId,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            amount: amount,
            method: method,
            accountNumber: accountNumber,
            accountTitle: accountTitle,
            status: 'pending',
            requestedAt: new Date().toISOString(),
            estimatedCompletion: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            notes: 'Withdrawal request submitted. Will be processed within 72 hours.'
        };
        
        // Get all users
        const users = await githubAPI.getAllUsers();
        
        // Find current user index
        const userIndex = users.findIndex(u => u.userId === user.userId);
        if (userIndex === -1) {
            showMessage('withdraw-message', 'User not found! Please login again.', 'error');
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            return;
        }
        
        // NOTE: We DON'T deduct balance yet - wait for admin approval
        // users[userIndex].balance -= amount;
        
        // Save updated users
        await githubAPI.saveAllUsers(users, `Withdrawal request by ${user.username}`);
        
        // Update session storage
        sessionStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
        
        // Update user's data file
        const userData = await githubAPI.getUserFile(user.userId);
        if (userData) {
            userData.withdrawals = userData.withdrawals || [];
            userData.withdrawals.push(newWithdrawal);
            
            // Add activity log
            userData.activities = userData.activities || [];
            userData.activities.push({
                type: 'withdrawal_requested',
                date: new Date().toISOString(),
                message: `Withdrawal request: Rs. ${amount} via ${method}`,
                withdrawalId: newWithdrawal.id
            });
            
            await githubAPI.createUserFile(user.userId, userData);
        }
        
        // Add to all withdrawals list for admin
        const allWithdrawals = await githubAPI.getAllWithdrawals();
        allWithdrawals.push(newWithdrawal);
        await githubAPI.saveAllWithdrawals(allWithdrawals, `New withdrawal request by ${user.username}`);
        
        // Show success message
        showMessage('withdraw-message', `✅ Withdrawal request submitted! Rs. ${amount} will be sent to your ${method} account within 72 hours.`, 'success');
        
        // Reset form
        document.getElementById('withdraw-form').reset();
        
        // Reload page data
        setTimeout(() => {
            loadWithdrawPage();
        }, 1000);
        
    } catch (error) {
        console.error('Failed to submit withdrawal:', error);
        showMessage('withdraw-message', '❌ Failed to submit withdrawal. Please try again.', 'error');
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

// Auto-update amount field when user types
document.getElementById('withdraw-amount').addEventListener('input', function() {
    const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    if (!user.userId) return;
    
    const amount = parseInt(this.value) || 0;
    const maxAmount = user.balance || 0;
    
    if (amount > maxAmount) {
        this.value = maxAmount;
    }
    
    if (amount < 1550 && amount > 0) {
        this.value = 1550;
    }
});
