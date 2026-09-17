// ============================================================================
// AXIOS API CLIENT
// Version: v2026.09.17.01
// 2026-09-17 (Anh chốt): Client tập trung gọi REST API kèm cache-busting version header
// ============================================================================

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'X-App-Version': 'v2026.09.17.02',
  },
});

// 2026-09-17 (Anh chốt): Tự động đính kèm JWT token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Xử lý khi token hết hạn (401)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default api;
