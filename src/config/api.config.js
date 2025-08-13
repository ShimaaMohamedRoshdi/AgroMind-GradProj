// API endpoints configuration - Updated to integrate with backend server
export const API_CONFIG = {
    // Main backend API - Server provided by backend team
    BASE_URL: 'http://agromindgp.somee.com',
    
    // Chat endpoints - Updated to match server routes
    CHAT: {
        NEW_SESSION: 'http://agromindgp.somee.com/api/chat/new-session',
        PALM_CHAT: 'http://agromindgp.somee.com/api/chat/palm-chat',
        CLEAR_SESSION: 'http://agromindgp.somee.com/api/chat/clear-session',
    },
    
    // Disease detection endpoint - Updated server route
    DISEASE_DETECTION: 'http://agromindgp.somee.com/api/disease/detect-disease',
};
