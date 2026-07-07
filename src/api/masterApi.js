import api from './client';

export const masterApi = {
  stats: () => api.get('/master/stats').then(r => r.data),
  users: () => api.get('/master/users').then(r => r.data),
  userDetail: userId => api.get(`/master/users/${userId}`).then(r => r.data),
  loginStatus: (userId, loginStatus) => api.patch(`/master/users/${userId}/login-status`, { loginStatus }).then(r => r.data),
  bulkStatus: payload => api.patch('/master/users/bulk-status', payload).then(r => r.data),
  plans: () => api.get('/plans', { timeout: 60000 }).then(r => r.data),
  allPlans: () => api.get('/plans/all').then(r => r.data),
  createPlan: payload => api.post('/plans', payload).then(r => r.data),
  editPlan: (id, payload) => api.patch(`/plans/${id}/edit`, payload).then(r => r.data),
  togglePlan: id => api.patch(`/plans/${id}/toggle`).then(r => r.data),
  deletePlan: id => api.delete(`/plans/${id}`).then(r => r.data),
  pendingApprovals: () => api.get('/approval/pending').then(r => r.data),
  approve: id => api.patch(`/approval/${id}/approve`).then(r => r.data),
  reject: id => api.patch(`/approval/${id}/reject`).then(r => r.data),
  usersPlan: () => api.get('/approval/users-plan').then(r => r.data),
  editUserPlan: (id, payload) => api.patch(`/approval/${id}/edit-plan`, payload).then(r => r.data),
};
