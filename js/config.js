// GitHub Configuration
// These should be set as environment variables in Vercel
const GITHUB_CONFIG = {
    // Replace with your GitHub repository in format: username/repo-name
    REPO: process.env.GITHUB_REPO || 'username/repo-name',
    
    // Replace with your GitHub Personal Access Token
    TOKEN: process.env.GITHUB_TOKEN || 'your-github-token-here',
    
    // Replace with your GitHub username
    OWNER: process.env.GITHUB_OWNER || 'your-username',
    
    // Email domains for friend validation (you can add more)
    ALLOWED_EMAIL_DOMAINS: [
        'gmail.com',
        'yahoo.com',
        'hotmail.com',
        'outlook.com',
        'icloud.com',
        'aol.com',
        'protonmail.com',
        'zoho.com',
        'yandex.com',
        'mail.com'
    ]
};

// Base URL for GitHub API
const GITHUB_API = 'https://api.github.com';

// Generate 8-digit user ID
function generateUserId() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    
    // Check if domain is in allowed list
    const domain = email.split('@')[1].toLowerCase();
    return GITHUB_CONFIG.ALLOWED_EMAIL_DOMAINS.includes(domain);
}

// Get domain from email
function getEmailDomain(email) {
    return email.split('@')[1].toLowerCase();
}
