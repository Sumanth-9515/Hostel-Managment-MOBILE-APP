import api from './client';

export const authApi = {
  login: payload => api.post('/login', payload).then(r => r.data),
  register: payload => api.post('/register', payload).then(r => r.data),
  requestExtension: payload => api.post('/request-extension', payload).then(r => r.data),
  profile: () => api.get('/profile').then(r => r.data),
  updateProfile: payload => api.patch('/profile', payload).then(r => r.data),
};
