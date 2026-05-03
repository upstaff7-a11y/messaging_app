// Supabase Configuration
const SUPABASE_URL = 'https://qudvnybevodelyiagiqc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1ZHZueWJldm9kZWx5aWFnaXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3OTk1MjIsImV4cCI6MjA5MzM3NTUyMn0.yfErB0aAX83u-Kp1PYc6A8gDVsore3FW6thIMyeAies';

// Create Supabase client
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase ready');