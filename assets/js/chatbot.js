/**
 * Cambell Andijan — AI Chatbot (server AI + bilim bazasi fallback)
 */
const CambellChatbot = (function () {
  let knowledge = null;
  let lang = 'uz';
  let isOpen = false;
  let isTyping = false;
  let aiEnabled = false;
  const chatHistory = [];

  const API_URL = '/api/chat';

  function getLang() {
    const stored = localStorage.getItem('cambell_lang');
    return ['uz', 'ru', 'en'].includes(stored) ? stored : 'uz';
  }

  function detectMessageLang(text) {
    const t = String(text || '').trim();
    if (!t) return lang;
    if (/[а-яёА-ЯЁ]/.test(t)) return 'ru';
    if (/\b(salom|rahmat|avtobus|qancha|kerak|menga|haqida|yordam|qayer|narx|aloqa|qanday|kim|qayerda)\b/i.test(t)) return 'uz';
    if (/o[''`]|\bg[''`]|oʻ|gʻ/i.test(t)) return 'uz';
    if (/\b(the|is|are|was|want|buy|bus|hello|hi|how|what|where|price|contact|need|can|you|please|thanks|help|about)\b/i.test(t)) return 'en';
    if (/^[a-zA-Z0-9\s.,!?'+\-()]+$/u.test(t) && t.length > 2) return 'en';
    return lang;
  }

  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[''`]/g, "'")
      .replace(/[?!.,;:"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(text) {
    return normalize(text).split(' ').filter((w) => w.length > 1);
  }

  function scoreEntry(query, entry) {
    const q = normalize(query);
    const words = tokenize(query);
    let score = 0;

    entry.keywords.forEach((kw) => {
      const k = normalize(kw);
      if (q.includes(k)) score += 8;
      words.forEach((w) => {
        if (k.includes(w) || w.includes(k)) score += 3;
      });
    });

    words.forEach((w) => {
      if (w.length > 3 && q.includes(w)) score += 1;
    });

    return score;
  }

  function findAnswer(query, searchLang) {
    if (!knowledge) return null;
    const useLang = searchLang || lang;
    const entries = knowledge.entries[useLang] || knowledge.entries.uz;
    let best = null;
    let bestScore = 0;

    entries.forEach((entry) => {
      const s = scoreEntry(query, entry);
      if (s > bestScore) {
        bestScore = s;
        best = entry;
      }
    });

    if (bestScore >= 3) return best;

    const otherLangs = ['uz', 'ru', 'en'].filter((l) => l !== lang);
    for (const l of otherLangs) {
      const entriesL = knowledge.entries[l] || [];
      for (const entry of entriesL) {
        const s = scoreEntry(query, entry);
        if (s > bestScore) {
          bestScore = s;
          best = entry;
        }
      }
    }

    return bestScore >= 4 ? best : null;
  }

  function formatAnswer(entry, answerLang) {
    const useLang = answerLang || lang;
    let html = entry.answer.replace(/\n/g, '<br>');
    if (entry.link) {
      const labels = { uz: 'Batafsil →', ru: 'Подробнее →', en: 'Learn more →' };
      html += `<br><a href="${entry.link}">${labels[useLang]}</a>`;
    }
    return html;
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  async function checkAi() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return false;
      const data = await res.json();
      aiEnabled = Boolean(data.ready || data.ai);
      return aiEnabled;
    } catch {
      aiEnabled = false;
      return false;
    }
  }

  async function askAi(message) {
    const messageLang = detectMessageLang(message);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        lang,
        messageLang,
        history: chatHistory.slice(-8),
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.reply) {
      throw new Error(data.error || 'AI javob bermadi');
    }
    return data.reply;
  }

  function createWidget() {
    if (document.getElementById('cambell-chatbot')) return;

    const wrap = document.createElement('div');
    wrap.id = 'cambell-chatbot';
    wrap.innerHTML = `
      <div class="chat-panel" id="chatPanel" role="dialog" aria-label="Chat">
        <div class="chat-header">
          <div class="chat-header-avatar"><i class="fa fa-robot"></i></div>
          <div class="chat-header-info">
            <h3 id="chatBotName">Cambell Yordamchi</h3>
            <p id="chatBotStatus">AI • Online</p>
          </div>
          <button class="chat-header-close" id="chatClose" aria-label="Close">&times;</button>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-quick-replies" id="chatQuickReplies"></div>
        <div class="chat-input-area">
          <input type="text" id="chatInput" autocomplete="off" maxlength="500">
          <button class="chat-send-btn" id="chatSend" aria-label="Send"><i class="fa fa-paper-plane"></i></button>
        </div>
      </div>
      <button class="chat-toggle" id="chatToggle" aria-label="Open chat">
        <i class="fa fa-comments"></i>
        <span class="chat-badge"></span>
      </button>
    `;
    document.body.appendChild(wrap);

    document.getElementById('chatToggle').addEventListener('click', toggle);
    document.getElementById('chatClose').addEventListener('click', close);
    document.getElementById('chatSend').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  function updateStatusLabel() {
    const el = document.getElementById('chatBotStatus');
    if (!el) return;
    const labels = {
      uz: aiEnabled ? 'Onlayn' : 'Offline rejim',
      ru: aiEnabled ? 'Онлайн' : 'Офлайн режим',
      en: aiEnabled ? 'Online' : 'Offline mode',
    };
    el.textContent = labels[lang] || labels.uz;
  }

  function updateUI() {
    if (!knowledge) return;
    const cfg = knowledge.config;
    document.getElementById('chatBotName').textContent = cfg.botName[lang];
    document.getElementById('chatInput').placeholder = cfg.placeholder[lang];
    updateStatusLabel();
    renderQuickReplies();
  }

  function renderQuickReplies() {
    const container = document.getElementById('chatQuickReplies');
    if (!container || !knowledge) return;
    container.innerHTML = '';
    (knowledge.config.quickReplies[lang] || []).forEach((label) => {
      const btn = document.createElement('button');
      btn.className = 'chat-quick-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        const mapped = knowledge.quickReplyMap[lang]?.[label] || label;
        document.getElementById('chatInput').value = mapped;
        sendMessage();
      });
      container.appendChild(btn);
    });
  }

  function addMessage(text, type, isHtml = false) {
    const container = document.getElementById('chatMessages');
    const msg = document.createElement('div');
    msg.className = `chat-msg ${type}`;
    if (isHtml) msg.innerHTML = text;
    else msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return text;
  }

  function showTyping() {
    const container = document.getElementById('chatMessages');
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.id = 'chatTyping';
    typing.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('chatTyping');
    if (el) el.remove();
  }

  function fallbackAnswer(query) {
    const replyLang = detectMessageLang(query);
    const entry = findAnswer(query, replyLang);
    if (entry) return { html: formatAnswer(entry, replyLang), text: entry.answer, isHtml: true };
    return { html: null, text: knowledge.config.fallback[replyLang] || knowledge.config.fallback.uz, isHtml: false };
  }

  async function respond(query) {
    isTyping = true;
    showTyping();

    let replyText = '';
    let replyHtml = null;
    let isHtml = false;

    try {
      replyText = await askAi(query);
      chatHistory.push({ role: 'user', content: query });
      chatHistory.push({ role: 'assistant', content: replyText });
      aiEnabled = true;
      updateStatusLabel();
    } catch (e) {
      console.warn('AI failed, using fallback:', e.message);
      aiEnabled = false;
      updateStatusLabel();
      const fb = fallbackAnswer(query);
      replyText = fb.text;
      replyHtml = fb.html;
      isHtml = fb.isHtml;
    }

    hideTyping();

    if (isHtml && replyHtml) {
      addMessage(replyHtml, 'bot', true);
    } else {
      const html = replyText.split('\n').filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
      addMessage(html || escapeHtml(replyText), 'bot', true);
    }

    isTyping = false;
  }

  function sendMessage() {
    if (isTyping) return;
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    input.value = '';
    respond(text);
  }

  function open() {
    isOpen = true;
    document.getElementById('chatPanel').classList.add('open');
    const badge = document.querySelector('#cambell-chatbot .chat-badge');
    if (badge) badge.style.display = 'none';

    const messages = document.getElementById('chatMessages');
    if (messages.children.length === 0 && knowledge) {
      addMessage(knowledge.config.welcome[lang], 'bot');
    }

    document.getElementById('chatInput').focus();
  }

  function close() {
    isOpen = false;
    document.getElementById('chatPanel').classList.remove('open');
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  async function loadKnowledge() {
    try {
      const res = await fetch('assets/data/chatbot-knowledge.json');
      knowledge = await res.json();
    } catch (e) {
      console.warn('Chatbot knowledge load failed', e);
    }
  }

  async function init() {
    lang = getLang();
    await loadKnowledge();
    await checkAi();
    createWidget();
    updateUI();

    const badge = document.querySelector('#cambell-chatbot .chat-badge');
    if (badge && !sessionStorage.getItem('cambell_chat_seen')) {
      badge.style.display = 'block';
    }

    document.getElementById('chatToggle').addEventListener('click', () => {
      sessionStorage.setItem('cambell_chat_seen', '1');
    }, { once: false });

    document.addEventListener('languageChanged', (e) => {
      lang = e.detail?.lang || getLang();
      updateUI();
    });

    document.addEventListener('layoutReady', () => {
      lang = getLang();
      updateUI();
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => CambellChatbot.init());
