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

                // Use the concise enhanced response
                if (data.confirmation === false) {
                    botResponse = data.message;
                } else {
                    // Use the concise message which includes disease detection + brief analysis
                    botResponse = data.message;
                }
            } else if (userMsgText) {
                const res = await fetch("http://localhost:5005/palm-chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        prompt: userMsgText,
                        session_id: sessionId
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
            console.log("Conversation cleared");
        } catch (error) {
            console.error("Failed to clear conversation:", error);
            // Clear locally even if server request fails
            setMessages([]);
        }
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
                    width: 70,
                    height: 70,
                    background: "#4CAF50",
                    border: "none",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.3s ease-in-out",
                    padding: 0
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.2)";
                    e.currentTarget.style.transform = "scale(1.05) translateY(-2px)";
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.15)";
                    e.currentTarget.style.transform = "scale(1) translateY(0)";
                }}
                aria-label="Open chat"
            >
                <img src={ChatIcon} alt="Open chat" style={{ width: '50px', height: '50px' }} />
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
                                                {msg.bot}
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
                                    📎
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
                                    onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                                />
                            </div>

                            {imagePreview && (
                                <button onClick={handleRemoveImage} style={{ padding: '10px 12px', background: '#ff5252', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', marginRight: 8, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    🗑️
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
