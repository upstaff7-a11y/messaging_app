// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    
    // Get supabase client
    const supabase = window.supabaseClient;
    
    // DOM Elements
    const signupForm = document.getElementById('signupForm');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const signupBtn = document.getElementById('signupBtn');
    const googleBtn = document.getElementById('googleSignup');
    const appleBtn = document.getElementById('appleSignup');
    
    // Toast function
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toast) return;
        
        toastMessage.textContent = message;
        toast.className = `toast-notification ${type}`;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
    
    // Check if already logged in
    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            window.location.href = 'dashboard.html';
        }
    }
    
    // Signup
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = fullNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        if (!email || !password) {
            showToast('Please fill in email and password', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        
        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }
        
        signupBtn.disabled = true;
        signupBtn.textContent = 'Creating...';
        
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { full_name: fullName || email.split('@')[0] }
            }
        });
        
        signupBtn.disabled = false;
        signupBtn.textContent = 'Sign Up';
        
        if (error) {
            showToast(error.message, 'error');
            return;
        }
        
        showToast('Account created! Redirecting to login...', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    });
    
    // Google signup
    googleBtn.addEventListener('click', async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/index.html' }
        });
    });
    
    // Apple signup
    appleBtn.addEventListener('click', () => {
        showToast('Apple signup coming soon', 'error');
    });
    
    checkSession();
    
});