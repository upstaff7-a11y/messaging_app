// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
    
    const supabase = window.supabaseClient;
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversationId');
    const otherUserId = urlParams.get('userId');
    const contactName = urlParams.get('name');
    
    // DOM Elements
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachBtn = document.getElementById('attachBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    const contactNameEl = document.getElementById('contactName');
    const contactStatusEl = document.getElementById('contactStatus');
    const logoutNavBtn = document.getElementById('logoutNavBtn');
    const logoutSidebarBtn = document.getElementById('logoutSidebarBtn');
    const avatarBtn = document.getElementById('avatarBtn');
    const backBtn = document.querySelector('.back-btn');
    const avatarInitial = document.getElementById('avatarInitial');
    const onlineDot = document.getElementById('onlineDot');
    
    let currentUser = null;
    let messagesSubscription = null;
    
    // Set avatar initial from contact name
    function setAvatarInitial(name) {
        if (avatarInitial && name) {
            const firstLetter = name.charAt(0).toUpperCase();
            avatarInitial.textContent = firstLetter;
        }
    }
    
    // Set contact name and avatar
    if (contactNameEl && contactName) {
        contactNameEl.textContent = decodeURIComponent(contactName);
        setAvatarInitial(decodeURIComponent(contactName));
    }
    
    // UPDATE ONLINE STATUS DISPLAY
    function updateOnlineStatusDisplay(isOnline) {
        const statusEl = document.getElementById('contactStatus');
        const onlineDotEl = document.getElementById('onlineDot');
        
        if (!statusEl) return;
        
        if (isOnline) {
            statusEl.textContent = 'Online';
            statusEl.style.color = '#10b981';
            if (onlineDotEl) onlineDotEl.style.background = '#10b981';
        } else {
            statusEl.textContent = 'Offline';
            statusEl.style.color = '#727687';
            if (onlineDotEl) onlineDotEl.style.background = '#727687';
        }
    }
    
    // GET CONTACT ONLINE STATUS
    async function getContactStatus() {
        if (!otherUserId) {
            console.log('No otherUserId, skipping getContactStatus');
            return;
        }
        
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('online_status, last_seen')
                .eq('id', otherUserId)
                .single();
            
            if (error) {
                console.error('Error getting contact status:', error);
                return;
            }
            
            console.log('Contact status from DB:', profile);
            updateOnlineStatusDisplay(profile?.online_status === true);
            
        } catch (error) {
            console.error('Error in getContactStatus:', error);
        }
    }
    
    // REAL-TIME SUBSCRIPTION FOR CONTACT STATUS
    function subscribeToContactStatus() {
        if (!otherUserId) {
            console.log('No otherUserId, skipping status subscription');
            return;
        }
        
        console.log('Subscribing to status updates for:', otherUserId);
        
        supabase
            .channel(`profile-status-${otherUserId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${otherUserId}`
            }, (payload) => {
                console.log('Contact status changed:', payload.new);
                updateOnlineStatusDisplay(payload.new.online_status === true);
            })
            .subscribe((status) => {
                console.log('Status subscription status:', status);
            });
    }
    
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
    
    // MARK MESSAGES AS READ
    async function markMessagesAsRead() {
        if (!conversationId || !currentUser) return;
        
        try {
            const { count, error: countError } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conversationId)
                .eq('is_read', false)
                .neq('sender_id', currentUser.id);
            
            if (countError) {
                console.error('Error counting unread:', countError);
                return;
            }
            
            if (count === 0) {
                console.log('No unread messages to mark');
                return;
            }
            
            console.log(`Found ${count} unread messages to mark as read`);
            
            const { error: updateError } = await supabase
                .from('messages')
                .update({ 
                    is_read: true, 
                    read_at: new Date().toISOString() 
                })
                .eq('conversation_id', conversationId)
                .eq('is_read', false)
                .neq('sender_id', currentUser.id);
            
            if (updateError) {
                console.error('Error marking messages as read:', updateError);
                return;
            }
            
            console.log(`${count} messages marked as read successfully`);
            
            const { error: convUpdateError } = await supabase
                .from('conversations')
                .update({ 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', conversationId);
            
            if (convUpdateError) {
                console.error('Error updating conversation:', convUpdateError);
            } else {
                console.log('✅ Conversation updated - inbox will reload');
            }
            
        } catch (error) {
            console.error('Error in markMessagesAsRead:', error);
        }
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
        console.log('Conversation ID:', conversationId);
        console.log('Other User ID:', otherUserId);
        
        // Get contact status
        await getContactStatus();
        
        // Subscribe to contact status updates
        subscribeToContactStatus();
        
        // Load messages
        await loadMessages();
        
        // Mark unread messages as read
        await markMessagesAsRead();
        
        // Subscribe to new messages
        subscribeToMessages();
    }
    
    // LOAD MESSAGES
    async function loadMessages() {
        if (!messagesContainer) return;
        
        if (!conversationId) {
            messagesContainer.innerHTML = '<div class="empty-state">No conversation selected</div>';
            return;
        }
        
        messagesContainer.innerHTML = '<div class="loading-state">Loading messages...</div>';
        
        try {
            const { data: messages, error } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error('Error loading messages:', error);
                messagesContainer.innerHTML = '<div class="empty-state">Error loading messages</div>';
                return;
            }
            
            console.log('Messages found:', messages?.length || 0);
            
            if (!messages || messages.length === 0) {
                messagesContainer.innerHTML = `
                    <div class="empty-state">
                        <p>No messages yet</p>
                        <p style="font-size:14px; margin-top:8px; color: #727687;">Send a message to start the conversation!</p>
                    </div>
                `;
                return;
            }
            
            renderMessages(messages);
            
        } catch (error) {
            console.error('Error:', error);
            messagesContainer.innerHTML = '<div class="empty-state">Error loading messages</div>';
        }
    }
    
    // RENDER MESSAGES
    function renderMessages(messages) {
        if (!messagesContainer) return;
        
        messagesContainer.innerHTML = '';
        
        messages.forEach(msg => {
            const isSent = msg.sender_id === currentUser.id;
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
            
            let readReceipt = '';
            if (isSent) {
                if (msg.is_read) {
                    readReceipt = '<span class="read-status read">✓✓ Read</span>';
                } else {
                    readReceipt = '<span class="read-status delivered">✓ Delivered</span>';
                }
            }
            
            messageDiv.innerHTML = `
                <div class="message-bubble">
                    <p class="message-text">${escapeHtml(msg.message_text)}</p>
                    <div class="message-footer">
                        <span class="message-time">${time}</span>
                        ${readReceipt}
                    </div>
                </div>
            `;
            messagesContainer.appendChild(messageDiv);
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // UPDATE CONVERSATION LAST MESSAGE
    async function updateConversationLastMessage(text) {
        try {
            const { data, error } = await supabase
                .from('conversations')
                .update({
                    last_message: text,
                    last_message_time: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', conversationId)
                .select();
            
            if (error) {
                console.error('Error updating conversation:', error);
                return false;
            }
            
            console.log('Conversation updated successfully:', data);
            return true;
        } catch (error) {
            console.error('Update conversation error:', error);
            return false;
        }
    }
    
    // SEND MESSAGE
    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;
        
        if (sendBtn) sendBtn.disabled = true;
        
        try {
            const { data: newMessage, error: msgError } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: currentUser.id,
                    message_text: text,
                    created_at: new Date().toISOString(),
                    is_read: false
                })
                .select()
                .single();
            
            if (msgError) {
                console.error('Error sending message:', msgError);
                showToast('Error sending message: ' + msgError.message, 'error');
                if (sendBtn) sendBtn.disabled = false;
                return;
            }
            
            console.log('Message sent successfully:', newMessage);
            
            await updateConversationLastMessage(text);
            
            messageInput.value = '';
            
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            if (messagesContainer.innerHTML.includes('No messages yet')) {
                messagesContainer.innerHTML = '';
            }
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message sent';
            messageDiv.innerHTML = `
                <div class="message-bubble">
                    <p class="message-text">${escapeHtml(text)}</p>
                    <div class="message-footer">
                        <span class="message-time">${time}</span>
                        <span class="read-status delivered">✓ Delivered</span>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
        } catch (error) {
            console.error('Error in sendMessage:', error);
            showToast('Something went wrong', 'error');
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    }
    
    // REAL-TIME SUBSCRIPTION FOR MESSAGES
    function subscribeToMessages() {
        if (messagesSubscription) {
            messagesSubscription.unsubscribe();
        }
        
        messagesSubscription = supabase
            .channel(`messages:${conversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            }, (payload) => {
                const newMessage = payload.new;
                console.log('New message received via realtime:', newMessage);
                
                if (newMessage.sender_id === currentUser.id) return;
                
                const time = new Date(newMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                if (messagesContainer.innerHTML.includes('No messages yet')) {
                    messagesContainer.innerHTML = '';
                }
                
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message received';
                messageDiv.innerHTML = `
                    <div class="message-bubble">
                        <p class="message-text">${escapeHtml(newMessage.message_text)}</p>
                        <div class="message-footer">
                            <span class="message-time">${time}</span>
                        </div>
                    </div>
                `;
                messagesContainer.appendChild(messageDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                if (document.hasFocus()) {
                    supabase
                        .from('messages')
                        .update({ is_read: true, read_at: new Date().toISOString() })
                        .eq('id', newMessage.id)
                        .then(() => {
                            console.log('New message auto-marked as read');
                        });
                    
                    supabase
                        .from('conversations')
                        .update({ updated_at: new Date().toISOString() })
                        .eq('id', conversationId);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            }, (payload) => {
                const updatedMessage = payload.new;
                console.log('Message updated via realtime:', updatedMessage);
                
                if (updatedMessage.is_read && updatedMessage.sender_id === currentUser.id) {
                    const messageElements = messagesContainer.querySelectorAll('.message.sent');
                    for (let i = messageElements.length - 1; i >= 0; i--) {
                        const msgElement = messageElements[i];
                        const readSpan = msgElement.querySelector('.read-status');
                        if (readSpan && readSpan.classList.contains('delivered')) {
                            readSpan.className = 'read-status read';
                            readSpan.textContent = '✓✓ Read';
                            break;
                        }
                    }
                }
            })
            .subscribe();
    }
    
    // ESCAPE HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // LOGOUT
    async function logout() {
        try {
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
    
    // Event Listeners
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (attachBtn) {
        attachBtn.addEventListener('click', () => {
            showToast('File attachment coming soon!', 'error');
        });
    }
    
    if (emojiBtn) {
        emojiBtn.addEventListener('click', () => {
            showToast('Emoji picker coming soon!', 'error');
        });
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
    
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'inbox.html';
        });
    }
    
    // Check if conversationId exists
    if (!conversationId) {
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div class="empty-state">No conversation selected. Go back and select a chat.</div>';
        }
    } else {
        await checkAuth();
    }
    
});