// Supabase Configuration
const SUPABASE_URL = "https://lnmrfqiozzmjbrugnpep.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxubXJmcWlvenptamJydWducGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNzg4MjAsImV4cCI6MjA2OTg1NDgyMH0.CUxbI2BWeQv-u0-IEuef7BtgfW98k23Apmj3zayth6k";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuration - UPDATE THIS URL TO YOUR MAIN WEBSITE
const MAIN_WEBSITE_URL = "https://knowledge-exchange-eight.vercel.app"; // Your main website URL

// Global variables
let userEmail = "";
let isValidSession = false;

// Toast notification system
class ToastManager {
    constructor() {
        this.container = document.getElementById("toastContainer");
        this.toasts = [];
    }

    show(type, title, message, duration = 5000) {
        const toast = this.createToast(type, title, message);
        this.container.appendChild(toast);
        this.toasts.push(toast);
        setTimeout(() => this.remove(toast), duration);
        return toast;
    }

    createToast(type, title, message) {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        const iconMap = {
            success: "✓",
            error: "✗",
            info: "ℹ",
        };
        toast.innerHTML = `
            <div class="toast-icon">${iconMap[type] || "ℹ"}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="toastManager.remove(this.parentElement)">×</button>
        `;
        return toast;
    }

    remove(toast) {
        if (toast && toast.parentElement) {
            toast.style.animation = "slideOutRight 0.3s ease forwards";
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.parentElement.removeChild(toast);
                }
                this.toasts = this.toasts.filter(t => t !== toast);
            }, 300);
        }
    }
}

const toastManager = new ToastManager();

// Initialize application
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Password Reset Page initialized");
    
    // Extract URL parameters
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const type = urlParams.get('type');
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    
    if (type === 'recovery' && accessToken) {
        await handlePasswordResetSession(accessToken, refreshToken);
    } else {
        // Check for alternative URL parameter formats
        const urlSearchParams = new URLSearchParams(window.location.search);
        const altAccessToken = urlSearchParams.get('access_token') || urlSearchParams.get('token');
        const altRefreshToken = urlSearchParams.get('refresh_token');
        const altType = urlSearchParams.get('type');
        
        if (altType === 'recovery' && altAccessToken) {
            await handlePasswordResetSession(altAccessToken, altRefreshToken);
        } else {
            showError('Invalid Reset Link', 'This password reset link is invalid or malformed. Please request a new password reset.');
        }
    }
    
    initializeEventListeners();
    initializePasswordValidation();
});

// Handle password reset session setup
async function handlePasswordResetSession(accessToken, refreshToken) {
    try {
        showLoading('Verifying reset link...');
        
        // Set the session with the tokens from URL
        const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        if (error) {
            console.error('Error setting session:', error);
            showError('Invalid Reset Link', 'This password reset link is invalid or has expired. Please request a new one.');
            return;
        }

        // Get user email from session
        userEmail = data.user.email;
        isValidSession = true;
        
        // Update UI with user email
        document.getElementById('userEmail').textContent = userEmail;
        document.getElementById('hiddenEmail').value = userEmail;
        
        // Clear URL parameters for security
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Show reset password form
        showResetPassword();
        toastManager.show('success', 'Reset Link Verified', 'You can now create your new password');
        
    } catch (error) {
        console.error('Password reset session error:', error);
        showError('Reset Failed', 'Unable to process your password reset request. Please try again.');
    } finally {
        hideLoading();
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Reset password form
    document.getElementById('resetPasswordForm')?.addEventListener('submit', handleResetPassword);
    
    // Real-time password validation
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    newPasswordInput?.addEventListener('input', validatePasswords);
    confirmPasswordInput?.addEventListener('input', validatePasswords);
}

// Initialize password validation
function initializePasswordValidation() {
    const newPasswordInput = document.getElementById('newPassword');
    
    newPasswordInput?.addEventListener('input', (e) => {
        updatePasswordStrength(e.target.value);
        updatePasswordRequirements(e.target.value);
        validatePasswords();
    });
}

// Handle password reset
async function handleResetPassword(e) {
    e.preventDefault();
    
    if (!isValidSession) {
        toastManager.show('error', 'Invalid Session', 'Your session has expired. Please request a new reset link.');
        return;
    }
    
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!newPassword || !confirmPassword) {
        toastManager.show('error', 'Missing Information', 'Please fill in both password fields');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        toastManager.show('error', 'Passwords Don\'t Match', 'Please make sure both passwords are identical');
        return;
    }
    
    if (!isPasswordStrong(newPassword)) {
        toastManager.show('error', 'Weak Password', 'Please meet all password requirements');
        return;
    }
    
    showLoading('Updating your password...');
    
    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) {
            console.error('Password update error:', error);
            toastManager.show('error', 'Update Failed', error.message);
            return;
        }
        
        // Sign out after successful password change for security
        await supabase.auth.signOut();
        
        toastManager.show('success', 'Password Updated!', 'Your password has been successfully changed');
        showSuccess();
        startCountdown();
        
    } catch (error) {
        console.error('Reset password error:', error);
        toastManager.show('error', 'Update Failed', 'Unable to update password. Please try again.');
    } finally {
        hideLoading();
    }
}

