import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL });

export const getCentres = () => api.get('/centres').then(r => r.data);
export const getCentreDetail = id => api.get(`/centres/${id}`).then(r => r.data);
export const getAlerts = () => api.get('/alerts').then(r => r.data);
export const resolveAlert = id => api.put(`/alerts/${id}/resolve`).then(r => r.data);
export const getMedicineForecast = id => api.get(`/medicines/${id}/forecast`).then(r => r.data);
export const getMedicineDemand = id => api.get(`/medicines/${id}/demand`).then(r => r.data);
export const getFootfallForecast = id =>
  api.get(`/centres/${id}/footfall/forecast`).then(r => r.data);
export const updateStock = (id, payload) =>
  api.put(`/medicines/${id}/stock`, payload).then(r => r.data);
export const getUnderperforming = district =>
  api.get(`/districts/${district}/underperforming`).then(r => r.data);
export const getRedistribution = district =>
  api.get(`/districts/${district}/redistribution`).then(r => r.data);
export const getDistrictSummary = district =>
  api.get(`/districts/${district}/summary`).then(r => r.data);
export const getDistrictStatus = district =>
  api.get(`/districts/${district}/status`).then(r => r.data);
export const getSummary = () => api.get('/summary').then(r => r.data);
export const getRecommendation = centreId =>
  api.get(`/centres/${centreId}/recommendation`).then(r => r.data);
export const getCentreTrends = centreId =>
  api.get(`/centres/${centreId}/trends`).then(r => r.data);
export const getDoctorAttendanceDetail = doctorId =>
  api.get(`/doctors/${doctorId}/attendance-detail`).then(r => r.data);
export const chatbotQuery = question =>
  api.get('/chatbot', { params: { q: question } }).then(r => r.data);
export const postTransfer = payload =>
  api.post('/redistribution/transfer', payload).then(r => r.data);

export default api;