import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatbotQuery } from '../api';

export default function Chatbot() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ from: 'bot', text: t('chatbotGreeting') }]);
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim()) return;
    const question = input.trim();
    setMessages(prev => [...prev, { from: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const { answer } = await chatbotQuery(question);
      setMessages(prev => [...prev, { from: 'bot', text: answer }]);
    } catch {
      setMessages(prev => [...prev, { from: 'bot', text: t('chatbotError') }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="chatbot-fab" onClick={() => setOpen(o => !o)}>
        {open ? '✖' : '🤖'}
      </button>
      {open && (
        <div className="chatbot-window">
          <div className="chatbot-header">{t('aiAssistant')}</div>
          <div className="chatbot-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chatbot-msg ${m.from}`}>{m.text}</div>
            ))}
            {loading && <div className="chatbot-msg bot">{t('loading')}</div>}
          </div>
          <div className="chatbot-input-row">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={t('askAnything')}
            />
            <button onClick={send}>{t('send')}</button>
          </div>
        </div>
      )}
    </>
  );
}