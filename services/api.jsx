import axios from "axios";

// Determine the base URL based on the environment
const getBaseUrl = () => {
  if (import.meta.env.PROD) {
    // In production, use the production URL.
    return 'https://agromind-backend-g6g9beexdpg8heeg.uaenorth-01.azurewebsites.net';
  }
  // In development, use a local default.
  return 'https://localhost:7057';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

// Add request interceptor to include authentication token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("Adding auth token to request:", config.url);
    } else {
      console.warn("No auth token found for request:", config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
