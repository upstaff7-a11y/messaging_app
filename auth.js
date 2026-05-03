// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    
    // Get supabase client
    const supabase = window.supabaseClient;
    
    // DOM Elements
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const forgotLink = document.getElementById('forgotPassword');
    const googleBtn = document.getElementById('googleLogin');
    const appleBtn = document.getElementById('appleLogin');
    
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
            window.location.href = 'inbox.html';
        }
    }
    
    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            showToast(error.message, 'error');
            return;
        }
        
        showToast('Login successful!', 'success');
        setTimeout(() => {
            window.location.href = 'inbox.html';
        }, 1000);
    });
    
    // Forgot password
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        const email = prompt('Enter your email address:');
        if (email) {
            supabase.auth.resetPasswordForEmail(email);
            showToast('Reset link sent!', 'success');
        }
    });
    
    // Google login
    googleBtn.addEventListener('click', async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/inbox.html' }
        });
    });
    
    // Apple login
    appleBtn.addEventListener('click', () => {
        showToast('Apple login coming soon', 'error');
    });
    
    // Run session check
    checkSession();
    
});