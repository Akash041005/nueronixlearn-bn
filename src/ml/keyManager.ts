const ML_ENABLED = true;

import { GoogleGenerativeAI } from '@google/generative-ai';

interface APIKeyWithStatus {
  key: string;
  inUse: boolean;
  lastUsed: number;
  errorCount: number;
}

class MultiKeyManager {
  private chatbotKeys: APIKeyWithStatus[] = [];
  private recoKeys: APIKeyWithStatus[] = [];
  private currentChatbotIndex = 0;
  private currentRecoIndex = 0;
  private initDone = false;

  private geminiChatbotClients: GoogleGenerativeAI[] = [];
  private geminiRecoClients: GoogleGenerativeAI[] = [];

  init() {
    if (this.initDone) return;

    const chatbotKeyStr = process.env.GEMINI_API_KEY || '';
    const recoKeyStr = process.env.GEMINI_RECO_KEY || process.env.GEMINI_API_KEY || '';

    if (chatbotKeyStr) {
      const keys = chatbotKeyStr.split(',').map(k => k.trim()).filter(Boolean);

      this.chatbotKeys = keys.map(key => ({
        key,
        inUse: false,
        lastUsed: 0,
        errorCount: 0
      }));

      this.geminiChatbotClients = keys.map(key => new GoogleGenerativeAI(key));
    }

    if (recoKeyStr && recoKeyStr !== chatbotKeyStr) {
      const keys = recoKeyStr.split(',').map(k => k.trim()).filter(Boolean);

      this.recoKeys = keys.map(key => ({
        key,
        inUse: false,
        lastUsed: 0,
        errorCount: 0
      }));

      this.geminiRecoClients = keys.map(key => new GoogleGenerativeAI(key));
    }

    this.initDone = true;
  }

  getChatbotClient(): { client: GoogleGenerativeAI | null; keyIndex: number } {
    this.init();
    
    if (!ML_ENABLED) {
      return { client: null, keyIndex: -1 };
    }

    if (this.geminiChatbotClients.length > 0) {
      const idx = this.currentChatbotIndex % this.geminiChatbotClients.length;
      this.currentChatbotIndex = (idx + 1) % this.geminiChatbotClients.length;
      return { client: this.geminiChatbotClients[idx], keyIndex: idx };
    }

    return { client: null, keyIndex: -1 };
  }

  getRecoClient(): { client: GoogleGenerativeAI | null; keyIndex: number } {
    this.init();
    
    if (!ML_ENABLED) {
      return { client: null, keyIndex: -1 };
    }

    if (this.geminiRecoClients.length > 0) {
      const idx = this.currentRecoIndex % this.geminiRecoClients.length;
      this.currentRecoIndex = (idx + 1) % this.geminiRecoClients.length;
      return { client: this.geminiRecoClients[idx], keyIndex: idx };
    }

    if (this.geminiChatbotClients.length > 0) {
      const idx = this.currentChatbotIndex % this.geminiChatbotClients.length;
      this.currentChatbotIndex = (idx + 1) % this.geminiChatbotClients.length;
      return { client: this.geminiChatbotClients[idx], keyIndex: idx };
    }

    return { client: null, keyIndex: -1 };
  }

  getRecoKey(): { key: string | null; keyIndex: number } {
    this.init();
    
    if (!ML_ENABLED) {
      return { key: null, keyIndex: -1 };
    }

    if (this.recoKeys.length === 0) {
      if (this.chatbotKeys.length > 0) {
        const idx = this.currentChatbotIndex % this.chatbotKeys.length;
        this.currentChatbotIndex = (idx + 1) % this.chatbotKeys.length;
        return { key: this.chatbotKeys[idx].key, keyIndex: idx };
      }
      return { key: null, keyIndex: -1 };
    }

    const idx = this.currentRecoIndex % this.recoKeys.length;
    this.currentRecoIndex = (idx + 1) % this.recoKeys.length;
    return { key: this.recoKeys[idx].key, keyIndex: idx };
  }

  releaseRecoKey(index: number) {
    if (index >= 0 && index < this.recoKeys.length) {
      this.recoKeys[index].inUse = false;
    } else if (index >= 0 && index < this.chatbotKeys.length) {
      this.chatbotKeys[index].inUse = false;
    }
  }

  reportRecoError(index: number) {
    if (index >= 0 && index < this.recoKeys.length) {
      this.recoKeys[index].errorCount++;
      this.recoKeys[index].inUse = false;
    } else if (index >= 0 && index < this.chatbotKeys.length) {
      this.chatbotKeys[index].errorCount++;
      this.chatbotKeys[index].inUse = false;
    }
  }

  reportChatbotError(index: number) {
    if (index >= 0 && index < this.chatbotKeys.length) {
      this.chatbotKeys[index].errorCount++;
      this.chatbotKeys[index].inUse = false;
    }
  }

  releaseChatbotKey(index: number) {
    if (index >= 0 && index < this.chatbotKeys.length) {
      this.chatbotKeys[index].inUse = false;
    }
  }

  isConfigured(): boolean {
    this.init();
    return this.chatbotKeys.length > 0 || this.recoKeys.length > 0;
  }

  getStatus() {
    this.init();
    return {
      chatbotKeys: this.chatbotKeys.length,
      recoKeys: this.recoKeys.length,
      mlEnabled: ML_ENABLED
    };
  }
}

export default new MultiKeyManager();
