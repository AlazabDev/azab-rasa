import React, { useEffect, useMemo, useRef, useState } from 'react';
import rasaService from '../services/rasaService';
import './ChatBot.css';

const STORAGE_KEY = 'chat_history';
const DEFAULT_BRAND = 'uberfix';
const DEFAULT_WELCOME_MESSAGE = {
  text: 'كيف يمكنني مساعدتك؟',
  sender: 'bot',
  timestamp: new Date().toISOString(),
};

const quickReplies = [
  'ما هي خدمات الشركة؟',
  'ما هي أسعار التشطيب؟',
  'أريد سعر تشطيب',
  'ما هي فروع الشركة؟',
];

function normalizeHistory(history) {
  const formattedMessages = [];

  history.forEach((conversation) => {
    if (conversation.user) {
      formattedMessages.push({
        text: conversation.user,
        sender: 'user',
        timestamp: conversation.timestamp,
      });
    }

    if (Array.isArray(conversation.bot)) {
      conversation.bot.forEach((reply, index) => {
        formattedMessages.push({
          text: reply?.text || 'تم استلام الطلب.',
          sender: 'bot',
          timestamp: conversation.timestamp,
          buttons: Array.isArray(reply?.buttons) ? reply.buttons : [],
          key: `${conversation.timestamp}-${index}`,
        });
      });
    }
  });

  return formattedMessages;
}

function HeaderActionIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M7 9V8a5 5 0 0 1 10 0v1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5.5 9.5h13l-1 8a2 2 0 0 1-2 1.75h-7a2 2 0 0 1-2-1.75l-1-8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 12.5h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EmptyStateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M6 7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5v5A2.5 2.5 0 0 1 15.5 15H10l-4 4v-4.5A2.5 2.5 0 0 1 3.5 12V7.5A2.5 2.5 0 0 1 6 5.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LauncherIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M5 12a7 7 0 1 1 3.07 5.83L5 19l1.17-3.07A6.97 6.97 0 0 1 5 12Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ChatBot = () => {
  const [messages, setMessages] = useState([DEFAULT_WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeBrand, setActiveBrand] = useState(DEFAULT_BRAND);
  const [activeTab, setActiveTab] = useState('text');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEY);
    if (!savedHistory) return;

    try {
      const history = JSON.parse(savedHistory);
      const normalized = normalizeHistory(history);
      if (normalized.length > 0) {
        setMessages(normalized);
      }
    } catch (error) {
      console.error('Failed to parse saved chat history:', error);
    }
  }, []);

  useEffect(() => {
    rasaService.setBrand(activeBrand);
  }, [activeBrand]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setUnreadCount(0);
    }
  }, [isOpen]);

  const lastBotTimestamp = useMemo(() => {
    const lastBotMessage = [...messages].reverse().find((message) => message.sender === 'bot');
    return lastBotMessage?.timestamp || null;
  }, [messages]);

  useEffect(() => {
    if (!lastBotTimestamp || isOpen) return;
    setUnreadCount((current) => current + 1);
  }, [lastBotTimestamp, isOpen]);

  const appendBotMessages = (responses) => {
    if (!Array.isArray(responses) || responses.length === 0) {
      setMessages((previous) => [
        ...previous,
        {
          text: 'لم أصل للرد المناسب. اكتب سؤالك بشكل أوضح.',
          sender: 'bot',
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    const now = Date.now();
    const nextMessages = responses.map((response, index) => ({
      text: response?.text || 'تم استلام رسالتك.',
      sender: 'bot',
      timestamp: new Date().toISOString(),
      buttons: Array.isArray(response?.buttons) ? response.buttons : [],
      key: `bot-${now}-${index}`,
    }));

    setMessages((previous) => [...previous, ...nextMessages]);
  };

  const sendMessage = async (messageText, options = {}) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const nextBrand = options.brand || activeBrand;
    const userMessage = {
      text: trimmed,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const rasaResponse = await rasaService.sendMessage(trimmed, { brand: nextBrand });
      appendBotMessages(rasaResponse);
    } catch (error) {
      console.error('Chat send failed:', error);
      appendBotMessages([{ text: 'حدثت مشكلة اتصال مؤقتة. حاول مرة أخرى.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    const api = {
      open: (detail = {}) => {
        if (detail.brand) setActiveBrand(detail.brand);
        setIsOpen(true);
        if (detail.message) sendMessage(detail.message, detail);
      },
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((current) => !current),
      send: (message, detail = {}) => {
        setIsOpen(true);
        return sendMessage(message, detail);
      },
      setBrand: (brand) => setActiveBrand(brand || DEFAULT_BRAND),
    };

    window.AlazabReactChatWidget = api;

    const onOpen = (event) => api.open(event.detail || {});
    const onClose = () => api.close();
    const onToggle = () => api.toggle();
    const onSend = (event) => api.send(event.detail?.message || '', event.detail || {});

    window.addEventListener('alazab:react:chat:open', onOpen);
    window.addEventListener('alazab:react:chat:close', onClose);
    window.addEventListener('alazab:react:chat:toggle', onToggle);
    window.addEventListener('alazab:react:chat:send', onSend);

    return () => {
      delete window.AlazabReactChatWidget;
      window.removeEventListener('alazab:react:chat:open', onOpen);
      window.removeEventListener('alazab:react:chat:close', onClose);
      window.removeEventListener('alazab:react:chat:toggle', onToggle);
      window.removeEventListener('alazab:react:chat:send', onSend);
    };
  }, [activeBrand]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOnlyWelcome = messages.length === 1 && messages[0].sender === 'bot';

  return (
    <div className="chatbot-wrapper" dir="rtl" data-brand={activeBrand}>
      <div className={`chat-shell ${isOpen ? 'is-open' : ''}`}>
        {isOpen && (
          <section className="chat-container" aria-label="بطاقة الدردشة الذكية">
            <header className="chat-header">
              <button type="button" className="header-icon-btn close-btn" onClick={() => setIsOpen(false)} aria-label="إغلاق">
                ✕
              </button>

              <div className="header-title-group">
                <h3>عزبوت (AzBot)</h3>
                <p>المساعد الذكي — متصل الآن</p>
              </div>

              <div className="header-icon-btn brand-action" aria-hidden="true">
                <HeaderActionIcon />
              </div>
            </header>

            <div className="chat-tabs" role="tablist" aria-label="أوضاع المحادثة">
              <button
                type="button"
                className={`chat-tab ${activeTab === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTab('text')}
              >
                <span className="tab-icon">▢</span>
                <span>محادثة نصية</span>
              </button>

              <button
                type="button"
                className={`chat-tab ${activeTab === 'voice' ? 'active' : ''}`}
                onClick={() => setActiveTab('voice')}
              >
                <span className="tab-icon">🎤</span>
                <span>محادثة صوتية</span>
              </button>
            </div>

            <div className="chat-body">
              {isOnlyWelcome ? (
                <div className="chat-empty-state">
                  <div className="empty-icon-wrap">
                    <EmptyStateIcon />
                  </div>
                  <h4>مرحباً! أنا عزبوت 👋</h4>
                  <p>كيف يمكنني مساعدتك؟</p>

                  <div className="empty-actions">
                    {quickReplies.map((reply) => (
                      <button key={reply} type="button" className="empty-chip" onClick={() => sendMessage(reply)}>
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="chat-messages">
                  {messages.map((message, index) => (
                    <div key={message.key || `${message.sender}-${message.timestamp}-${index}`} className={`message ${message.sender}`}>
                      <div className="message-bubble">
                        <div className="message-text">{message.text}</div>

                        {message.sender === 'bot' && Array.isArray(message.buttons) && message.buttons.length > 0 && (
                          <div className="message-buttons">
                            {message.buttons.map((button, buttonIndex) => (
                              <button
                                key={`${button.title}-${buttonIndex}`}
                                type="button"
                                className="inline-action"
                                onClick={() => sendMessage(button.payload || button.title)}
                              >
                                {button.title}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="message-time">{formatTime(message.timestamp)}</div>
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="message bot typing">
                      <div className="message-bubble">
                        <div className="typing-indicator">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="chat-input-wrap">
              <button type="button" className="send-btn" onClick={() => sendMessage(input)} disabled={!input.trim()} aria-label="إرسال">
                ➤
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب رسالتك..."
                rows={1}
              />
            </div>

            <div className="chat-footer-note">مدعوم بالذكاء الاصطناعي • ونحافظ على بياناتك</div>
          </section>
        )}

        <button
          type="button"
          className={`chat-toggle-btn ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen((current) => !current)}
          aria-label={isOpen ? 'إغلاق بطاقة الدردشة' : 'فتح بطاقة الدردشة'}
        >
          <span className="launcher-icon"><LauncherIcon /></span>
          {!isOpen && unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        </button>
      </div>
    </div>
  );
};

export default ChatBot;
