"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { REVELATION_VERSES, BibleVerse } from "./revelation_data";

// Type for verse status
type ProgressStatus = "unlearned" | "reviewing" | "learned";

// Interface for user progress map
interface VerseProgress {
  [key: string]: ProgressStatus; // key format: "chapter:verse"
}

// Interface for user notes
interface VerseNotes {
  [key: string]: string; // key format: "chapter:verse"
}

// Daily study record
interface StudyRecord {
  date: string; // YYYY-MM-DD
  count: number; // verses studied/marked
}

export default function RevelationMemorizer() {
  // --- State Variables ---
  const [progress, setProgress] = useState<VerseProgress>({});
  const [notes, setNotes] = useState<VerseNotes>({});
  const [studyHistory, setStudyHistory] = useState<StudyRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "learn" | "blank" | "typing" | "read">("dashboard");
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Learn Tab State
  const [currentVerseIndex, setCurrentVerseIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<"all" | ProgressStatus>("all");

  // Blank Tab State
  const [blankDifficulty, setBlankDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [revealedBlanks, setRevealedBlanks] = useState<number[]>([]); // indexes of revealed words

  // Typing Tab State
  const [typingMode, setTypingMode] = useState<"initial" | "full">("initial");
  const [userInput, setUserInput] = useState<string>("");
  const [showTypingAnswer, setShowTypingAnswer] = useState<boolean>(false);

  // Read/TTS Tab State
  const [isPlayingTTS, setIsPlayingTTS] = useState<boolean>(false);
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [activeTtsVerse, setActiveTtsVerse] = useState<string | null>(null); // "chapter:verse"
  const [autoPlayTts, setAutoPlayTts] = useState<boolean>(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // --- Initialize LocalStorage and TTS ---
  useEffect(() => {
    // Load local storage data
    const savedProgress = localStorage.getItem("rev_progress");
    const savedNotes = localStorage.getItem("rev_notes");
    const savedHistory = localStorage.getItem("rev_history");
    const savedTheme = localStorage.getItem("rev_theme");

    if (savedProgress) setProgress(JSON.parse(savedProgress));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedHistory) setStudyHistory(JSON.parse(savedHistory));
    if (savedTheme) {
      setDarkMode(savedTheme === "dark");
    } else {
      // Default to dark mode
      setDarkMode(true);
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Update HTML class for theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("rev_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Helper to save progress helper
  const saveProgress = (newProgress: VerseProgress) => {
    setProgress(newProgress);
    localStorage.setItem("rev_progress", JSON.stringify(newProgress));

    // Update daily study log
    const today = new Date().toISOString().split("T")[0];
    setStudyHistory((prev) => {
      const idx = prev.findIndex((r) => r.date === today);
      let updated = [...prev];
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], count: updated[idx].count + 1 };
      } else {
        updated.push({ date: today, count: 1 });
      }
      localStorage.setItem("rev_history", JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateStatus = (chapter: number, verse: number, status: ProgressStatus) => {
    const key = `${chapter}:${verse}`;
    const newProgress = { ...progress, [key]: status };
    saveProgress(newProgress);
  };

  const handleSaveNote = (chapter: number, verse: number, text: string) => {
    const key = `${chapter}:${verse}`;
    const newNotes = { ...notes, [key]: text };
    setNotes(newNotes);
    localStorage.setItem("rev_notes", JSON.stringify(newNotes));
  };

  // --- Filtering & Memoized Lists ---
  const filteredVerses = useMemo(() => {
    return REVELATION_VERSES.filter((v) => {
      // Chapter filter
      if (selectedChapter !== 0 && v.chapter !== selectedChapter) return false;

      // Status filter
      const key = `${v.chapter}:${v.verse}`;
      const vStatus = progress[key] || "unlearned";
      if (filterStatus !== "all" && vStatus !== filterStatus) return false;

      // Search query filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesText = v.text.toLowerCase().includes(query);
        const matchesRef = `${v.chapter}장 ${v.verse}절`.includes(query) || `${v.chapter}:${v.verse}`.includes(query);
        const matchesNote = (notes[key] || "").toLowerCase().includes(query);
        if (!matchesText && !matchesRef && !matchesNote) return false;
      }

      return true;
    });
  }, [selectedChapter, filterStatus, searchQuery, progress, notes]);

  // Keep index in bounds when filtered list changes
  useEffect(() => {
    setCurrentVerseIndex(0);
    setIsFlipped(false);
    setUserInput("");
    setRevealedBlanks([]);
  }, [selectedChapter, filterStatus, searchQuery]);

  const currentVerse: BibleVerse | undefined = filteredVerses[currentVerseIndex];

  // --- Korean Initial Consonant Extractor (초성) ---
  const getInitials = (text: string): string => {
    const KOREAN_INITIALS = [
      "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
      "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
    ];
    
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i) - 44032;
      if (code >= 0 && code <= 11172) {
        const initialIdx = Math.floor(code / 588);
        result += KOREAN_INITIALS[initialIdx];
      } else {
        // Keep whitespace and punctuation as is
        result += text[i];
      }
    }
    return result;
  };

  // --- Dynamic Blank Masking Generator ---
  const blankedWords = useMemo(() => {
    if (!currentVerse) return [];
    const words = currentVerse.text.split(" ");
    
    // Deterministic mask based on verse key and selected difficulty
    return words.map((word, idx) => {
      // Strip punctuation for matching logic but keep it for display
      const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      
      // Short helper words are masked less
      if (cleanWord.length <= 1) return { text: word, isMasked: false };
      
      let step = 3; // Easy: mask every 3rd word
      if (blankDifficulty === "medium") step = 2; // Medium: mask every 2nd word
      if (blankDifficulty === "hard") step = 1.2; // Hard: mask almost everything
      
      const shouldMask = (idx + currentVerse.verse) % step < 1;
      return {
        text: word,
        isMasked: shouldMask
      };
    });
  }, [currentVerse, blankDifficulty]);

  // --- Text-to-Speech Controls ---
  const playTTS = (text: string, verseKey: string) => {
    if (!synthRef.current) return;

    if (isPlayingTTS) {
      synthRef.current.cancel();
    }

    const cleanText = text.replace(/\[\d+:\d+\]/g, ""); // strip markers
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ko-KR";
    utterance.rate = ttsSpeed;
    
    utterance.onstart = () => {
      setIsPlayingTTS(true);
      setActiveTtsVerse(verseKey);
    };

    utterance.onend = () => {
      setIsPlayingTTS(false);
      setActiveTtsVerse(null);
      
      // Auto play next verse logic
      if (autoPlayTts && currentVerseIndex < filteredVerses.length - 1) {
        setCurrentVerseIndex((prev) => prev + 1);
        // Play next in microtask to let index state resolve
        setTimeout(() => {
          const next = filteredVerses[currentVerseIndex + 1];
          if (next) {
            playTTS(next.text, `${next.chapter}:${next.verse}`);
          }
        }, 100);
      }
    };

    utterance.onerror = () => {
      setIsPlayingTTS(false);
      setActiveTtsVerse(null);
    };

    activeUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const stopTTS = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlayingTTS(false);
      setActiveTtsVerse(null);
    }
  };

  // --- Typing Matching feedback helper ---
  const getTypingFeedback = () => {
    if (!currentVerse) return null;
    const target = typingMode === "initial" ? getInitials(currentVerse.text) : currentVerse.text;
    
    // Normalize spaces and characters
    const normalizedInput = userInput.trim().replace(/\s+/g, " ");
    const normalizedTarget = target.trim().replace(/\s+/g, " ");

    if (normalizedInput === "") return null;

    let isMatch = normalizedTarget.startsWith(normalizedInput);
    let isComplete = normalizedTarget === normalizedInput;

    return {
      isMatch,
      isComplete,
      targetLength: normalizedTarget.length,
      inputLength: normalizedInput.length
    };
  };

  // --- Progress Stats Calculation ---
  const stats = useMemo(() => {
    const total = REVELATION_VERSES.length;
    let learned = 0;
    let reviewing = 0;
    let unlearned = 0;

    REVELATION_VERSES.forEach((v) => {
      const key = `${v.chapter}:${v.verse}`;
      const status = progress[key] || "unlearned";
      if (status === "learned") learned++;
      else if (status === "reviewing") reviewing++;
      else unlearned++;
    });

    const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
    
    // Chapter breakdown
    const chapterStats = Array.from({ length: 22 }, (_, i) => {
      const chNum = i + 1;
      const chVerses = REVELATION_VERSES.filter((v) => v.chapter === chNum);
      const chTotal = chVerses.length;
      let chLearned = 0;
      chVerses.forEach((v) => {
        if (progress[`${v.chapter}:${v.verse}`] === "learned") chLearned++;
      });
      return {
        chapter: chNum,
        total: chTotal,
        learned: chLearned,
        percent: chTotal > 0 ? Math.round((chLearned / chTotal) * 100) : 0
      };
    });

    return {
      total,
      learned,
      reviewing,
      unlearned,
      percent,
      chapterStats
    };
  }, [progress]);

  // Calculate Streak
  const currentStreak = useMemo(() => {
    if (studyHistory.length === 0) return 0;
    
    const dates = studyHistory
      .filter((r) => r.count > 0)
      .map((r) => r.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // descending order (newest first)
      
    if (dates.length === 0) return 0;
    
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // If they haven't studied today or yesterday, streak is broken
    if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;

    let streak = 1;
    let currentDate = new Date(dates[0]);

    for (let i = 1; i < dates.length; i++) {
      const nextDate = new Date(dates[i]);
      const diffTime = Math.abs(currentDate.getTime() - nextDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        streak++;
        currentDate = nextDate;
      } else if (diffDays > 1) {
        break; // Streak broken
      }
    }
    return streak;
  }, [studyHistory]);

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${darkMode ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"}`}>
      {/* --- HEADER --- */}
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors duration-300 ${darkMode ? "bg-zinc-900/80 border-zinc-800" : "bg-white/80 border-slate-200"}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">요한계시록 암기 플래너</h1>
              <p className="text-xs text-zinc-400">말씀 마음에 새기기 - 22장 404구절 전체 내장형</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex bg-zinc-800/50 p-1 rounded-lg border border-zinc-700/50 text-xs sm:text-sm">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${activeTab === "dashboard" ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              대시보드
            </button>
            <button
              onClick={() => setActiveTab("learn")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${activeTab === "learn" ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              플래시카드
            </button>
            <button
              onClick={() => setActiveTab("blank")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${activeTab === "blank" ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              빈칸연습
            </button>
            <button
              onClick={() => setActiveTab("typing")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${activeTab === "typing" ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              타이핑테스트
            </button>
            <button
              onClick={() => setActiveTab("read")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${activeTab === "read" ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              성경독서
            </button>
          </nav>

          {/* Theme & Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors border ${darkMode ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-yellow-400" : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"}`}
              title="테마 변경"
            >
              {darkMode ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828 0l-.707-.707m12.828-12.828l-.707-.707M8.364 8.364l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN LAYOUT --- */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* --- GLOBAL SEARCH & CHAPTER BAR --- */}
        {activeTab !== "dashboard" && (
          <div className={`p-4 mb-6 rounded-2xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-850" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Chapter selection drop down & query */}
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">장 선택</label>
                  <select
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(parseInt(e.target.value))}
                    className={`px-3 py-2 rounded-xl border font-medium outline-none text-sm ${darkMode ? "bg-zinc-800 border-zinc-700 text-white" : "bg-slate-100 border-slate-200 text-slate-800"}`}
                  >
                    <option value={0}>전체 (1~22장)</option>
                    {Array.from({ length: 22 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        요한계시록 {i + 1}장
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">암기 상태 필터</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className={`px-3 py-2 rounded-xl border font-medium outline-none text-sm ${darkMode ? "bg-zinc-800 border-zinc-700 text-white" : "bg-slate-100 border-slate-200 text-slate-800"}`}
                  >
                    <option value="all">전체 상태</option>
                    <option value="unlearned">🔴 미학습</option>
                    <option value="reviewing">🟡 복습 중</option>
                    <option value="learned">🟢 암기 완료</option>
                  </select>
                </div>
              </div>

              {/* Real-time search */}
              <div className="flex-1 max-w-md">
                <label className="block text-xs font-semibold text-zinc-400 mb-1">구절 및 메모 검색</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="예: 생명나무, 새 예루살렘, 12:1..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 rounded-xl border outline-none text-sm transition-all duration-300 ${darkMode ? "bg-zinc-800 border-zinc-700 text-white focus:border-emerald-500" : "bg-slate-100 border-slate-200 text-slate-800 focus:border-emerald-500"}`}
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  </div>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sub-status counts */}
            <div className="mt-4 pt-3 border-t border-zinc-800/50 flex items-center justify-between text-xs text-zinc-400">
              <div>
                검색 필터 결과: <span className="font-semibold text-emerald-400">{filteredVerses.length}</span>구절 / 전체 404구절
              </div>
              {filteredVerses.length > 0 && activeTab !== "read" && (
                <div className="flex gap-2">
                  <span className="bg-zinc-800 px-2 py-1 rounded">
                    현재 구절 위치: {currentVerseIndex + 1} / {filteredVerses.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 1: DASHBOARD --- */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Overall stats card */}
            <div className={`p-6 rounded-3xl border lg:col-span-1 flex flex-col justify-between transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div>
                <h3 className="text-lg font-bold mb-4">전체 암송 진척도</h3>
                
                {/* Visual circular progress or big number */}
                <div className="flex items-center justify-center py-6">
                  <div className="relative w-40 h-40">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {/* background circle */}
                      <circle
                        className={`${darkMode ? "text-zinc-800" : "text-slate-100"}`}
                        strokeWidth="10"
                        stroke="currentColor"
                        fill="transparent"
                        r="38"
                        cx="50"
                        cy="50"
                      />
                      {/* progress circle */}
                      <circle
                        className="text-emerald-500 transition-all duration-1000 ease-out"
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 38}
                        strokeDashoffset={2 * Math.PI * 38 * (1 - stats.percent / 100)}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="38"
                        cx="50"
                        cy="50"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-extrabold">{stats.percent}%</span>
                      <span className="text-xs text-zinc-400 mt-1">암기 완료</span>
                    </div>
                  </div>
                </div>

                {/* Details list */}
                <div className="space-y-3 mt-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2 text-zinc-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>암기 완료
                    </span>
                    <span className="font-bold">{stats.learned} 구절</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2 text-zinc-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>복습 필요
                    </span>
                    <span className="font-bold">{stats.reviewing} 구절</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2 text-zinc-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>미학습
                    </span>
                    <span className="font-bold">{stats.unlearned} / {stats.total} 구절</span>
                  </div>
                </div>
              </div>

              {/* Streak Card */}
              <div className="mt-6 p-4 rounded-2xl bg-gradient-to-tr from-amber-600/10 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🔥</div>
                  <div>
                    <h4 className="text-sm font-bold">연속 학습 스트리크</h4>
                    <p className="text-xs text-zinc-400">매일 성경 말씀을 암송해 보세요</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-amber-500">{currentStreak}</span>
                  <span className="text-xs text-zinc-400 ml-1">일째</span>
                </div>
              </div>
            </div>

            {/* Right: Chapter list breakdown */}
            <div className={`p-6 rounded-3xl border lg:col-span-2 transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">장별 진척 현황</h3>
                <span className="text-xs text-zinc-400">클릭하여 해당 장으로 빠른 학습 이동</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                {stats.chapterStats.map((ch) => (
                  <button
                    key={ch.chapter}
                    onClick={() => {
                      setSelectedChapter(ch.chapter);
                      setActiveTab("learn");
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.02] ${darkMode ? "bg-zinc-800/40 border-zinc-700/60 hover:bg-zinc-800" : "bg-slate-50 border-slate-200 hover:bg-slate-100"}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm">{ch.chapter}장</span>
                      <span className="text-xs font-semibold text-emerald-400">{ch.percent}%</span>
                    </div>
                    <div className="w-full bg-zinc-700/40 h-2 rounded-full overflow-hidden mb-1.5">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${ch.percent}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] text-zinc-400 flex justify-between">
                      <span>완료: {ch.learned}구절</span>
                      <span>전체: {ch.total}구절</span>
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Quick Start Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setSelectedChapter(1);
                    setActiveTab("learn");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-emerald-500/20"
                >
                  🚀 1장부터 암기 시작하기
                </button>
                <button
                  onClick={() => {
                    // Find first unlearned chapter
                    const firstUnlearned = stats.chapterStats.find(c => c.percent < 100);
                    setSelectedChapter(firstUnlearned ? firstUnlearned.chapter : 1);
                    setActiveTab("learn");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-sm transition-colors"
                >
                  📖 이어서 복습하기
                </button>
              </div>
            </div>

          </div>
        )}

        {/* --- NO MATCHES FALLBACK FOR ACTIVE LEARNING TABS --- */}
        {activeTab !== "dashboard" && filteredVerses.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-bold">일치하는 성경 구절이 없습니다.</h3>
            <p className="text-sm text-zinc-400 mt-1">필터를 조정하거나 다른 검색어를 입력해 보세요.</p>
            <button
              onClick={() => {
                setSelectedChapter(1);
                setFilterStatus("all");
                setSearchQuery("");
              }}
              className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm rounded-xl"
            >
              필터 초기화
            </button>
          </div>
        )}

        {/* --- TAB 2: FLASHCARD LEARNING --- */}
        {activeTab === "learn" && currentVerse && (
          <div className="max-w-2xl mx-auto">
            
            {/* Flashcard container */}
            <div className="perspective-1000 w-full min-h-[280px] mb-6 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`relative w-full h-full min-h-[280px] duration-500 preserve-3d ${isFlipped ? "rotate-y-180" : ""}`}>
                
                {/* Front of Card (Verse Reference) */}
                <div className={`absolute inset-0 w-full h-full p-8 rounded-3xl border flex flex-col justify-between backface-hidden transition-all duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800 hover:border-zinc-750" : "bg-white border-slate-200 hover:border-slate-300 shadow-lg"}`}>
                  <div className="flex justify-between items-center">
                    <span className="px-3 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      요한계시록
                    </span>
                    <span className="text-xs text-zinc-400">클릭하여 펼치기</span>
                  </div>

                  <div className="text-center my-auto py-8">
                    <h2 className="text-4xl font-extrabold tracking-tight">
                      {currentVerse.chapter}장 {currentVerse.verse}절
                    </h2>
                    <p className="text-zinc-500 text-sm mt-3">마음속으로 구절을 암송한 뒤 카드를 뒤집어 확인해 보세요.</p>
                  </div>

                  <div className="flex justify-between items-center text-xs text-zinc-400">
                    <span>구절 번호: {currentVerseIndex + 1} / {filteredVerses.length}</span>
                    <span className="flex items-center gap-1.5">
                      상태: {progress[`${currentVerse.chapter}:${currentVerse.verse}`] === "learned" ? "🟢 암기완료" : progress[`${currentVerse.chapter}:${currentVerse.verse}`] === "reviewing" ? "🟡 복습중" : "🔴 미학습"}
                    </span>
                  </div>
                </div>

                {/* Back of Card (Verse Text) */}
                <div className={`absolute inset-0 w-full h-full p-8 rounded-3xl border flex flex-col justify-between rotate-y-180 backface-hidden transition-all duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-lg"}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-emerald-400">
                      {currentVerse.chapter}장 {currentVerse.verse}절
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // prevent card flip
                        playTTS(currentVerse.text, `${currentVerse.chapter}:${currentVerse.verse}`);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="구절 읽어주기"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75V5.25L7.75 9.5H4.5v5h3.25L12 18.75z"></path></svg>
                    </button>
                  </div>

                  <div className="my-auto py-4">
                    <p className="text-xl sm:text-2xl leading-relaxed font-medium text-center break-keep tracking-wide">
                      {currentVerse.text}
                    </p>
                  </div>

                  {/* Status Indicator */}
                  <div className="text-right text-xs text-zinc-400">
                    클릭하여 다시 카드 뒤집기
                  </div>
                </div>

              </div>
            </div>

            {/* Quick Status Setting Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                onClick={() => handleUpdateStatus(currentVerse.chapter, currentVerse.verse, "unlearned")}
                className={`py-3 rounded-2xl border font-bold text-xs sm:text-sm transition-all duration-200 ${progress[`${currentVerse.chapter}:${currentVerse.verse}`] === "unlearned" || !progress[`${currentVerse.chapter}:${currentVerse.verse}`] ? "bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-zinc-850 hover:bg-zinc-800 border-zinc-750 text-rose-500"}`}
              >
                🔴 미학습으로 분류
              </button>
              <button
                onClick={() => handleUpdateStatus(currentVerse.chapter, currentVerse.verse, "reviewing")}
                className={`py-3 rounded-2xl border font-bold text-xs sm:text-sm transition-all duration-200 ${progress[`${currentVerse.chapter}:${currentVerse.verse}`] === "reviewing" ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-zinc-850 hover:bg-zinc-800 border-zinc-750 text-amber-500"}`}
              >
                🟡 복습 중으로 분류
              </button>
              <button
                onClick={() => handleUpdateStatus(currentVerse.chapter, currentVerse.verse, "learned")}
                className={`py-3 rounded-2xl border font-bold text-xs sm:text-sm transition-all duration-200 ${progress[`${currentVerse.chapter}:${currentVerse.verse}`] === "learned" ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-zinc-850 hover:bg-zinc-800 border-zinc-750 text-emerald-500"}`}
              >
                🟢 암기 완료!
              </button>
            </div>

            {/* Prev/Next Navigation Controls */}
            <div className="flex items-center justify-between gap-4">
              <button
                disabled={currentVerseIndex === 0}
                onClick={() => {
                  setCurrentVerseIndex((prev) => prev - 1);
                  setIsFlipped(false);
                  stopTTS();
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-zinc-850 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                이전 구절
              </button>

              <div className="text-center text-sm font-semibold text-zinc-400">
                {currentVerse.chapter}:{currentVerse.verse}
              </div>

              <button
                disabled={currentVerseIndex === filteredVerses.length - 1}
                onClick={() => {
                  setCurrentVerseIndex((prev) => prev + 1);
                  setIsFlipped(false);
                  stopTTS();
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-zinc-850 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm"
              >
                다음 구절
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
              </button>
            </div>

            {/* Note taking textarea */}
            <div className={`mt-6 p-4 rounded-2xl border ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}`}>
              <label className="block text-xs font-bold text-zinc-400 mb-2">💡 개인 메모 및 묵상</label>
              <textarea
                placeholder="이 구절에 관한 암기 요령이나 묵상 내용을 자유롭게 기록하세요..."
                value={notes[`${currentVerse.chapter}:${currentVerse.verse}`] || ""}
                onChange={(e) => handleSaveNote(currentVerse.chapter, currentVerse.verse, e.target.value)}
                className={`w-full p-3 text-sm rounded-xl border outline-none min-h-[90px] ${darkMode ? "bg-zinc-800 border-zinc-700 text-white" : "bg-slate-50 border-slate-200 text-slate-800"}`}
              />
            </div>
          </div>
        )}

        {/* --- TAB 3: BLANK PRACTICE --- */}
        {activeTab === "blank" && currentVerse && (
          <div className="max-w-2xl mx-auto">
            
            {/* Header info */}
            <div className={`p-6 rounded-3xl border mb-6 transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-emerald-400">
                  요한계시록 {currentVerse.chapter}장 {currentVerse.verse}절
                </h3>
                
                {/* Difficulty tabs */}
                <div className="flex bg-zinc-800 p-0.5 rounded-lg border border-zinc-700 text-xs">
                  {(["easy", "medium", "hard"] as const).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => {
                        setBlankDifficulty(diff);
                        setRevealedBlanks([]);
                      }}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${blankDifficulty === diff ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                      {diff === "easy" ? "쉬움" : diff === "medium" ? "보통" : "어려움"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic text rendering with blanks */}
              <div className="text-xl sm:text-2xl leading-loose font-medium text-center py-6 select-none flex flex-wrap gap-x-2 gap-y-3 justify-center">
                {blankedWords.map((word, idx) => {
                  const isRevealed = revealedBlanks.includes(idx);
                  if (word.isMasked && !isRevealed) {
                    return (
                      <span
                        key={idx}
                        onClick={() => setRevealedBlanks([...revealedBlanks, idx])}
                        className="px-3 bg-zinc-700/60 hover:bg-zinc-600 text-transparent border-b-2 border-emerald-500 rounded cursor-pointer transition-colors select-none"
                        title="클릭하여 단어 보기"
                      >
                        {word.text.replace(/./g, "?")}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={idx}
                      onClick={() => {
                        // Let them mask it back
                        if (word.isMasked) {
                          setRevealedBlanks(revealedBlanks.filter((item) => item !== idx));
                        }
                      }}
                      className={`transition-all duration-200 ${word.isMasked ? "text-emerald-400 border-b-2 border-dashed border-emerald-400/50" : ""}`}
                    >
                      {word.text}
                    </span>
                  );
                })}
              </div>

              <div className="text-center text-xs text-zinc-400 mt-2">
                💡 회색 빈칸을 클릭하면 숨겨진 단어가 보입니다. 다시 클릭하면 숨길 수 있습니다.
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex justify-between gap-4 mb-6">
              <button
                onClick={() => setRevealedBlanks([])}
                className="px-4 py-2.5 rounded-xl border border-zinc-750 text-zinc-400 hover:text-zinc-200 text-xs sm:text-sm font-semibold"
              >
                🔄 전체 빈칸 다시 가리기
              </button>

              <button
                onClick={() => setRevealedBlanks(Array.from({ length: blankedWords.length }, (_, i) => i))}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs sm:text-sm font-semibold"
              >
                👁️ 모든 정답 확인
              </button>
            </div>

            {/* Navigation Bar */}
            <div className="flex items-center justify-between gap-4">
              <button
                disabled={currentVerseIndex === 0}
                onClick={() => {
                  setCurrentVerseIndex((prev) => prev - 1);
                  setRevealedBlanks([]);
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-zinc-850 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                이전 구절
              </button>

              <div className="text-center text-sm font-semibold text-zinc-400">
                구절: {currentVerseIndex + 1} / {filteredVerses.length}
              </div>

              <button
                disabled={currentVerseIndex === filteredVerses.length - 1}
                onClick={() => {
                  setCurrentVerseIndex((prev) => prev + 1);
                  setRevealedBlanks([]);
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-zinc-850 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm"
              >
                다음 구절
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
              </button>
            </div>

          </div>
        )}

        {/* --- TAB 4: TYPING TEST --- */}
        {activeTab === "typing" && currentVerse && (
          <div className="max-w-2xl mx-auto">
            
            <div className={`p-6 rounded-3xl border mb-6 transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-bold text-emerald-400">
                  타이핑 연습 - {currentVerse.chapter}장 {currentVerse.verse}절
                </h3>
                
                {/* Mode toggle */}
                <div className="flex bg-zinc-800 p-0.5 rounded-lg border border-zinc-700 text-xs">
                  <button
                    onClick={() => {
                      setTypingMode("initial");
                      setUserInput("");
                    }}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${typingMode === "initial" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                  >
                    초성 매칭
                  </button>
                  <button
                    onClick={() => {
                      setTypingMode("full");
                      setUserInput("");
                    }}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${typingMode === "full" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                  >
                    전체 텍스트
                  </button>
                </div>
              </div>

              {/* Initial display hint for consonant mode */}
              {typingMode === "initial" && (
                <div className="mb-4 p-3 rounded-xl bg-zinc-850/60 border border-zinc-800/80 text-center">
                  <span className="text-xs text-zinc-400 block mb-1">초성 힌트</span>
                  <span className="text-base font-bold tracking-widest text-emerald-300">
                    {getInitials(currentVerse.text)}
                  </span>
                </div>
              )}

              {/* Input field */}
              <div className="mb-4">
                <textarea
                  placeholder={
                    typingMode === "initial"
                      ? "화면에 표시된 초성에 맞춰 타이핑해 보세요..."
                      : "요한계시록 구절 전체 텍스트를 정확하게 입력해 보세요..."
                  }
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className={`w-full p-4 text-base rounded-xl border outline-none min-h-[110px] transition-all duration-300 ${
                    userInput === ""
                      ? darkMode
                        ? "bg-zinc-800 border-zinc-700"
                        : "bg-slate-50 border-slate-200"
                      : getTypingFeedback()?.isMatch
                      ? getTypingFeedback()?.isComplete
                        ? "bg-emerald-950/20 border-emerald-500 text-emerald-300"
                        : "bg-zinc-800 border-emerald-600 text-zinc-200"
                      : "bg-rose-950/20 border-rose-600 text-rose-300"
                  }`}
                />
              </div>

              {/* Match Feedback status */}
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div>
                  {userInput !== "" && (
                    <span className="font-semibold">
                      {getTypingFeedback()?.isMatch ? (
                        getTypingFeedback()?.isComplete ? (
                          <span className="text-emerald-400">🎉 완벽하게 암송하셨습니다!</span>
                        ) : (
                          <span className="text-emerald-400">✅ 올바르게 입력하고 있습니다...</span>
                        )
                      ) : (
                        <span className="text-rose-500">❌ 오타가 있습니다. 텍스트를 확인하세요.</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="text-zinc-400">
                  글자 수: {userInput.length} / {typingMode === "initial" ? getInitials(currentVerse.text).length : currentVerse.text.length}
                </div>
              </div>
            </div>

            {/* Answer & Control panel */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <button
                onClick={() => setShowTypingAnswer(!showTypingAnswer)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs sm:text-sm rounded-xl border border-zinc-700"
              >
                {showTypingAnswer ? "👁️ 정답 숨기기" : "👁️ 정답 구절 보기"}
              </button>

              <button
                onClick={() => setUserInput("")}
                className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs sm:text-sm rounded-xl"
              >
                다시 쓰기
              </button>
            </div>

            {showTypingAnswer && (
              <div className={`p-4 mb-6 rounded-2xl border border-dashed transition-colors duration-300 ${darkMode ? "bg-emerald-950/10 border-emerald-800" : "bg-emerald-50 border-emerald-200"}`}>
                <span className="text-xs font-bold text-emerald-400 block mb-1">정답 구절</span>
                <p className="text-base font-semibold leading-relaxed break-keep">
                  {currentVerse.text}
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
              <button
                disabled={currentVerseIndex === 0}
                onClick={() => {
                  setCurrentVerseIndex((prev) => prev - 1);
                  setUserInput("");
                  setShowTypingAnswer(false);
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-zinc-850 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                이전 구절
              </button>

              <button
                disabled={currentVerseIndex === filteredVerses.length - 1}
                onClick={() => {
                  // If they finished correctly, auto mark as learned!
                  const feed = getTypingFeedback();
                  if (feed?.isComplete) {
                    handleUpdateStatus(currentVerse.chapter, currentVerse.verse, "learned");
                  }
                  setCurrentVerseIndex((prev) => prev + 1);
                  setUserInput("");
                  setShowTypingAnswer(false);
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-md"
              >
                다음 구절
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
              </button>
            </div>

          </div>
        )}

        {/* --- TAB 5: BIBLE READER --- */}
        {activeTab === "read" && (
          <div className="max-w-4xl mx-auto">
            
            {/* TTS Toolbar */}
            <div className={`p-4 mb-6 rounded-2xl border flex flex-wrap items-center justify-between gap-4 transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-zinc-400">오디오 낭독 (TTS)</span>
                {isPlayingTTS ? (
                  <button
                    onClick={stopTTS}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    ⏹️ 낭독 중단
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (filteredVerses.length > 0) {
                        const first = filteredVerses[currentVerseIndex] || filteredVerses[0];
                        playTTS(first.text, `${first.chapter}:${first.verse}`);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    ▶️ 연속 낭독 시작
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-zinc-400">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoPlayTts}
                    onChange={(e) => setAutoPlayTts(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  끝나면 자동 다음 구절 읽기
                </label>

                <div className="flex items-center gap-2">
                  <span>속도:</span>
                  <select
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-white"
                  >
                    <option value={0.8}>0.8x</option>
                    <option value={1.0}>1.0x (보통)</option>
                    <option value={1.2}>1.2x</option>
                    <option value={1.5}>1.5x</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Distraction-Free Reader Content */}
            <div className={`p-8 rounded-3xl border min-h-[400px] transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="max-w-2xl mx-auto space-y-8">
                
                <div className="text-center mb-8 border-b border-zinc-800/80 pb-6">
                  <h2 className="text-3xl font-extrabold">
                    {selectedChapter === 0 ? "요한계시록 전체 구절" : `요한계시록 ${selectedChapter}장`}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-2">구절 앞 기호를 클릭해 암기 상태를 쉽게 변경하거나 오디오로 들을 수 있습니다.</p>
                </div>

                <div className="space-y-6">
                  {filteredVerses.map((v, idx) => {
                    const key = `${v.chapter}:${v.verse}`;
                    const status = progress[key] || "unlearned";
                    const hasNote = !!notes[key];
                    const isTtsActive = activeTtsVerse === key;

                    return (
                      <div
                        key={key}
                        className={`group p-4 rounded-2xl transition-all duration-300 border flex flex-col md:flex-row md:items-start gap-4 ${
                          isTtsActive
                            ? "bg-emerald-950/20 border-emerald-500 shadow-md scale-[1.01]"
                            : darkMode
                            ? "bg-zinc-850/30 border-transparent hover:bg-zinc-850 hover:border-zinc-800"
                            : "bg-slate-50/50 border-transparent hover:bg-slate-100/70 hover:border-slate-200"
                        }`}
                      >
                        {/* verse controllers */}
                        <div className="flex items-center md:flex-col gap-2 min-w-[70px]">
                          <span className="text-sm font-extrabold text-emerald-400">
                            {v.chapter}:{v.verse}
                          </span>
                          
                          {/* status button toggle */}
                          <button
                            onClick={() => {
                              const nextStatusMap: { [key in ProgressStatus]: ProgressStatus } = {
                                unlearned: "reviewing",
                                reviewing: "learned",
                                learned: "unlearned"
                              };
                              handleUpdateStatus(v.chapter, v.verse, nextStatusMap[status]);
                            }}
                            className="p-1 rounded text-xs"
                            title="클릭하여 상태 전환"
                          >
                            {status === "learned" ? "🟢" : status === "reviewing" ? "🟡" : "🔴"}
                          </button>

                          {/* audio play button */}
                          <button
                            onClick={() => playTTS(v.text, key)}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-zinc-700 transition-opacity"
                            title="이 구절 낭독"
                          >
                            🔊
                          </button>
                        </div>

                        {/* verse text */}
                        <div className="flex-1">
                          <p className="text-lg leading-relaxed break-keep font-medium select-text">
                            {v.text}
                          </p>
                          
                          {/* Note indicators */}
                          {hasNote && (
                            <div className="mt-2 text-xs text-amber-400/90 italic bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                              📝 {notes[key]}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

      {/* --- FOOTER --- */}
      <footer className={`mt-12 py-8 border-t text-center text-xs text-zinc-500 transition-colors duration-300 ${darkMode ? "bg-zinc-950 border-zinc-900" : "bg-slate-100 border-slate-200"}`}>
        <p className="mb-2">요한계시록 암기 플래너 | 1장 1절 ~ 22장 21절 (404구절)</p>
        <p>© 2026 Revelation Memorizer. 말씀과 동행하는 삶을 응원합니다.</p>
      </footer>
    </div>
  );
}
