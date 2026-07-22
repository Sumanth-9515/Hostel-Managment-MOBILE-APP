import api from './client';
import { resilientGet } from './apiHelpers';

const paymentCorrection = ({ recordId, rentAmount, paidAmount, note }) => {
  const id = recordId;
  if (!id) throw new Error('Missing payment record id.');
  return api.put(`/rent/payment/${id}`, { rentAmount, paidAmount, note }).then(r => r.data);
};

export const rentApi = {
  due: params => resilientGet('/rent/due', { params }).then(r => r.data),
  dueSearch: q => resilientGet('/rent/due/search', { params: { q } }).then(r => r.data),
  all: () => resilientGet('/rent/all').then(r => r.data),
  monthlySummary: params => resilientGet('/rent/monthly-summary', { params }).then(r => r.data),
  search: params => resilientGet('/rent/search', { params }).then(r => r.data),
  tenant: tenantId => resilientGet(`/rent/tenant/${tenantId}`).then(r => r.data),
  pay: payload => api.post('/rent/pay', payload).then(r => r.data),
  paymentCorrection,
  sendReminder: tenantId => api.post('/rent/send-reminder', { tenantId }).then(r => r.data),
};
