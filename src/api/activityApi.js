import { resilientGet } from './apiHelpers';

export const activityApi = {
  list: params => resilientGet('/activities', { params }).then(r => r.data),
};
