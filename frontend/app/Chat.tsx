"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, User, Clock3, Zap } from "lucide-react";

type Condition = "AI" | "Writing";
type Role = "user" | "assistant";

type Message = {
  role: Role;
  content: string;
};

type Props = {
  participant: string;
  condition: Condition;
};

const API_BASE = "http://localhost:8000";
const SESSION_SECONDS = 5 * 60;

export default function Chat({ participant, condition }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionPending, setSessionPending] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clockLabel, setClockLabel] = useState("");

  const participantTrimmed = useMemo(() => participant.trim(), [participant]);
  const endedRef = useRef(false);
  const warned30Ref = useRef(false);
  const isEnded = timeLeft <= 0;
  const isLast30Seconds = timeLeft > 0 && timeLeft <= 30;

  function getErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    return "Unknown error.";
  }

  useEffect(() => {
    const tick = () => {
      setClockLabel(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!participantTrimmed) {
      setError("Missing participant id.");
      setSessionPending(false);
      return;
    }

    let cancelled = false;

    async function startSession() {
      try {
        setError(null);
        const res = await fetch(`${API_BASE}/session/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participant: participantTrimmed, condition }),
        });
        if (!res.ok) throw new Error(`Failed to start session (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setSessionId(data.session_id);
        setStartTime(Date.now());
        setSessionPending(false);
      } catch (e: unknown) {
        if (cancelled) return;
        setSessionPending(false);
        setError(getErrorMessage(e) ?? "Failed to start session.");
      }
    }

    startSession();
    return () => {
      cancelled = true;
    };
  }, [participantTrimmed, condition]);

  useEffect(() => {
    if (!startTime) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = SESSION_SECONDS - elapsed;
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 250);

    return () => clearInterval(timer);
  }, [startTime]);

  function formatTime(seconds: number) {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  useEffect(() => {
    if (!sessionId) return;
    if (!isEnded) return;
    if (endedRef.current) return;
    endedRef.current = true;

    fetch(`${API_BASE}/session/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  }, [isEnded, sessionId]);

  useEffect(() => {
    if (!startTime) return;
    if (timeLeft <= 0 || timeLeft > 30) return;
    if (warned30Ref.current) return;
    warned30Ref.current = true;
    alert("提醒您：聊天時間只剩約 30 秒。");
  }, [timeLeft, startTime]);

  useEffect(() => {
    if (isEnded) setInput("");
  }, [isEnded]);

  const blockLeaving = !isEnded && (sessionId !== null || sessionPending);

  useEffect(() => {
    if (!blockLeaving) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [blockLeaving]);

  async function sendMessage() {
    const text = input.trim();
    if (!text) return;
    if (isEnded) return;
    if (isBusy) return;
    if (!sessionId) return;

    setError(null);
    setIsBusy(true);
    setInput("");

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          participant: participantTrimmed,
          condition,
          message: text,
        }),
      });
      if (!res.ok) throw new Error(`Chat failed (${res.status})`);
      const data = await res.json();
      const replyText = (data?.reply ?? "").toString();
      setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);
    } catch (e: unknown) {
      setError(getErrorMessage(e) ?? "Request failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center p-4 md:p-10 font-sans antialiased text-slate-900">
      <div className="w-full max-w-[400px] h-[812px] max-h-[90vh] bg-[#F8F9FB] rounded-[50px] shadow-2xl overflow-hidden border-[10px] border-white relative flex flex-col">
        <div className="p-6 pt-12 flex-shrink-0 bg-[#F8F9FB] z-10">
          <div className="flex justify-between items-center mb-6 text-sm font-semibold px-2">
            <span>{clockLabel || "—:—"}</span>
            <div className="flex gap-1.5 items-center">
              <Zap size={14} className="text-[#00D094]" />
              <span className="text-gray-400 font-normal">Condition: {condition}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 shrink-0">
                <User size={24} className="text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-widest">Participant</p>
                <p className="font-bold text-lg leading-tight truncate">{participantTrimmed}</p>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0 ml-2">
              <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                <Clock3 size={16} />
                <span className="text-xs font-medium">Time Left</span>
              </div>
              <span
                className={`font-mono text-3xl font-bold ${
                  isLast30Seconds ? "text-red-500 animate-pulse" : "text-slate-800"
                }`}
              >
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 flex-shrink-0 space-y-2">
          {error ? (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-200">
              ⚠️ {error}
            </div>
          ) : null}
          {sessionPending && !sessionId && !error ? (
            <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-sm font-medium border border-blue-200 flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
              Starting session…
            </div>
          ) : null}
          {sessionId && isLast30Seconds && !isEnded ? (
            <div
              role="alert"
              aria-live="polite"
              className="bg-[#fffbeb] text-[#92400e] p-3 rounded-xl text-sm font-semibold border border-[#b45309]"
            >
              時間即將結束：尚餘約 {Math.max(0, timeLeft)} 秒，請盡快完成訊息。
            </div>
          ) : null}
          {isEnded ? (
            <div
              role="status"
              aria-live="polite"
              className="bg-emerald-50 text-emerald-900 p-4 rounded-2xl text-[15px] font-semibold border border-emerald-200 text-center leading-relaxed"
            >
              今天紀錄已儲存，感謝你今天的參與！
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-20 flex flex-col items-center gap-4">
              <Zap size={48} className="text-[#00D094] opacity-50" />
              <p className="text-sm px-6">
                {isEnded
                  ? "今天紀錄已儲存，感謝你今天的參與！"
                  : "準備就緒，您可以開始發送訊息了。"}
              </p>
            </div>
          ) : null}

          {messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} className={`flex items-start gap-2.5 ${isUser ? "justify-end" : ""}`}>
                {!isUser ? (
                  <div className="w-9 h-9 flex-shrink-0 bg-green-50 rounded-full flex items-center justify-center border border-green-100 mt-0.5">
                    <Zap size={18} className="text-[#00D094]" />
                  </div>
                ) : null}
                <div
                  className={`p-4 rounded-2xl max-w-[80%] text-[15px] leading-relaxed ${
                    isUser
                      ? "bg-[#4F7FFF] text-white rounded-br-none shadow-[var(--shadow-soft)]"
                      : "bg-white text-slate-800 rounded-bl-none shadow-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 bg-[#F8F9FB] flex-shrink-0 z-10">
          <p className="text-[11px] text-gray-400 text-center mb-3 px-2">
            {blockLeaving ? "實驗進行中請勿關閉或重新整理此頁面；若離開，瀏覽器會再次確認。" : null}
          </p>
          <div className="bg-white rounded-full p-2 flex items-center shadow-md border border-slate-100">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={isEnded ? "時間已到，無法再輸入。" : "在此輸入您的想法…"}
              readOnly={isEnded}
              disabled={isEnded || !sessionId || isBusy}
              className="flex-1 px-4 py-2.5 text-sm bg-transparent outline-none placeholder:text-gray-300 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={isEnded || !sessionId || isBusy}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isEnded || isBusy
                  ? "bg-slate-100 text-gray-300"
                  : "bg-[#4F7FFF] text-white hover:bg-blue-600 active:scale-95 shadow-lg shadow-blue-200"
              }`}
            >
              {isBusy ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={20} fill="currentColor" className="ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {blockLeaving ? (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/5 rounded-full px-3 py-1 text-[11px] text-gray-400 whitespace-nowrap">
            實驗進行中請勿離開
          </div>
        ) : null}
      </div>
    </main>
  );
}
