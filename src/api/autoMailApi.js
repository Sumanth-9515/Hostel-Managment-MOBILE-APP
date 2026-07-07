import api from './client';

export const autoMailApi = {
  getConfig: () => api.get('/auto-mail/config').then(r => r.data),
  saveConfig: payload => api.post('/auto-mail/config', payload).then(r => r.data),
  runNow: () => api.post('/auto-mail/run-now').then(r => r.data),
};
