import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/',
  headers: { 'Content-Type': 'application/json' }
});

// Interceptor to attach token if present
API.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('ct_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export async function syncUpload(entries) {
  return API.post('/api/entries/sync', { entries });
}
export async function syncDownload() {
  return API.get('/api/entries/sync');
}
export async function sendMagicLink(email) {
  return API.post('/api/auth/magic-link', { email });
}
export async function googleAuth(code) {
  return API.post('/api/auth/google', { code });
}
export async function registerEmailReminder(email) {
  return API.post('/api/register-email', { email });
}
export default API;
