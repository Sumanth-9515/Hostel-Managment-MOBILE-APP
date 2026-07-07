import api from './client';

export const buildingApi = {
  list: () => api.get('/buildings').then(r => r.data),
  get: id => api.get(`/buildings/${id}`).then(r => r.data),
  create: payload => api.post('/buildings', payload).then(r => r.data),
  update: (id, payload) => api.put(`/buildings/${id}`, payload).then(r => r.data),
  remove: id => api.delete(`/buildings/${id}`).then(r => r.data),
  bedUsage: () => api.get('/buildings/plan/bed-usage').then(r => r.data),
  overview: () => api.get('/buildings/stats/overview').then(r => r.data),
  searchRoom: roomNumber => api.get('/buildings/search/room', { params: { roomNumber } }).then(r => r.data),
  addFloor: (buildingId, payload) => api.post(`/buildings/${buildingId}/floors`, payload).then(r => r.data),
  updateFloor: (buildingId, floorId, payload) => api.put(`/buildings/${buildingId}/floors/${floorId}`, payload).then(r => r.data),
  deleteFloor: (buildingId, floorId) => api.delete(`/buildings/${buildingId}/floors/${floorId}`).then(r => r.data),
  addRoom: (buildingId, floorId, payload) => api.post(`/buildings/${buildingId}/floors/${floorId}/rooms`, payload).then(r => r.data),
  updateRoom: (buildingId, floorId, roomId, payload) => api.put(`/buildings/${buildingId}/floors/${floorId}/rooms/${roomId}`, payload).then(r => r.data),
  deleteRoom: (buildingId, floorId, roomId) => api.delete(`/buildings/${buildingId}/floors/${floorId}/rooms/${roomId}`).then(r => r.data),
  availableBeds: (buildingId, floorId, roomId) =>
    api.get(`/buildings/${buildingId}/floors/${floorId}/rooms/${roomId}/available-beds`).then(r => r.data),
};
