import api from './client';

export const rentApi = {
  due: params => api.get('/rent/due', { params }).then(r => r.data),
  dueSearch: q => api.get('/rent/due/search', { params: { q } }).then(r => r.data),
  all: () => api.get('/rent/all').then(r => r.data),
  search: params => api.get('/rent/search', { params }).then(r => r.data),
  tenant: tenantId => api.get(`/rent/tenant/${tenantId}`).then(r => r.data),
  pay: payload => api.post('/rent/pay', payload).then(r => r.data),
  paymentCorrection: payload => api.patch('/rent/payment-correction', payload).then(r => r.data),
  sendReminder: tenantId => api.post('/rent/send-reminder', { tenantId }).then(r => r.data),
};
