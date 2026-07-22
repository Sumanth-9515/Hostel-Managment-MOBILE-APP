import api from './client';
import { resilientGet } from './apiHelpers';

export const buildingApi = {
  list: () => resilientGet('/buildings').then(r => r.data),
  get: id => resilientGet(`/buildings/${id}`).then(r => r.data),
  create: payload => api.post('/buildings', payload).then(r => r.data),
  update: (id, payload) => api.put(`/buildings/${id}`, payload).then(r => r.data),
  remove: id => api.delete(`/buildings/${id}`).then(r => r.data),
  bedUsage: () => resilientGet('/buildings/plan/bed-usage').then(r => r.data),
  overview: () => resilientGet('/buildings/stats/overview').then(r => r.data),
  searchRoom: roomNumber => resilientGet('/buildings/search/room', { params: { roomNumber } }).then(r => r.data),
  addFloor: (buildingId, payload) => api.post(`/buildings/${buildingId}/floors`, payload).then(r => r.data),
  updateFloor: (buildingId, floorId, payload) => api.put(`/buildings/${buildingId}/floors/${floorId}`, payload).then(r => r.data),
  deleteFloor: (buildingId, floorId) => api.delete(`/buildings/${buildingId}/floors/${floorId}`).then(r => r.data),
  addRoom: (buildingId, floorId, payload) => api.post(`/buildings/${buildingId}/floors/${floorId}/rooms`, payload).then(r => r.data),
  updateRoom: (buildingId, floorId, roomId, payload) => api.put(`/buildings/${buildingId}/floors/${floorId}/rooms/${roomId}`, payload).then(r => r.data),
  deleteRoom: (buildingId, floorId, roomId) => api.delete(`/buildings/${buildingId}/floors/${floorId}/rooms/${roomId}`).then(r => r.data),
  availableBeds: (buildingId, floorId, roomId) =>
    resilientGet(`/buildings/${buildingId}/floors/${floorId}/rooms/${roomId}/available-beds`).then(r => r.data),
};
