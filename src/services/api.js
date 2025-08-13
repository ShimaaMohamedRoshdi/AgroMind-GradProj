import axios from "axios";

// Use the working backend URL

// Determine the base URL based on the environment
const getBaseUrl = () => {
  if (import.meta.env.PROD) {
    // In production, use the production URL. This will be baked in at build time.
    return 'https://agromind-backend-g6g9beexdpg8heeg.uaenorth-01.azurewebsites.net';
  }
  // In development, use the environment variable or a local default.
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5132';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add request interceptor for debugging
api.interceptors.request.use(
  config => {
    console.log(`🚀 Request: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  error => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  response => {
    console.log(`✅ Response: ${response.status} from ${response.config.url}`);
    return response;
  },
  error => {
    console.error('❌ Response Error:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;