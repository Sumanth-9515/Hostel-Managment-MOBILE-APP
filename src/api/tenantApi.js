import api from './client';
import { resilientGet } from './apiHelpers';

export const tenantApi = {
  list: params => resilientGet('/tenants', { params }).then(r => r.data),
  get: id => resilientGet(`/tenants/${id}`).then(r => r.data),
  create: formData => api.post('/tenants', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  update: (id, formData) => api.put(`/tenants/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  vacate: id => api.delete(`/tenants/${id}/vacate`).then(r => r.data),
  reallocate: (id, payload) => api.put(`/tenants/${id}/reallocate`, payload).then(r => r.data),
  generateLink: () => resilientGet('/tenants/generate-link').then(r => r.data),
  shareLinkEmail: payload => api.post('/tenants/share-link-email', payload).then(r => r.data),
  validateLink: token => resilientGet(`/tenants/validate-link/${token}`).then(r => r.data),
  registerViaLink: formData => api.post('/tenants/register-via-link', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  sendOtp: payload => api.post('/tenants/send-email-otp', payload).then(r => r.data),
  verifyOtp: payload => api.post('/tenants/verify-email-otp', payload).then(r => r.data),
  notifications: () => resilientGet('/tenants/notifications').then(r => r.data),
  markVerified: () => api.patch('/tenants/mark-verified').then(r => r.data),
};
