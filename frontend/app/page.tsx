'use client'; // 標記為 Client Component 以使用 React Hooks

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { Bot, MessageSquareText, Mic, Image as ImageIcon, FileText, ChevronRight, Send, Search } from 'lucide-react';
import './globals.css'; // 確保路徑正確

export default function Home() {
  // ── 狀態管理 ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // 實驗設定 (這部分未來可依據登入系統動態帶入)
  const participantId = "Participant_001"; 
  const condition = "AI"; // 你的後端設定的情境條件

  // 自動捲動到底部的參考點
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── 初始化 Session (與後端建立連線) ───────────────────────────────
  useEffect(() => {
    async function startSession() {
      try {
        // ✅ 直接複製這行替換
          // ✅ 直接複製這整段取代原本的 fetch
const res = await fetch('https://chatbot-i1pf.onrender.com/session/start', {
  method: 'POST', // 🔴 絕對不能漏掉這行！
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    participant: participantId,
    condition: condition
  })
});
        if (res.ok) {
          const data = await res.json();
          setSessionId(data.session_id);
          // 可以加入一句 AI 的開場白
          setMessages([{ role: 'assistant', content: '您好！我是這裡的 AI 助理。請隨時跟我分享您最近遇到的困擾或壓力。' }]);
        } else {
          console.error("Failed to start session");
        }
      } catch (error) {
        console.error("Error connecting to backend:", error);
      }
    }
    startSession();
  }, []);

  // 確保每次有新訊息時，畫面自動捲動到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── 發送訊息邏輯 ─────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!inputText.trim() || !sessionId || isLoading) return;

    const userMessage = inputText.trim();
    setInputText(''); // 清空輸入框
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // ✅ 直接複製這行替換
        // ✅ 直接複製這整段取代原本的 fetch
const res = await fetch('https://chatbot-i1pf.onrender.com/chat', {
  method: 'POST', // 🔴 絕對不能漏掉這行！
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: sessionId,
    participant: participantId,
    message: userMessage,
    condition: condition
  })
});

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        const errorData = await res.json();
        console.error("Chat error:", errorData);
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 抱歉，系統似乎遇到了一點問題，請稍後再試。' }]);
      }
    } catch (error) {
      console.error("Network error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 無法連接到伺服器，請確認後端是否已啟動。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 支援按下 Enter 鍵發送
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      <Head>
        <title>情緒卸載實驗 | 互動平台</title>
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </Head>

      <div className="min-h-screen flex flex-col items-center p-6 md:p-12">
        {/* Header */}
        <header className="w-full max-w-7xl flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/20 shadow-md">
              {/* 記得確保 public 資料夾有這張圖，或先拿掉 src */}
              <div className="w-full h-full bg-primary-light flex items-center justify-center text-text-dark font-bold">
                P1
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Hi, Participant!</h1>
              <p className="text-lg text-text-dark">歡迎來到今日的書寫空間</p>
            </div>
          </div>
          <button className="flex items-center gap-2 p-2 px-4 rounded-full border border-white/20 glass-card">
            <Bot size={20} className="text-primary-lighter" />
            <span className="font-medium">{sessionId ? '連線成功' : '連線中...'}</span>
          </button>
        </header>

        {/* 聊天顯示區域 (套用毛玻璃樣式) */}
        <section className="w-full max-w-7xl flex-grow flex flex-col gap-6 mb-8 p-8 glass-card rounded-3xl overflow-y-auto max-h-[60vh] custom-scrollbar">
          {messages.length === 0 && !sessionId && (
            <div className="flex justify-center items-center h-full text-text-dark opacity-50">
              <p>正在與伺服器建立連線...</p>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-5 px-7 rounded-3xl glass-card max-w-[75%] shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-white/40 border-white/50 text-text-dark rounded-br-sm' 
                  : 'bg-primary-lighter/30 border-white/30 text-text-dark rounded-bl-sm'
              }`}>
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="p-5 px-7 rounded-3xl glass-card bg-primary-lighter/30 border-white/30 text-text-dark rounded-bl-sm">
                <div className="flex gap-2 items-center h-6">
                  <div className="w-2 h-2 rounded-full bg-text-dark/40 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-text-dark/40 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-text-dark/40 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </section>

        {/* 輸入區域 (底部的毛玻璃輸入框) */}
        <div className="w-full max-w-7xl glass-card rounded-full p-3 flex items-center gap-4 mb-4 shadow-xl">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !sessionId}
            placeholder="請寫下你今天生活中正在思考、最重要的一個個人問題..."
            className="flex-grow p-4 px-6 rounded-full bg-transparent focus:outline-none text-lg placeholder:text-text-dark placeholder:opacity-40 disabled:opacity-50"
          />
          <button 
            onClick={handleSendMessage}
            disabled={isLoading || !inputText.trim() || !sessionId}
            className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center border border-white/20 shadow-md transition-all duration-300 ${
              inputText.trim() && !isLoading ? 'bg-primary-lighter hover:scale-105 hover:rotate-12 cursor-pointer' : 'bg-white/30 opacity-50 cursor-not-allowed'
            }`}
          >
            <Send size={24} className="text-text-dark ml-1" />
          </button>
        </div>

        <footer className="mt-4 text-sm text-text-dark/40 text-center w-full max-w-7xl">
          <p>國立臺灣大學心理學系 實驗平台</p>
        </footer>
      </div>
    </>
  );
}