import React, { useState, useEffect } from "react";
import { Resizable } from 're-resizable';
import SendIcon from '../assets/images/paper-aeroplane.png'; // Import the send icon
import ChatIcon from '../assets/images/chat2.png'; // Updated to chat2.png
import EditIcon from '../assets/images/edit.png'; // Import the edit icon

function ChatBot() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [image, setImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    // Removed plant state - auto-detection from image only
    const [imagePreview, setImagePreview] = useState(null);
    const [showSpinner, setShowSpinner] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingText, setEditingText] = useState("");
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    // NEW: Conversation memory support
    const [sessionId, setSessionId] = useState('default');
    const [conversationStarted, setConversationStarted] = useState(false);
    // NEW: View More functionality
    const [expandedMessages, setExpandedMessages] = useState(new Set());
    // NEW: Disease context for follow-up questions
    const [lastDiseaseContext, setLastDiseaseContext] = useState(null);
    // NEW: Enhanced responses from Palm AI
    const [enhancedResponses, setEnhancedResponses] = useState(new Map());
    const [loadingEnhanced, setLoadingEnhanced] = useState(new Set());

    useEffect(() => {
        if (editingMessageId !== null) {
            setInput(editingText);
        }
    }, [editingText, editingMessageId]);

    // Initialize new session when chat opens
    useEffect(() => {
        if (open && !conversationStarted) {
            initializeSession();
        }
    }, [open, conversationStarted]);

    const initializeSession = async () => {
        try {
            const response = await fetch("http://localhost:5005/new-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            if (response.ok) {
                const data = await response.json();
                setSessionId(data.session_id);
                setConversationStarted(true);
                console.log("New session created:", data.session_id);
            }
        } catch (error) {
            console.error("Failed to create session:", error);
            // Fallback to default session
            setSessionId('default');
            setConversationStarted(true);
        }
    };

    const handleEdit = (index) => {
        const messageToEdit = messages[index];
        if (messageToEdit && typeof messageToEdit.user === 'string' && !messageToEdit.image) {
            setEditingMessageId(index);
            setEditingText(messageToEdit.user);
            setInput(messageToEdit.user);
        }
    };

    const cancelEdit = () => {
        setEditingMessageId(null);
        setEditingText("");
        setInput("");
    };

    const sendMessage = async () => {
        if (editingMessageId !== null) {
            const messageIndexToUpdate = editingMessageId;
            const newTextForUserDisplay = input.trim();

            if (!newTextForUserDisplay) {
                cancelEdit();
                return;
            }

            setMessages(prevMessages =>
                prevMessages.map((msg, index) => {
                    if (index === messageIndexToUpdate) {
                        return { ...msg, user: newTextForUserDisplay, bot: "..." };
                    }
                    return msg;
                })
            );
            setShowSpinner(true);

            setEditingMessageId(null);
            setEditingText("");
            setInput("");

            try {
                const res = await fetch("http://localhost:5005/palm-chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: newTextForUserDisplay,
                        session_id: sessionId
                    }),
                });

                if (!res.ok) throw new Error("Server error during edit");
                const data = await res.json();
                const botResponse = data.response;

                setMessages(prevMessages =>
                    prevMessages.map((msg, index) => {
                        if (index === messageIndexToUpdate) {
                            return { ...msg, bot: botResponse };
                        }
                        return msg;
                    })
                );
            } catch (err) {
                setMessages(prevMessages =>
                    prevMessages.map((msg, index) => {
                        if (index === messageIndexToUpdate) {
                            return { ...msg, bot: "Sorry, I couldn't reach the AI server." };
                        }
                        return msg;
                    })
                );
            } finally {
                setShowSpinner(false);
            }
            return;
        }

        // Allow sending with just image (no text required) or just text (no image required)
        if (!input.trim() && !image) return;

        let userMsgText = input.trim();
        let userDisplayMsg = userMsgText + (image ? `\n[Image uploaded for disease detection]` : "");

        let imgUrl = imagePreview;
        setMessages([...messages, { user: userDisplayMsg, bot: "...", image: imgUrl, id: Date.now() }]);
        setShowSpinner(true);
        try {
            let botResponse = "";
            if (image) {
                setUploading(true);
                const formData = new FormData();
                formData.append('image', image);
                formData.append('session_id', sessionId); // Add session ID
                if (userMsgText) {
                    formData.append('prompt', userMsgText); // Add user prompt if provided
                }

                const res = await fetch("http://localhost:5006/detect-disease", {
                    method: "POST",
                    body: formData,
                });
                setUploading(false);
                if (!res.ok) throw new Error("Server error");
                const data = await res.json();

                // Handle the new response format
                if (data.confirmation === false) {
                    botResponse = data.message;
                } else {
                    // Store disease context for follow-up questions
                    const diseaseContext = data.healthy
                        ? `Plant: ${data.plant} - Status: Healthy`
                        : `Plant: ${data.plant} - Disease: ${data.disease} - Confidence: ${(data.confidence * 100).toFixed(1)}% - Treatment: ${data.detailed_advice}`;

                    setLastDiseaseContext(diseaseContext);

                    // Create response with View More functionality
                    if (data.healthy) {
                        botResponse = {
                            type: 'disease_result',
                            message: data.message,
                            detailed_advice: data.detailed_advice,
                            isHealthy: true
                        };
                    } else {
                        botResponse = {
                            type: 'disease_result',
                            message: data.message,
                            brief_treatment: data.brief_treatment,
                            detailed_advice: data.detailed_advice,
                            plant: data.plant,
                            disease: data.disease,
                            confidence: data.confidence,
                            isHealthy: false
                        };
                    }
                }
            } else if (userMsgText) {
                const res = await fetch("http://localhost:5005/palm-chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: userMsgText,
                        session_id: sessionId,
                        disease_context: lastDiseaseContext || '' // Include recent disease context
                    }),
                });
                if (!res.ok) throw new Error("Server error");
                const data = await res.json();
                botResponse = data.response;
            }
            setMessages((prev) =>
                prev.map(msg => msg.bot === "..." && msg.user === userDisplayMsg ? { ...msg, bot: botResponse, image: imgUrl } : msg)
            );
        } catch (err) {
            setMessages((prev) =>
                prev.map(msg => msg.bot === "..." && msg.user === userDisplayMsg ? { ...msg, bot: "Sorry, I couldn't reach the AI server.", image: imgUrl } : msg)
            );
        }
        setInput("");
        setImage(null);
        // Removed setPlant("") - no longer needed
        setImagePreview(null);
        setShowSpinner(false);
    };

    const handleInputChange = (e) => {
        if (editingMessageId !== null) {
            setEditingText(e.target.value);
        }
        setInput(e.target.value);
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setImage(e.target.files[0]);
            setImagePreview(URL.createObjectURL(e.target.files[0]));

            // Auto-focus the input field after image upload for better UX
            setTimeout(() => {
                const inputField = document.querySelector('input[type="text"][placeholder*="message"]');
                if (inputField) {
                    inputField.focus();
                }
            }, 100);
        }
    };

    const handleRemoveImage = () => {
        setImage(null);
        setImagePreview(null);
    };

    const clearConversation = async () => {
        try {
            await fetch("http://localhost:5005/clear-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId })
            });
            setMessages([]);
            setExpandedMessages(new Set()); // Clear expanded messages too
            setLastDiseaseContext(null); // Clear disease context too
            setEnhancedResponses(new Map()); // Clear enhanced responses
            setLoadingEnhanced(new Set()); // Clear loading states
            console.log("Conversation cleared");
        } catch (error) {
            console.error("Failed to clear conversation:", error);
            // Clear locally even if server request fails
            setMessages([]);
            setExpandedMessages(new Set());
            setLastDiseaseContext(null);
            setEnhancedResponses(new Map());
            setLoadingEnhanced(new Set());
        }
    };

    // Function to clean response text from emojis and redundant "Treatment:" text
    const cleanResponseText = (text) => {
        if (!text) return text;

        // Remove all emojis using comprehensive regex
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{2000}-\u{206F}]|[\u{2070}-\u{209F}]|[\u{20A0}-\u{20CF}]|[\u{2100}-\u{214F}]|[\u{2190}-\u{21FF}]|[\u{2200}-\u{22FF}]|[\u{2300}-\u{23FF}]|[\u{2460}-\u{24FF}]|[\u{25A0}-\u{25FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{E000}-\u{F8FF}]/gu;
        let cleaned = text.replace(emojiRegex, '').trim();

        // Remove "Treatment:" if it starts with it (case insensitive)
        cleaned = cleaned.replace(/^treatment:\s*/i, '');

        // Remove any remaining emoji-like characters that might not be caught by the main regex
        cleaned = cleaned.replace(/[💊🔍⚕️🌿🌱🚨⚠️✅❌🟢🔴🟡🟠]/g, '');

        return cleaned.trim();
    };

    const toggleMessageExpansion = async (messageId, diseaseData = null) => {
        const newExpanded = new Set(expandedMessages);
        if (newExpanded.has(messageId)) {
            newExpanded.delete(messageId);
        } else {
            newExpanded.add(messageId);

            // If expanding and we have disease data, get enhanced response from Palm AI
            if (diseaseData && !enhancedResponses.has(messageId)) {
                const newLoading = new Set(loadingEnhanced);
                newLoading.add(messageId);
                setLoadingEnhanced(newLoading);

                try {
                    const enhancedPrompt = `Provide comprehensive, detailed advice for ${diseaseData.plant} affected by ${diseaseData.disease}. Include specific application rates, timing, preventive measures, and monitoring advice. Be thorough and practical for farmers. Do not start with "Treatment:" as this is already shown above.`;

                    const response = await fetch("http://localhost:5005/palm-chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            prompt: enhancedPrompt,
                            session_id: sessionId,
                            disease_context: `Plant: ${diseaseData.plant} - Disease: ${diseaseData.disease} - Confidence: ${(diseaseData.confidence * 100).toFixed(1)}% - Basic Treatment: ${diseaseData.detailed_advice}`
                        }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const newEnhanced = new Map(enhancedResponses);
                        newEnhanced.set(messageId, data.response);
                        setEnhancedResponses(newEnhanced);
                    }
                } catch (error) {
                    console.error("Failed to get enhanced response:", error);
                } finally {
                    const newLoading = new Set(loadingEnhanced);
                    newLoading.delete(messageId);
                    setLoadingEnhanced(newLoading);
                }
            }
        }
        setExpandedMessages(newExpanded);
    };

    return (
        <>
            <button
                onClick={() => setOpen((o) => !o)}
                style={{
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    zIndex: 1000,
                    borderRadius: "50%",
                    width: 64,
                    height: 64,
                    background: "linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)",
                    border: "none",
                    boxShadow: "0 6px 20px rgba(76, 175, 80, 0.25)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    padding: 0,
                    backdropFilter: "blur(10px)"
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = "0 8px 25px rgba(76, 175, 80, 0.35)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.background = "linear-gradient(135deg, #388E3C 0%, #4CAF50 100%)";
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(76, 175, 80, 0.25)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.background = "linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)";
                }}
                aria-label="Open AI Assistant"
            >
                <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))" }}
                >
                    <path
                        d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16ZM7 9H17V11H7V9ZM7 12H15V14H7V12ZM7 6H17V8H7V6Z"
                        fill="white"
                    />
                </svg>
            </button>
            {open && (
                <Resizable
                    defaultSize={{ width: 420, height: 650 }}
                    minWidth={300}
                    minHeight={400}
                    maxWidth="calc(100vw - 40px)"
                    maxHeight="calc(100vh - 40px)"
                    style={{
                        position: "fixed",
                        bottom: 108,
                        right: 24,
                        zIndex: 1000,
                        display: "flex",
                        flexDirection: "column",
                        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            background: "#f9f9f9",
                            borderRadius: 16,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                            display: "flex",
                            flexDirection: "column",
                            fontSize: 16,
                            minWidth: 0,
                            minHeight: 0,
                            overflow: "hidden"
                        }}
                    >
                        <div style={{
                            padding: "16px 20px",
                            borderBottom: "1px solid #e0e0e0",
                            background: "#ffffff",
                            color: "#4CAF50",
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        }}>
                            <span style={{
                                background: "linear-gradient(to right, #4CAF50, #2E7D32)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                fontWeight: 900,
                                fontSize: '26px',
                                fontFamily: "'Righteous', sans-serif"
                            }}>
                                AgroMind Chatbot
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={clearConversation}
                                    style={{
                                        background: "none",
                                        border: "1px solid #ddd",
                                        color: "#666",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                        fontWeight: 500
                                    }}
                                    title="Clear conversation"
                                >
                                    Clear
                                </button>
                                <button onClick={() => setOpen(false)} style={{
                                    background: "none",
                                    border: "none",
                                    color: "#888",
                                    fontSize: 28,
                                    cursor: "pointer",
                                    padding: "0 4px"
                                }}>×</button>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                            {messages.map((msg, i) => (
                                <div key={msg.id || i} style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {msg.user && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-end',
                                                justifyContent: 'flex-end',
                                                gap: '6px'
                                            }}
                                            onMouseEnter={() => msg.id && setHoveredMessageId(msg.id)}
                                            onMouseLeave={() => setHoveredMessageId(null)}
                                        >
                                            <div style={{
                                                background: '#DCF8C6',
                                                color: '#333',
                                                padding: '10px 14px',
                                                borderRadius: '20px',
                                                borderTopRightRadius: '8px',
                                                maxWidth: '75%',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                                whiteSpace: 'pre-wrap',
                                                wordWrap: 'break-word',
                                                position: 'relative'
                                            }}>
                                                {msg.user}
                                                {msg.image && (
                                                    <div style={{ marginTop: '10px' }}>
                                                        <img src={msg.image} alt="Uploaded" style={{ display: 'block', maxWidth: 180, maxHeight: 180, borderRadius: 12, border: '1px solid #ccc' }} />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                {hoveredMessageId === msg.id && !msg.image && editingMessageId !== i && (
                                                    <button
                                                        onClick={() => handleEdit(i)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            padding: '2px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '50%',
                                                            transition: 'background-color 0.2s ease'
                                                        }}
                                                        title="Edit message"
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <img src={EditIcon} alt="Edit" style={{ width: '16px', height: '16px', display: 'block' }} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {msg.bot && msg.bot !== "..." && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                            <div style={{
                                                background: '#ffffff',
                                                border: '1px solid #e9e9eb',
                                                color: '#333',
                                                padding: '10px 14px',
                                                borderRadius: '20px',
                                                borderTopLeftRadius: '8px',
                                                maxWidth: '75%',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                                whiteSpace: 'pre-wrap',
                                                wordWrap: 'break-word'
                                            }}>
                                                {typeof msg.bot === 'object' && msg.bot.type === 'disease_result' ? (
                                                    <div>
                                                        <div style={{ marginBottom: '8px', fontWeight: '500' }}>
                                                            {cleanResponseText(msg.bot.message)}
                                                        </div>

                                                        {!msg.bot.isHealthy && (
                                                            <div style={{ marginBottom: '8px' }}>
                                                                <div style={{
                                                                    fontWeight: '700',
                                                                    color: '#000000',
                                                                    marginBottom: '6px',
                                                                    fontSize: '16px'
                                                                }}>
                                                                    Treatment:
                                                                </div>
                                                                {cleanResponseText(msg.bot.brief_treatment)}

                                                                {/* View More button directly below treatment */}
                                                                <div style={{ marginTop: '8px' }}>
                                                                    {expandedMessages.has(msg.id || i) ? (
                                                                        <button
                                                                            onClick={() => toggleMessageExpansion(msg.id || i)}
                                                                            style={{
                                                                                padding: '4px 8px',
                                                                                background: '#4CAF50',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: '12px',
                                                                                fontSize: '12px',
                                                                                cursor: 'pointer',
                                                                                fontWeight: '500'
                                                                            }}
                                                                        >
                                                                            View Less
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => toggleMessageExpansion(msg.id || i, msg.bot)}
                                                                            style={{
                                                                                padding: '4px 8px',
                                                                                background: '#4CAF50',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: '12px',
                                                                                fontSize: '12px',
                                                                                cursor: 'pointer',
                                                                                fontWeight: '500'
                                                                            }}
                                                                        >
                                                                            View More
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Enhanced detailed response from Palm AI */}
                                                        {expandedMessages.has(msg.id || i) && (
                                                            <div style={{
                                                                marginTop: '8px',
                                                                padding: '8px',
                                                                backgroundColor: '#f8f9fa',
                                                                borderRadius: '8px',
                                                                fontSize: '14px',
                                                                lineHeight: '1.4'
                                                            }}>
                                                                {loadingEnhanced.has(msg.id || i) ? (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <div style={{
                                                                            border: '2px solid #e0e0e0',
                                                                            borderTop: '2px solid #4CAF50',
                                                                            borderRadius: '50%',
                                                                            width: 16,
                                                                            height: 16,
                                                                            animation: 'spin 1s linear infinite'
                                                                        }} />
                                                                        <span style={{ color: '#666', fontSize: '12px' }}>Getting enhanced treatment details...</span>
                                                                    </div>
                                                                ) : enhancedResponses.has(msg.id || i) ? (
                                                                    cleanResponseText(enhancedResponses.get(msg.id || i))
                                                                ) : (
                                                                    cleanResponseText(msg.bot.detailed_advice)
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* View More for healthy plants */}
                                                        {msg.bot.isHealthy && (
                                                            <div style={{ marginTop: '8px' }}>
                                                                {expandedMessages.has(msg.id || i) ? (
                                                                    <div>
                                                                        <div style={{
                                                                            marginBottom: '8px',
                                                                            padding: '8px',
                                                                            backgroundColor: '#f8f9fa',
                                                                            borderRadius: '8px',
                                                                            fontSize: '14px',
                                                                            lineHeight: '1.4'
                                                                        }}>
                                                                            {cleanResponseText(msg.bot.detailed_advice)}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => toggleMessageExpansion(msg.id || i)}
                                                                            style={{
                                                                                padding: '4px 8px',
                                                                                background: '#4CAF50',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: '12px',
                                                                                fontSize: '12px',
                                                                                cursor: 'pointer',
                                                                                fontWeight: '500'
                                                                            }}
                                                                        >
                                                                            View Less
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => toggleMessageExpansion(msg.id || i)}
                                                                        style={{
                                                                            padding: '4px 8px',
                                                                            background: '#4CAF50',
                                                                            color: 'white',
                                                                            border: 'none',
                                                                            borderRadius: '12px',
                                                                            fontSize: '12px',
                                                                            cursor: 'pointer',
                                                                            fontWeight: '500'
                                                                        }}
                                                                    >
                                                                        View More
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    cleanResponseText(msg.bot)
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {showSpinner && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '24px 0' }}>
                                    <div style={{
                                        border: '4px solid #e0e0e0',
                                        borderTop: '4px solid #25D366',
                                        borderRadius: '50%',
                                        width: 32,
                                        height: 32,
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                                    <span style={{ marginLeft: 12, color: '#555', fontWeight: 500 }}>Analyzing...</span>
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", borderTop: "1px solid #e0e0e0", padding: 12, alignItems: "center", background: "#ffffff", borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                border: '1px solid #ccc',
                                borderRadius: 20,
                                marginRight: 8,
                                background: '#fff'
                            }}>
                                <input
                                    type="file"
                                    id="imageUpload"
                                    onChange={handleImageChange}
                                    style={{ display: "none" }}
                                    accept="image/*"
                                />
                                <label
                                    htmlFor="imageUpload"
                                    title="Upload image"
                                    style={{
                                        padding: '10px',
                                        cursor: 'pointer',
                                        fontSize: '22px',
                                        color: '#555',
                                        borderRight: '1px solid #ccc',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    +
                                </label>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={handleInputChange}
                                    placeholder={editingMessageId !== null ? "Edit your message..." : "Type a message..."}
                                    style={{
                                        flex: 1,
                                        padding: '10px 12px',
                                        border: 'none',
                                        borderRadius: '0 19px 19px 0',
                                        fontSize: 15,
                                        outline: 'none',
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage();
                                        }
                                    }}
                                />
                            </div>

                            {imagePreview && (
                                <button onClick={handleRemoveImage} style={{ padding: '10px 12px', background: '#ff5252', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', marginRight: 8, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    ×
                                </button>
                            )}
                            <button onClick={sendMessage} style={{ padding: "8px 12px", background: editingMessageId !== null ? "#4caf50" : "#25D366", color: "#fff", border: "none", borderRadius: 20, cursor: "pointer", transition: "background-color 0.3s ease", display: "flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px" }}
                                onMouseOver={(e) => e.currentTarget.style.background = editingMessageId !== null ? "#388e3c" : "#1DAA54"}
                                onMouseOut={(e) => e.currentTarget.style.background = editingMessageId !== null ? "#4caf50" : "#25D366"}
                                title={editingMessageId !== null ? "Update" : "Send"}
                            >
                                {editingMessageId !== null ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>✓</span>
                                    </>
                                ) : (
                                    <img src={SendIcon} alt="Send" style={{ width: '20px', height: '20px' }} />
                                )}
                            </button>
                            {editingMessageId !== null && (
                                <button onClick={cancelEdit} style={{ marginLeft: '8px', padding: "10px 16px", background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 15, fontWeight: 500, transition: "background-color 0.3s ease" }}
                                    onMouseOver={(e) => e.currentTarget.style.background = "#757575"}
                                    onMouseOut={(e) => e.currentTarget.style.background = "#9e9e9e"}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                </Resizable>
            )}
        </>
    );
}

export default ChatBot;
