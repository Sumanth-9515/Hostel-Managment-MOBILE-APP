import api from './client';

export const activityApi = {
  list: params => api.get('/activities', { params }).then(r => r.data),
};