// Password validation functions
function validatePasswords() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const submitBtn = document.getElementById('submitBtn');
    const passwordMatch = document.getElementById('passwordMatch');
    
    // Check if passwords match
    if (confirmPassword) {
        if (newPassword === confirmPassword) {
            passwordMatch.innerHTML = '<i class="fas fa-check"></i> Passwords match';
            passwordMatch.className = 'password-match success';
        } else {
            passwordMatch.innerHTML = '<i class="fas fa-times"></i> Passwords don\'t match';
            passwordMatch.className = 'password-match error';
        }
    } else {
        passwordMatch.innerHTML = '';
        passwordMatch.className = 'password-match';
    }
    
    // Enable/disable submit button
    const isValid = newPassword && 
                   confirmPassword && 
                   newPassword === confirmPassword && 
                   isPasswordStrong(newPassword);
    
    submitBtn.disabled = !isValid;
    
    if (isValid) {
        submitBtn.classList.remove('disabled');
        submitBtn.classList.add('enabled');
    } else {
        submitBtn.classList.remove('enabled');
        submitBtn.classList.add('disabled');
    }
}

function updatePasswordStrength(password) {
    const strengthContainer = document.getElementById('passwordStrength');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    if (!password) {
        strengthContainer.classList.add('hidden');
        return;
    }
    
    strengthContainer.classList.remove('hidden');
    
    const strength = calculatePasswordStrength(password);
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
    const labels = ['Weak', 'Fair', 'Good', 'Strong'];
    
    strengthFill.style.width = `${(strength + 1) * 25}%`;
    strengthFill.style.backgroundColor = colors[strength];
    strengthText.textContent = labels[strength];
}

function calculatePasswordStrength(password) {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    return Math.min(score - 1, 3);
}

function updatePasswordRequirements(password) {
    const requirements = [
        { id: 'req-length', test: password.length >= 8 },
        { id: 'req-upper', test: /[A-Z]/.test(password) },
        { id: 'req-lower', test: /[a-z]/.test(password) },
        { id: 'req-number', test: /[0-9]/.test(password) },
        { id: 'req-special', test: /[^A-Za-z0-9]/.test(password) }
    ];
    
    requirements.forEach(req => {
        const element = document.getElementById(req.id);
        if (element) {
            if (req.test) {
                element.classList.add('valid');
                element.classList.remove('invalid');
                element.innerHTML = '<i class="fas fa-check"></i>';
            } else {
                element.classList.add('invalid');
                element.classList.remove('valid');
                element.innerHTML = '<i class="fas fa-times"></i>';
            }
        }
    });
}

function isPasswordStrong(password) {
    return password.length >= 8 &&
           /[a-z]/.test(password) &&
           /[A-Z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[^A-Za-z0-9]/.test(password);
}

// Page navigation functions
function showResetPassword() {
    showPage('resetPasswordPage');
}

function showSuccess() {
    showPage('successPage');
}

function showError(title, message) {
    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorMessage').textContent = message;
    showPage('errorPage');
}

function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

// Success countdown and redirect
function startCountdown() {
    let countdown = 5;
    const countdownElement = document.getElementById('countdown');
    const countdownBar = document.getElementById('countdownBar');
    
    const timer = setInterval(() => {
        countdown--;
        if (countdownElement) {
            countdownElement.textContent = countdown;
        }
        if (countdownBar) {
            countdownBar.style.width = `${((5 - countdown) / 5) * 100}%`;
        }
        
        if (countdown <= 0) {
            clearInterval(timer);
            redirectToMain();
        }
    }, 1000);
}

function redirectToMain() {
    window.location.href = MAIN_WEBSITE_URL;
}

// Utility functions
function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('.loading-text');
    if (text) {
        text.textContent = message;
    }
    overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
}
