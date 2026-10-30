import api from './client';
import { resilientGet } from './apiHelpers';

export const paymentRequestApi = {
  list: () => resilientGet('/payment-requests').then(r => r.data),
  approve: id => api.patch(`/payment-requests/${id}/approve`).then(r => r.data),
  reject: (id, reason) => api.patch(`/payment-requests/${id}/reject`, { reason }).then(r => r.data),
};
