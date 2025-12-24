// GitHub API Helper Class
class GitHubAPI {
    constructor() {
        this.baseURL = GITHUB_API;
        this.repo = GITHUB_CONFIG.REPO;
        this.token = GITHUB_CONFIG.TOKEN;
        this.owner = GITHUB_CONFIG.OWNER;
        this.cache = new Map();
    }
    
    // Generic request method
    async request(endpoint, method = 'GET', data = null) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        
        const options = {
            method,
            headers,
            body: data ? JSON.stringify(data) : null
        };
        
        try {
            console.log(`GitHub API: ${method} ${endpoint}`);
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`GitHub API Error ${response.status}:`, errorText);
                throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
            }
            
            if (method !== 'GET' && method !== 'HEAD') {
                const result = await response.json();
                // Invalidate cache for this endpoint
                this.cache.delete(endpoint);
                return result;
            }
            
            return await response.json();
        } catch (error) {
            console.error('GitHub API request failed:', error);
            throw error;
        }
    }
    
    // Get file content
    async getFile(path) {
        const cacheKey = `file:${path}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const endpoint = `/repos/${this.repo}/contents/${path}`;
            const file = await this.request(endpoint);
            
            if (file.content) {
                const content = JSON.parse(atob(file.content));
                this.cache.set(cacheKey, content);
                return content;
            }
            return [];
        } catch (error) {
            // If file doesn't exist, return empty array
            if (error.message.includes('404')) {
                return [];
            }
            throw error;
        }
    }
    
    // Create or update file
    async createOrUpdateFile(path, content, message) {
        let sha = null;
        
        try {
            // First try to get existing file to get SHA
            const existingFile = await this.getFile(path);
            if (existingFile && existingFile.sha) {
                sha = existingFile.sha;
            }
        } catch (error) {
            // File doesn't exist, that's okay
            console.log('File does not exist, will create new one');
        }
        
        const endpoint = `/repos/${this.repo}/contents/${path}`;
        const data = {
            message: message,
            content: btoa(JSON.stringify(content, null, 2)),
            sha: sha
        };
        
        return await this.request(endpoint, 'PUT', data);
    }
    
    // Update existing file
    async updateFile(path, content, message) {
        try {
            // Get file to get its SHA
            const endpoint = `/repos/${this.repo}/contents/${path}`;
            const existingFile = await this.request(endpoint);
            
            const data = {
                message: message,
                content: btoa(JSON.stringify(content, null, 2)),
                sha: existingFile.sha
            };
            
            return await this.request(endpoint, 'PUT', data);
        } catch (error) {
            console.error('Failed to update file:', error);
            throw error;
        }
    }
    
    // Create user-specific file
    async createUserFile(userId, userData) {
        const path = `data/users/${userId}.json`;
        const message = `User profile created for ${userId}`;
        return await this.createOrUpdateFile(path, userData, message);
    }
    
    // Get user file
    async getUserFile(userId) {
        const path = `data/users/${userId}.json`;
        return await this.getFile(path);
    }
    
    // Get all users
    async getAllUsers() {
        return await this.getFile('data/users.json');
    }
    
    // Save all users
    async saveAllUsers(users, message = 'Updated users list') {
        return await this.createOrUpdateFile('data/users.json', users, message);
    }
    
    // Get all friends
    async getAllFriends() {
        return await this.getFile('data/friends.json');
    }
    
    // Save all friends
    async saveAllFriends(friends, message = 'Updated friends list') {
        return await this.createOrUpdateFile('data/friends.json', friends, message);
    }
    
    // Get all withdrawals
    async getAllWithdrawals() {
        return await this.getFile('data/withdrawals.json');
    }
    
    // Save all withdrawals
    async saveAllWithdrawals(withdrawals, message = 'Updated withdrawals list') {
        return await this.createOrUpdateFile('data/withdrawals.json', withdrawals, message);
    }
    
    // Get all transactions
    async getAllTransactions() {
        return await this.getFile('data/transactions.json');
    }
    
    // Save all transactions
    async saveAllTransactions(transactions, message = 'Updated transactions') {
        return await this.createOrUpdateFile('data/transactions.json', transactions, message);
    }
    
    // Initialize repository structure
    async initializeRepo() {
        try {
            // Check if data directory exists
            try {
                await this.request(`/repos/${this.repo}/contents/data`);
            } catch (error) {
                // Create data directory
                const readmeContent = '# KidWallet Data Directory\n\nThis directory contains all user data and transactions.';
                await this.createOrUpdateFile('data/README.md', { content: readmeContent }, 'Initialize data directory');
            }
            
            // Initialize files if they don't exist
            const files = [
                { path: 'data/users.json', content: [], message: 'Initialize users file' },
                { path: 'data/friends.json', content: [], message: 'Initialize friends file' },
                { path: 'data/withdrawals.json', content: [], message: 'Initialize withdrawals file' },
                { path: 'data/transactions.json', content: [], message: 'Initialize transactions file' }
            ];
            
            for (const file of files) {
                try {
                    await this.getFile(file.path);
                } catch (error) {
                    await this.createOrUpdateFile(file.path, file.content, file.message);
                }
            }
            
            console.log('Repository initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize repository:', error);
            throw error;
        }
    }
    
    // Check if repository is accessible
    async checkAccess() {
        try {
            await this.request(`/repos/${this.repo}`);
            return true;
        } catch (error) {
            console.error('GitHub repository access failed:', error);
            return false;
        }
    }
}

// Create singleton instance
const githubAPI = new GitHubAPI();
