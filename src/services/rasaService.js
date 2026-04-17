class RasaService {
  constructor() {
    this.rasaUrl =
      process.env.REACT_APP_RASA_URL ||
      process.env.VITE_RASA_URL ||
      '';
    this.chatApiUrl =
      process.env.REACT_APP_CHAT_API_URL ||
      process.env.VITE_CHAT_API_URL ||
      'https://bot.alazab.com/chat';
    this.defaultBrand =
      process.env.REACT_APP_DEFAULT_BRAND ||
      process.env.VITE_DEFAULT_BRAND ||
      'uberfix';
    this.senderId = this.getOrCreateSenderId();
    this.conversationHistory = this.getSavedHistory();
  }

  getSavedHistory() {
    try {
      const history = localStorage.getItem('chat_history');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error parsing chat history:', error);
      return [];
    }
  }

  getOrCreateSenderId() {
    let senderId = localStorage.getItem('rasa_sender_id');

    if (!senderId) {
      senderId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem('rasa_sender_id', senderId);
    }

    return senderId;
  }

  setBrand(brand) {
    this.defaultBrand = brand || this.defaultBrand;
  }

  async sendMessage(message, options = {}) {
    try {
      const brand = options.brand || this.defaultBrand;
      let data;

      if (this.chatApiUrl) {
        const response = await fetch(this.chatApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender_id: this.senderId,
            message,
            brand,
          }),
        });

        if (!response.ok) {
          throw new Error(`Chat API request failed with status ${response.status}`);
        }

        const payload = await response.json();
        data = Array.isArray(payload.responses) ? payload.responses : [];
      } else {
        const response = await fetch(`${this.rasaUrl}/webhooks/rest/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: this.senderId,
            message,
            metadata: brand ? { brand } : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`Rasa request failed with status ${response.status}`);
        }

        data = await response.json();
      }

      this.conversationHistory.push({
        user: message,
        bot: data,
        timestamp: new Date().toISOString(),
      });

      localStorage.setItem('chat_history', JSON.stringify(this.conversationHistory));

      return data;
    } catch (error) {
      console.error('Error sending message to Rasa:', error);
      return [
        {
          text: 'عذراً، هناك مشكلة في الاتصال بالخادم. يرجى المحاولة لاحقاً.',
        },
      ];
    }
  }

  async getConversationHistory() {
    try {
      const response = await fetch(`${this.rasaUrl}/conversations/${this.senderId}/tracker`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Tracker request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching history:', error);
      return null;
    }
  }

  clearHistory() {
    this.conversationHistory = [];
    localStorage.removeItem('chat_history');
  }
}

export default new RasaService();
