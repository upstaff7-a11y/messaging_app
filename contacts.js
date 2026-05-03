// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    
    const supabase = window.supabaseClient;
    
    // DOM Elements
    const contactsDirectory = document.getElementById('contactsDirectory');
    const searchInput = document.getElementById('searchInput');
    const newContactBtn = document.getElementById('newContactBtn');
    const createGroupBtn = document.getElementById('createGroupBtn');
    const avatarBtn = document.getElementById('avatarBtn');
    const logoutNavBtn = document.getElementById('logoutNavBtn');
    const logoutSidebarBtn = document.getElementById('logoutSidebarBtn');
    
    let currentUser = null;
    let allContacts = [];
    
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
    
    // Check authentication
    async function checkAuth() {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Session error:', error);
        }
        
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = session.user;
        console.log('Logged in as:', currentUser.email);
        
        // Load contacts from Supabase
        await loadContacts();
    }
    
    // LOAD CONTACTS FROM SUPABASE
    async function loadContacts() {
        if (!contactsDirectory) return;
        
        contactsDirectory.innerHTML = '<div class="loading-state">Loading contacts...</div>';
        
        try {
            // Get all users except current user
            const { data: users, error } = await supabase
                .from('profiles')
                .select('*')
                .neq('id', currentUser.id)
                .order('full_name', { ascending: true });
            
            if (error) {
                console.error('Error loading contacts:', error);
                contactsDirectory.innerHTML = '<div class="empty-state">Error loading contacts</div>';
                return;
            }
            
            if (!users || users.length === 0) {
                contactsDirectory.innerHTML = `
                    <div class="empty-state">
                        <p>No contacts found</p>
                        <button id="inviteBtn" style="margin-top:12px; padding:8px 16px; background:#0050cb; color:white; border:none; border-radius:24px; cursor:pointer;">Invite friends</button>
                    </div>
                `;
                const inviteBtn = document.getElementById('inviteBtn');
                if (inviteBtn) {
                    inviteBtn.addEventListener('click', () => {
                        showToast('Invite feature coming soon!', 'error');
                    });
                }
                return;
            }
            
            allContacts = users;
            
            // Group users by first letter of name
            const grouped = {};
            users.forEach(user => {
                const displayName = user.full_name || user.email.split('@')[0];
                const firstLetter = displayName.charAt(0).toUpperCase();
                if (!grouped[firstLetter]) {
                    grouped[firstLetter] = [];
                }
                grouped[firstLetter].push({
                    id: user.id,
                    name: displayName,
                    email: user.email,
                    avatar_url: user.avatar_url,
                    initial: firstLetter
                });
            });
            
            renderContacts(grouped);
            
        } catch (error) {
            console.error('Error:', error);
            contactsDirectory.innerHTML = '<div class="empty-state">Error loading contacts</div>';
        }
    }
    
    // RENDER CONTACTS GROUPED BY LETTER
    function renderContacts(grouped) {
        if (!contactsDirectory) return;
        
        const sections = Object.keys(grouped).sort();
        
        if (sections.length === 0) {
            contactsDirectory.innerHTML = '<div class="empty-state">No contacts found</div>';
            return;
        }
        
        const html = sections.map(letter => `
            <section class="contact-section">
                <div class="section-header">
                    <h2 class="section-title">${escapeHtml(letter)}</h2>
                </div>
                <div class="contacts-grid">
                    ${grouped[letter].map(contact => `
                        <div class="contact-card" data-id="${contact.id}" data-name="${escapeHtml(contact.name)}" data-email="${escapeHtml(contact.email)}">
                            <div class="contact-avatar">
                                <div class="avatar-img">
                                    ${contact.avatar_url ? `<img src="${contact.avatar_url}" alt="${contact.name}">` : `<span>${escapeHtml(contact.initial)}</span>`}
                                </div>
                            </div>
                            <div class="contact-info">
                                <p class="contact-name">${escapeHtml(contact.name)}</p>
                                <p class="contact-role">${escapeHtml(contact.email)}</p>
                            </div>
                            <button class="chat-btn" data-id="${contact.id}" data-name="${escapeHtml(contact.name)}">
                                <span class="material-symbols-outlined">chat</span>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </section>
        `).join('');
        
        contactsDirectory.innerHTML = html;
        
        // Add click handlers for chat buttons
        document.querySelectorAll('.chat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = btn.dataset.id;
                const userName = btn.dataset.name;
                startConversation(userId, userName);
            });
        });
        
        // Add click handlers for contact cards (whole card)
        document.querySelectorAll('.contact-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.chat-btn')) {
                    const userId = card.dataset.id;
                    const userName = card.dataset.name;
                    startConversation(userId, userName);
                }
            });
        });
    }
    
    // START CONVERSATION WITH USER - ITO ANG MAGRE-REDIRECT SA CHAT
    async function startConversation(otherUserId, userName) {
        showToast('Creating conversation...', 'success');
        
        try {
            // Check if conversation already exists
            const { data: existing, error: checkError } = await supabase
                .from('conversations')
                .select('id')
                .contains('participants', [currentUser.id, otherUserId]);
            
            if (checkError) {
                console.error('Check error:', checkError);
            }
            
            if (existing && existing.length > 0) {
                // Conversation exists, redirect to chat
                window.location.href = `chat.html?conversationId=${existing[0].id}&userId=${otherUserId}&name=${encodeURIComponent(userName)}`;
                return;
            }
            
            // Create new conversation
            const { data: newConv, error: createError } = await supabase
                .from('conversations')
                .insert({
                    participants: [currentUser.id, otherUserId],
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .select()
                .single();
            
            if (createError) {
                console.error('Create error:', createError);
                showToast('Error creating conversation: ' + createError.message, 'error');
            } else {
                showToast('Conversation created!', 'success');
                window.location.href = `chat.html?conversationId=${newConv.id}&userId=${otherUserId}&name=${encodeURIComponent(userName)}`;
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Something went wrong', 'error');
        }
    }
    
    // SEARCH CONTACTS
    function searchContacts(searchTerm) {
        if (!contactsDirectory) return;
        
        if (!searchTerm.trim()) {
            // Regroup and render all contacts
            const grouped = {};
            allContacts.forEach(user => {
                const displayName = user.full_name || user.email.split('@')[0];
                const firstLetter = displayName.charAt(0).toUpperCase();
                if (!grouped[firstLetter]) {
                    grouped[firstLetter] = [];
                }
                grouped[firstLetter].push({
                    id: user.id,
                    name: displayName,
                    email: user.email,
                    avatar_url: user.avatar_url,
                    initial: firstLetter
                });
            });
            renderContacts(grouped);
            return;
        }
        
        const filtered = allContacts.filter(contact => {
            const displayName = contact.full_name || contact.email.split('@')[0];
            return displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   contact.email.toLowerCase().includes(searchTerm.toLowerCase());
        });
        
        if (filtered.length === 0) {
            contactsDirectory.innerHTML = '<div class="empty-state">No contacts found matching your search</div>';
            return;
        }
        
        // Group filtered results
        const grouped = {};
        filtered.forEach(user => {
            const displayName = user.full_name || user.email.split('@')[0];
            const firstLetter = displayName.charAt(0).toUpperCase();
            if (!grouped[firstLetter]) {
                grouped[firstLetter] = [];
            }
            grouped[firstLetter].push({
                id: user.id,
                name: displayName,
                email: user.email,
                avatar_url: user.avatar_url,
                initial: firstLetter
            });
        });
        
        renderContacts(grouped);
    }
    
    // NEW CONTACT (Invite)
    function newContact() {
        const email = prompt('Enter email address of the person you want to add:');
        if (email && email.includes('@')) {
            showToast(`Invitation sent to ${email}`, 'success');
            // Future: Add invite logic here
        } else if (email) {
            showToast('Please enter a valid email address', 'error');
        }
    }
    
    // CREATE GROUP
    function createGroup() {
        showToast('Group creation coming soon!', 'error');
    }
    
    // LOGOUT
    async function logout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                showToast(error.message, 'error');
            } else {
                showToast('Logged out successfully!', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            }
        } catch (err) {
            showToast('Something went wrong', 'error');
        }
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Event Listeners
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchContacts(e.target.value);
        });
    }
    
    if (newContactBtn) {
        newContactBtn.addEventListener('click', newContact);
    }
    
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', createGroup);
    }
    
    if (avatarBtn) {
        avatarBtn.addEventListener('click', logout);
    }
    
    if (logoutNavBtn) {
        logoutNavBtn.addEventListener('click', logout);
    }
    
    if (logoutSidebarBtn) {
        logoutSidebarBtn.addEventListener('click', logout);
    }
    
    // Run auth check
    checkAuth();
    
});