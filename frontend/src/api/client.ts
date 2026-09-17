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
    'X-App-Version': 'v2026.09.17.01',
  },
});

export default api;
