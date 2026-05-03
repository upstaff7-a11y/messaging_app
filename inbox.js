// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    
    const supabase = window.supabaseClient;
    
    // DOM Elements
    const conversationsList = document.getElementById('conversationsList');
    const searchInput = document.getElementById('searchInput');
    const editBtn = document.getElementById('editBtn');
    const cameraBtn = document.getElementById('cameraBtn');
    const avatarBtn = document.getElementById('avatarBtn');
    const logoutNavBtn = document.getElementById('logoutNavBtn');
    const logoutSidebarBtn = document.getElementById('logoutSidebarBtn');
    
    let currentUser = null;
    let allConversations = [];
    let conversationSubscription = null;
    let messagesSubscription = null;
    
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
        
        // CHECK IF CAME BACK FROM CHAT PAGE
        const shouldReload = sessionStorage.getItem('reloadInbox');
        if (shouldReload === 'true') {
            sessionStorage.removeItem('reloadInbox');
            console.log('Reloading inbox to update unread counts...');
        }
        
        // Update online status
        await updateOnlineStatus(true);
        
        // Load conversations (currentUser is now set)
        await loadConversations();
        
        // Subscribe to realtime updates
        subscribeToConversations();
        subscribeToNewMessages();
    }
    
    // UPDATE ONLINE STATUS
    async function updateOnlineStatus(status) {
        if (!currentUser) return;
        
        try {
            await supabase
                .from('profiles')
                .update({ online_status: status, last_seen: new Date() })
                .eq('id', currentUser.id);
        } catch (error) {
            console.error('Error updating online status:', error);
        }
    }
    
    // REAL-TIME SUBSCRIPTION FOR CONVERSATIONS
    function subscribeToConversations() {
        if (conversationSubscription) {
            conversationSubscription.unsubscribe();
        }
        
        conversationSubscription = supabase
            .channel('conversations-updates')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'conversations'
            }, (payload) => {
                console.log('Conversation updated:', payload.new.id);
                if (currentUser && payload.new.participants && payload.new.participants.includes(currentUser.id)) {
                    loadConversations();
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'conversations'
            }, (payload) => {
                console.log('New conversation created:', payload.new.id);
                if (currentUser && payload.new.participants && payload.new.participants.includes(currentUser.id)) {
                    loadConversations();
                }
            })
            .subscribe();
    }
    
    // SUBSCRIBE TO NEW MESSAGES FOR UNREAD COUNT
    function subscribeToNewMessages() {
        if (messagesSubscription) {
            messagesSubscription.unsubscribe();
        }
        
        messagesSubscription = supabase
            .channel('new-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, (payload) => {
                const newMessage = payload.new;
                console.log('New message inserted:', newMessage);
                
                if (currentUser && newMessage.sender_id !== currentUser.id) {
                    loadConversations();
                    if (!document.hasFocus()) {
                        showToast('New message received!', 'success');
                    }
                }
            })
            .subscribe();
    }
    
    // GET UNREAD COUNT FOR A CONVERSATION
    async function getUnreadCount(conversationId) {
        if (!currentUser) return 0;
        
        try {
            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conversationId)
                .eq('is_read', false)
                .neq('sender_id', currentUser.id);
            
            if (error) {
                console.error('Error counting unread:', error);
                return 0;
            }
            
            return count || 0;
        } catch (error) {
            console.error('Error in getUnreadCount:', error);
            return 0;
        }
    }
    
    // LOAD CONVERSATIONS WITH UNREAD COUNTS
    async function loadConversations() {
        if (!conversationsList) return;
        if (!currentUser) {
            console.log('No currentUser yet, skipping loadConversations');
            return;
        }
        
        conversationsList.innerHTML = '<div class="loading-state">Loading conversations...</div>';
        
        try {
            const { data: conversations, error: convError } = await supabase
                .from('conversations')
                .select('*')
                .contains('participants', [currentUser.id])
                .order('updated_at', { ascending: false });
            
            if (convError) {
                console.error('Error:', convError);
                conversationsList.innerHTML = '<div class="empty-state">Error loading conversations</div>';
                return;
            }
            
            if (!conversations || conversations.length === 0) {
                conversationsList.innerHTML = `
                    <div class="empty-state">
                        <p>No conversations yet</p>
                        <button id="newChatBtn">Start a new chat</button>
                    </div>
                `;
                const newChatBtn = document.getElementById('newChatBtn');
                if (newChatBtn) {
                    newChatBtn.addEventListener('click', createNewConversation);
                }
                return;
            }
            
            allConversations = [];
            
            for (const conv of conversations) {
                const otherUserId = conv.participants.find(id => id !== currentUser.id);
                
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', otherUserId)
                    .single();
                
                const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'User';
                const firstLetter = displayName.charAt(0).toUpperCase();
                
                // GET UNREAD COUNT FOR THIS CONVERSATION
                const unreadCount = await getUnreadCount(conv.id);
                const hasUnread = unreadCount > 0;
                const lastMessage = conv.last_message || 'No messages yet';
                
                allConversations.push({
                    id: conv.id,
                    name: displayName,
                    userId: otherUserId,
                    initial: firstLetter,
                    lastMessage: lastMessage,
                    lastMessageTime: conv.last_message_time,
                    updatedAt: conv.updated_at,
                    unreadCount: unreadCount,
                    hasUnread: hasUnread
                });
            }
            
            renderConversations(allConversations);
            
        } catch (error) {
            console.error('Error:', error);
            conversationsList.innerHTML = '<div class="empty-state">Error loading conversations</div>';
        }
    }
    
    // RENDER CONVERSATIONS WITH UNREAD INDICATOR
    function renderConversations(conversations) {
        if (!conversationsList) return;
        
        if (conversations.length === 0) {
            conversationsList.innerHTML = `
                <div class="empty-state">
                    <p>No conversations found</p>
                </div>
            `;
            return;
        }
        
        const html = conversations.map(conv => `
            <div class="conversation-item ${conv.hasUnread ? 'has-unread' : ''}" data-id="${conv.id}" data-user="${conv.userId}" data-name="${escapeHtml(conv.name)}">
                <div class="conversation-avatar">
                    <div class="avatar-img">
                        <span>${escapeHtml(conv.initial)}</span>
                    </div>
                    ${conv.hasUnread ? '<div class="unread-dot"></div>' : ''}
                </div>
                <div class="conversation-info">
                    <div class="conversation-header">
                        <span class="conversation-name ${conv.hasUnread ? 'unread-name' : ''}">${escapeHtml(conv.name)}</span>
                        <span class="conversation-time">${formatTime(conv.lastMessageTime)}</span>
                    </div>
                    <div class="conversation-preview ${conv.hasUnread ? 'unread-preview' : ''}">
                        ${escapeHtml(conv.lastMessage)}
                    </div>
                    ${conv.unreadCount > 0 ? `<div class="unread-badge">${conv.unreadCount > 99 ? '99+' : conv.unreadCount}</div>` : ''}
                </div>
            </div>
        `).join('');
        
        conversationsList.innerHTML = html;
        
        // Add click handlers
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const conversationId = item.dataset.id;
                const otherUserId = item.dataset.user;
                const contactName = item.dataset.name;
                openChat(conversationId, otherUserId, contactName);
            });
        });
    }
    
    // OPEN CHAT - with flag para mag-reload pagbalik
    function openChat(conversationId, otherUserId, contactName) {
        console.log('Opening conversation:', conversationId);
        sessionStorage.setItem('reloadInbox', 'true');
        window.location.href = `chat.html?conversationId=${conversationId}&userId=${otherUserId}&name=${encodeURIComponent(contactName)}`;
    }
    
    // CREATE NEW CONVERSATION
    async function createNewConversation() {
        if (!currentUser) return;
        
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .neq('id', currentUser.id);
        
        if (error || !users || users.length === 0) {
            showToast('No other users found', 'error');
            return;
        }
        
        const userList = users.map((u, i) => `${i + 1}. ${u.full_name || u.email}`).join('\n');
        const choice = prompt(`Select a user to chat with:\n${userList}\n\nEnter number:`);
        
        if (choice) {
            const selectedUser = users[parseInt(choice) - 1];
            if (selectedUser) {
                // Check if conversation already exists
                const { data: existing } = await supabase
                    .from('conversations')
                    .select('id')
                    .contains('participants', [currentUser.id, selectedUser.id]);
                
                if (existing && existing.length > 0) {
                    showToast('Conversation already exists', 'error');
                    openChat(existing[0].id, selectedUser.id, selectedUser.full_name || selectedUser.email);
                    return;
                }
                
                // Create new conversation
                const { data: newConv, error: createError } = await supabase
                    .from('conversations')
                    .insert({
                        participants: [currentUser.id, selectedUser.id],
                        created_at: new Date(),
                        updated_at: new Date()
                    })
                    .select()
                    .single();
                
                if (createError) {
                    showToast('Error creating conversation', 'error');
                } else {
                    showToast('Conversation created!', 'success');
                    await loadConversations();
                    openChat(newConv.id, selectedUser.id, selectedUser.full_name || selectedUser.email);
                }
            }
        }
    }
    
    // SEARCH CONVERSATIONS
    function searchConversations(searchTerm) {
        if (!searchTerm.trim()) {
            renderConversations(allConversations);
            return;
        }
        
        const filtered = allConversations.filter(conv => 
            conv.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        renderConversations(filtered);
    }
    
    // Format time
    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (date >= today) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }
    
    // Escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // LOGOUT
    async function logout() {
        try {
            if (currentUser) {
                await supabase
                    .from('profiles')
                    .update({ online_status: false, last_seen: new Date() })
                    .eq('id', currentUser.id);
            }
            
            if (conversationSubscription) {
                conversationSubscription.unsubscribe();
            }
            if (messagesSubscription) {
                messagesSubscription.unsubscribe();
            }
            
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
            console.error('Logout error:', err);
            showToast('Something went wrong', 'error');
        }
    }
    
    // Set offline on page unload
    window.addEventListener('beforeunload', () => {
        if (currentUser) {
            supabase
                .from('profiles')
                .update({ online_status: false, last_seen: new Date() })
                .eq('id', currentUser.id);
        }
    });
    
    // Force reload when coming back from chat page
    window.addEventListener('pageshow', (event) => {
        if (event.persisted || sessionStorage.getItem('reloadInbox') === 'true') {
            sessionStorage.removeItem('reloadInbox');
            console.log('Force reloading inbox from pageshow');
            if (currentUser) {
                loadConversations();
            }
        }
    });
    
    // Event Listeners
    if (searchInput) {
        searchInput.addEventListener('input', (e) => searchConversations(e.target.value));
    }
    
    if (editBtn) {
        editBtn.addEventListener('click', createNewConversation);
    }
    
    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => showToast('Camera coming soon!', 'error'));
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
    
    // Start
    checkAuth();
    
});