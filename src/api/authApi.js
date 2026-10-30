import api from './client';
import { resilientGet } from './apiHelpers';

export const authApi = {
  login: payload => api.post('/login', payload).then(r => r.data),
  register: payload => api.post('/register', payload).then(r => r.data),
  sendForgotOtp: payload => api.post('/forgot-password/send-otp', payload).then(r => r.data),
  verifyForgotOtp: payload => api.post('/forgot-password/verify-otp', payload).then(r => r.data),
  updateForgotPassword: payload => api.post('/forgot-password/update', payload).then(r => r.data),
  requestExtension: payload => api.post('/request-extension', payload).then(r => r.data),
  profile: () => resilientGet('/profile').then(r => r.data),
  updateProfile: payload => api.patch('/profile', payload).then(r => r.data),
};
