"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { REVELATION_VERSES, BibleVerse, isKeyVerse } from "./revelation_data";

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

interface StudyPlan {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  excludeWeekends: boolean;
  excludeHolidays: boolean;
  totalDays: number;
  schedule: {
    day: number;
    date: string; // YYYY-MM-DD
    verseIndices: number[]; // indices in REVELATION_VERSES
  }[];
}

// Helper to identify weekends and Korean national holidays
const isRestDay = (dateStr: string, excludeWeekends: boolean, excludeHolidays: boolean): boolean => {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay(); // 0: Sun, 6: Sat

  if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return true;
  }

  if (excludeHolidays) {
    const mmDd = dateStr.substring(5, 10); // "MM-DD"
    const solarHolidays = [
      "01-01", // 신정
      "03-01", // 삼일절
      "05-05", // 어린이날
      "06-06", // 현충일
      "08-15", // 광복절
      "10-03", // 개천절
      "10-09", // 한글날
      "12-25"  // 성탄절
    ];

    if (solarHolidays.includes(mmDd)) {
      return true;
    }

    const lunarHolidays = [
      // 2026
      "2026-02-16", "2026-02-17", "2026-02-18", // 설날 연휴
      "2026-05-24", // 부처님오신날
      "2026-09-24", "2026-09-25", "2026-09-26", // 추석 연휴
      // 2027
      "2027-02-06", "2027-02-07", "2027-02-08", // 설날 연휴
      "2027-05-13", // 부처님오신날
      "2027-09-14", "2027-09-15", "2027-09-16"  // 추석 연휴
    ];

    if (lunarHolidays.includes(dateStr)) {
      return true;
    }
  }

  return false;
};

// Helper to get Korean day of week
const getDayOfWeek = (dateStr: string): string => {
  const week = ["일", "월", "화", "수", "목", "금", "토"];
  return week[new Date(dateStr).getDay()];
};

export default function RevelationMemorizer() {
  // --- State Variables ---
  const [progress, setProgress] = useState<VerseProgress>({});
  const [notes, setNotes] = useState<VerseNotes>({});
  const [studyHistory, setStudyHistory] = useState<StudyRecord[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [setupStartDate, setSetupStartDate] = useState<string>("");
  const [setupEndDate, setSetupEndDate] = useState<string>("");
  const [setupExcWk, setSetupExcWk] = useState<boolean>(true);
  const [setupExcHol, setSetupExcHol] = useState<boolean>(true);

  // Live calculation of net study days and avg verses count
  const setupPreviewStats = useMemo(() => {
    if (!setupStartDate || !setupEndDate) return { netDays: 0, avgVerses: "0" };
    let activeDaysCount = 0;
    const curr = new Date(setupStartDate);
    const last = new Date(setupEndDate);

    while (curr <= last) {
      const dateStr = curr.toISOString().split("T")[0];
      if (!isRestDay(dateStr, setupExcWk, setupExcHol)) {
        activeDaysCount++;
      }
      curr.setDate(curr.getDate() + 1);
    }

    const avg = activeDaysCount > 0 ? (404 / activeDaysCount).toFixed(1) : "0";
    return { netDays: activeDaysCount, avgVerses: avg };
  }, [setupStartDate, setupEndDate, setupExcWk, setupExcHol]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "planner" | "read" | "key-verses" | "practice">("dashboard");
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [keyVersesSelectedChapter, setKeyVersesSelectedChapter] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // --- Daily Planner States ---
  const [completedDays, setCompletedDays] = useState<{ [key: number]: boolean }>({});
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [dayStudyStep, setDayStudyStep] = useState<"study" | "test" | "complete">("study");
  const [dayTestAnswers, setDayTestAnswers] = useState<string[]>(["", "", "", "", ""]);
  const [dayTestMode, setDayTestMode] = useState<"initial" | "full">("initial");
  const [activeTestVerseIdx, setActiveTestVerseIdx] = useState<number>(0);
  const [revealStudyText, setRevealStudyText] = useState<boolean[]>([true, true, true, true, true]);

  // --- Chapter Test States ---
  const [activeChapterTest, setActiveChapterTest] = useState<number | null>(null);
  const [chapterTestAnswers, setChapterTestAnswers] = useState<string[]>([]);
  const [activeChapterTestIdx, setActiveChapterTestIdx] = useState<number>(0);
  const [chapterTestMode, setChapterTestMode] = useState<"initial" | "full">("initial");
  const [showChapterTestAnswer, setShowChapterTestAnswer] = useState<boolean>(false);
  const [isKeyVerseTestOnly, setIsKeyVerseTestOnly] = useState<boolean>(false);

  // --- New Key Verse Test States ---
  const [keyVerseAnswers, setKeyVerseAnswers] = useState<{ [key: string]: string }>({});
  const [keyVerseScoreStatus, setKeyVerseScoreStatus] = useState<{ [key: string]: { isMatch: boolean; isComplete: boolean } | null }>({});
  const [keyVerseStudyReveal, setKeyVerseStudyReveal] = useState<{ [key: string]: boolean }>({});
  const [keyVerseTestModeGlobal, setKeyVerseTestModeGlobal] = useState<"full" | "initial">("full");
  const [hideAllKeyVerseText, setHideAllKeyVerseText] = useState<boolean>(false);
  const [individualReveal, setIndividualReveal] = useState<{ [key: string]: boolean }>({});

  // --- Practice Tab States (Self Learning) ---
  const [practiceSubTab, setPracticeSubTab] = useState<"card" | "blank" | "typing">("card");
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState<number>(0);
  const [isPracticeCardFlipped, setIsPracticeCardFlipped] = useState<boolean>(false);
  const [practiceFilterStatus, setPracticeFilterStatus] = useState<"all" | ProgressStatus>("all");

  // Blank Sub-State
  const [blankDifficulty, setBlankDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [revealedBlanks, setRevealedBlanks] = useState<number[]>([]);

  // Typing Sub-State
  const [typingMode, setTypingMode] = useState<"initial" | "full">("initial");
  const [practiceUserInput, setPracticeUserInput] = useState<string>("");
  const [showPracticeAnswer, setShowPracticeAnswer] = useState<boolean>(false);

  // --- Login-based Sync States ---
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [loggedInUser, setLoggedInUser] = useState<string>("");
  const [sessionToken, setSessionToken] = useState<string>("");
  const [loginId, setLoginId] = useState<string>("");
  const [loginPw, setLoginPw] = useState<string>("");
  const [loginPwConfirm, setLoginPwConfirm] = useState<string>("");
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [showPw, setShowPw] = useState<boolean>(false);
  const [showPwConfirm, setShowPwConfirm] = useState<boolean>(false);
  const [syncLoading, setSyncLoading] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");

  // --- TTS State ---
  const [isPlayingTTS, setIsPlayingTTS] = useState<boolean>(false);
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [activeTtsVerse, setActiveTtsVerse] = useState<string | null>(null);
  const [autoPlayTts, setAutoPlayTts] = useState<boolean>(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // --- Auto-auth Default User logic ---
  const ensureDefaultUser = async () => {
    const defaultUsername = "bible_study_user";
    const defaultPassword = "default_password_rev_study";

    // 1. Try to login first
    try {
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: defaultUsername, password: defaultPassword })
      });
      if (loginRes.ok) {
        const loginData = await loginRes.json();
        localStorage.setItem("rev_username", loginData.username);
        localStorage.setItem("rev_token", loginData.token);
        setLoggedInUser(loginData.username);
        setSessionToken(loginData.token);
        setIsLoggedIn(true);
        return;
      }
    } catch (err) {
      console.error("Auto login failed, trying register", err);
    }

    // 2. If login failed, try to register
    try {
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: defaultUsername, password: defaultPassword })
      });
      if (regRes.ok) {
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: defaultUsername, password: defaultPassword })
        });
        if (loginRes.ok) {
          const loginData = await loginRes.json();
          localStorage.setItem("rev_username", loginData.username);
          localStorage.setItem("rev_token", loginData.token);
          setLoggedInUser(loginData.username);
          setSessionToken(loginData.token);
          setIsLoggedIn(true);
        }
      }
    } catch (err) {
      console.error("Auto registration/login failed", err);
    }
  };

  // --- Initialize LocalStorage and TTS ---
  useEffect(() => {
    const savedProgress = localStorage.getItem("rev_progress");
    const savedNotes = localStorage.getItem("rev_notes");
    const savedHistory = localStorage.getItem("rev_history");
    const savedTheme = localStorage.getItem("rev_theme");
    const savedCompletedDays = localStorage.getItem("rev_completed_days");
    const savedUser = localStorage.getItem("rev_username");
    const savedToken = localStorage.getItem("rev_token");
    const savedLastSyncTime = localStorage.getItem("rev_last_sync_time");
    const savedPlan = localStorage.getItem("rev_study_plan");

    if (savedProgress) setProgress(JSON.parse(savedProgress));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedHistory) setStudyHistory(JSON.parse(savedHistory));
    if (savedCompletedDays) setCompletedDays(JSON.parse(savedCompletedDays));
    if (savedPlan) setStudyPlan(JSON.parse(savedPlan));

    const todayStr = new Date().toISOString().split("T")[0];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 60);
    const targetDateStr = targetDate.toISOString().split("T")[0];
    setSetupStartDate(todayStr);
    setSetupEndDate(targetDateStr);
    
    if (savedLastSyncTime) setLastSyncTime(savedLastSyncTime);
    if (savedTheme) {
      setDarkMode(savedTheme === "dark");
    } else {
      setDarkMode(true);
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }

    // Run auto-authentication in background
    const runAutoAuth = async () => {
      setAuthChecking(true);
      if (savedUser && savedToken) {
        setIsLoggedIn(true);
        setLoggedInUser(savedUser);
        setSessionToken(savedToken);
      }
      setAuthChecking(false);
    };
    runAutoAuth();

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

  // --- Auto-sync Download on login/app mount ---
  useEffect(() => {
    if (isLoggedIn && loggedInUser && sessionToken) {
      const fetchAndMerge = async () => {
        try {
          const response = await fetch(`/api/sync?username=${encodeURIComponent(loggedInUser)}&token=${sessionToken}`);
          if (response.ok) {
            const cloudData = await response.json();
            performMerge(cloudData);
            const nowStr = new Date().toLocaleString();
            setLastSyncTime(nowStr);
            localStorage.setItem("rev_last_sync_time", nowStr);
          }
        } catch (e) {
          console.error("Auto sync download failed", e);
        }
      };
      fetchAndMerge();
    }
  }, [isLoggedIn, loggedInUser, sessionToken]);

  // --- Auto-sync Upload (Debounced) ---
  useEffect(() => {
    if (!isLoggedIn || !loggedInUser || !sessionToken) return;

    const handler = setTimeout(() => {
      triggerBackgroundUpload(progress, notes, studyHistory, completedDays, studyPlan);
    }, 1500); // 1.5s debounce

    return () => clearTimeout(handler);
  }, [progress, notes, studyHistory, completedDays, studyPlan, isLoggedIn, loggedInUser, sessionToken]);

  // Helper to save progress
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

  // --- Partition Revelation Dynamically based on Study Plan ---
  const getVersesForDay = (day: number): BibleVerse[] => {
    if (!studyPlan) {
      const startIdx = (day - 1) * 5;
      const endIdx = Math.min(day * 5, REVELATION_VERSES.length);
      return REVELATION_VERSES.slice(startIdx, endIdx);
    }
    const daySched = studyPlan.schedule.find(s => s.day === day);
    if (!daySched) return [];
    return daySched.verseIndices.map(idx => REVELATION_VERSES[idx]);
  };

  const handleCompleteDay = (day: number) => {
    const newCompleted = { ...completedDays, [day]: true };
    setCompletedDays(newCompleted);
    localStorage.setItem("rev_completed_days", JSON.stringify(newCompleted));

    // Mark all verses in this day as learned
    const dayVerses = getVersesForDay(day);
    const newProgress = { ...progress };
    dayVerses.forEach((v) => {
      newProgress[`${v.chapter}:${v.verse}`] = "learned";
    });
    saveProgress(newProgress);
  };

  // --- Dynamic Scheduler Generators ---
  const generateStudyPlan = (
    start: string,
    end: string,
    excWk: boolean,
    excHol: boolean
  ) => {
    const activeDates: string[] = [];
    const curr = new Date(start);
    const last = new Date(end);

    while (curr <= last) {
      const dateStr = curr.toISOString().split("T")[0];
      if (!isRestDay(dateStr, excWk, excHol)) {
        activeDates.push(dateStr);
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (activeDates.length === 0) {
      alert("❌ 선택하신 기간 내에 공부할 수 있는 날짜가 하루도 존재하지 않습니다. 기간을 조정해주세요.");
      return;
    }

    const N = activeDates.length;
    const baseCount = Math.floor(404 / N);
    const remainder = 404 % N;

    let currentVerseIdx = 0;
    const schedule = activeDates.map((dateStr, index) => {
      const count = baseCount + (index < remainder ? 1 : 0);
      const indices: number[] = [];
      for (let i = 0; i < count; i++) {
        if (currentVerseIdx < 404) {
          indices.push(currentVerseIdx);
          currentVerseIdx++;
        }
      }
      return {
        day: index + 1,
        date: dateStr,
        verseIndices: indices
      };
    });

    const newPlan: StudyPlan = {
      startDate: start,
      endDate: end,
      excludeWeekends: excWk,
      excludeHolidays: excHol,
      totalDays: N,
      schedule
    };

    setStudyPlan(newPlan);
    localStorage.setItem("rev_study_plan", JSON.stringify(newPlan));
    
    setCompletedDays({});
    localStorage.removeItem("rev_completed_days");

    triggerBackgroundUpload(progress, notes, studyHistory, {}, newPlan);
    alert(`📅 학습 계획이 수립되었습니다!\n총 학습일: ${N}일 (하루 평균 약 ${(404/N).toFixed(1)}구절)`);
  };

  const resetStudyPlan = () => {
    if (confirm("정말 학습 계획을 재설정하시겠습니까?\n이전 계획의 일일 완료 기록은 초기화되지만, 개별 구절의 암기 상태(🟢🟡🔴)와 메모는 안전하게 유지됩니다.")) {
      setStudyPlan(null);
      setCompletedDays({});
      localStorage.removeItem("rev_study_plan");
      localStorage.removeItem("rev_completed_days");
      triggerBackgroundUpload(progress, notes, studyHistory, {}, null);
    }
  };

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
        result += text[i];
      }
    }
    return result;
  };

  // --- Text-to-Speech Controls ---
  const playTTS = (text: string, verseKey: string, onEndCallback?: () => void) => {
    if (!synthRef.current) return;

    if (isPlayingTTS) {
      synthRef.current.cancel();
    }

    const cleanText = text.replace(/\[\d+:\d+\]/g, "");
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
      
      if (onEndCallback) {
        onEndCallback();
      } else if (autoPlayTts && activeTab === "read") {
        const currentIdx = filteredVerses.findIndex(v => `${v.chapter}:${v.verse}` === verseKey);
        if (currentIdx >= 0 && currentIdx < filteredVerses.length - 1) {
          const next = filteredVerses[currentIdx + 1];
          setTimeout(() => {
            playTTS(next.text, `${next.chapter}:${next.verse}`);
          }, 100);
        }
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

  // --- Filtered verses for Reading and Practice tabs ---
  const filteredVerses = useMemo(() => {
    return REVELATION_VERSES.filter((v) => {
      if (selectedChapter !== 0 && v.chapter !== selectedChapter) return false;

      const key = `${v.chapter}:${v.verse}`;
      const status = progress[key] || "unlearned";

      if (activeTab === "practice") {
        if (practiceFilterStatus !== "all" && status !== practiceFilterStatus) return false;
      }

      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesText = v.text.toLowerCase().includes(query);
        const matchesRef = `${v.chapter}장 ${v.verse}절`.includes(query) || `${v.chapter}:${v.verse}`.includes(query);
        const matchesNote = (notes[key] || "").toLowerCase().includes(query);
        if (!matchesText && !matchesRef && !matchesNote) return false;
      }

      return true;
    });
  }, [selectedChapter, practiceFilterStatus, searchQuery, progress, notes, activeTab]);

  // Reset index when search/filter changes
  useEffect(() => {
    setCurrentPracticeIndex(0);
    setIsPracticeCardFlipped(false);
    setPracticeUserInput("");
    setRevealedBlanks([]);
  }, [selectedChapter, practiceFilterStatus, searchQuery, activeTab]);

  const currentPracticeVerse: BibleVerse | undefined = filteredVerses[currentPracticeIndex];

  // Consonants for custom blank masking
  const blankedPracticeWords = useMemo(() => {
    if (!currentPracticeVerse) return [];
    const words = currentPracticeVerse.text.split(" ");
    return words.map((word, idx) => {
      const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      if (cleanWord.length <= 1) return { text: word, isMasked: false };
      
      let step = 3;
      if (blankDifficulty === "medium") step = 2;
      if (blankDifficulty === "hard") step = 1.2;
      
      const shouldMask = (idx + currentPracticeVerse.verse) % step < 1;
      return { text: word, isMasked: shouldMask };
    });
  }, [currentPracticeVerse, blankDifficulty]);

  // --- Regex-based Verse Marker Stripper & Typing Validator ---
  const getTypingFeedback = (input: string, originalText: string, mode: "initial" | "full") => {
    const target = mode === "initial" ? getInitials(originalText) : originalText;
    
    // Strips prefixes like "1.", "1절", "1:1", "[1:1]", ":1" from start of the typed string
    const cleanVerseMarker = (str: string): string => {
      return str
        .replace(/^\s*\[?\d+장\s*\d+절\]?\s*/, "") // matches "[1장 1절]" at start
        .replace(/^\s*\[?\d+[:.]\d+\]?\s*/, "")    // matches "[1:1]" or "1:1" at start
        .replace(/^\s*[:.]\d+\s*/, "")              // matches ":1" at start
        .replace(/^\s*\d+절\s*/, "")                // matches "1절" at start
        .replace(/^\s*\d+\.\s*/, "")                // matches "1." at start
        .replace(/^\s*\d+\s+/, "")                 // matches "1 " at start
        .trim();
    };

    const cleanedInput = cleanVerseMarker(input);
    const cleanedTarget = cleanVerseMarker(target);

    // Remove all spaces for spacing-independent check
    const normalizedInput = cleanedInput.replace(/\s+/g, "");
    const normalizedTarget = cleanedTarget.replace(/\s+/g, "");

    if (normalizedInput === "") return null;

    const isMatch = normalizedTarget.startsWith(normalizedInput);
    const isComplete = normalizedTarget === normalizedInput;

    return { isMatch, isComplete };
  };

  // --- Dynamic Diff Feedback Markup Visualizer ---
  const renderDiffFeedback = (input: string, target: string, mode: "full" | "initial") => {
    const cleanVerseMarker = (str: string): string => {
      return str
        .replace(/^\s*\[?\d+장\s*\d+절\]?\s*/, "")
        .replace(/^\s*\[?\d+[:.]\d+\]?\s*/, "")
        .replace(/^\s*[:.]\d+\s*/, "")
        .replace(/^\s*\d+절\s*/, "")
        .replace(/^\s*\d+\.\s*/, "")
        .replace(/^\s*\d+\s+/, "")
        .trim();
    };

    const resolvedTarget = mode === "initial" ? getInitials(target) : target;
    const resolvedInput = mode === "initial" ? getInitials(input) : input;

    const targetPure = cleanVerseMarker(resolvedTarget);
    const inputPure = cleanVerseMarker(resolvedInput);

    const targetNoSpace = targetPure.replace(/\s+/g, "");
    const inputNoSpace = inputPure.replace(/\s+/g, "");

    let matchLen = 0;
    while (
      matchLen < inputNoSpace.length &&
      matchLen < targetNoSpace.length &&
      inputNoSpace[matchLen] === targetNoSpace[matchLen]
    ) {
      matchLen++;
    }

    const markerRegex = /^(\s*\[?\d+장\s*\d+절\]?|\s*\[?\d+[:.]\d+\]?|\s*[:.]\d+|\s*\d+절|\s*\d+\.|\s*\d+)/;
    const markerMatch = resolvedTarget.match(markerRegex);
    const markerLength = markerMatch ? markerMatch[0].length : 0;

    const elements: React.ReactNode[] = [];
    let pureCharIndex = 0;

    for (let i = 0; i < resolvedTarget.length; i++) {
      const char = resolvedTarget[i];

      if (i < markerLength) {
        elements.push(
          <span key={i} className={darkMode ? "text-zinc-400 font-medium" : "text-slate-500 font-medium"}>
            {char}
          </span>
        );
      } else if (/\s/.test(char)) {
        const isPastMatch = pureCharIndex >= matchLen;
        elements.push(
          <span 
            key={i} 
            className={
              isPastMatch 
                ? "text-red-500/80 border-b border-red-500/35" 
                : darkMode 
                ? "text-zinc-300" 
                : "text-slate-850"
            }
          >
            {char}
          </span>
        );
      } else {
        const isCorrect = pureCharIndex < matchLen;
        if (isCorrect) {
          elements.push(
            <span key={i} className={darkMode ? "text-zinc-300 font-medium" : "text-slate-800 font-medium"}>
              {char}
            </span>
          );
        } else {
          elements.push(
            <span 
              key={i} 
              className="text-red-500 font-extrabold border-b border-red-500/50 bg-red-500/5"
            >
              {char}
            </span>
          );
        }
        pureCharIndex++;
      }
    }

    return (
      <div className={`p-5 rounded-2xl border ${darkMode ? "bg-zinc-950/45 border-zinc-800/80" : "bg-red-50/20 border-red-100"} mt-4 space-y-3`}>
        <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold justify-center">
          ⚠️ 틀린 부분이 있습니다. (빨간 글씨가 정답입니다)
        </div>
        <div className="h-px bg-zinc-800/20 w-full my-2"></div>
        <div className="leading-relaxed break-keep select-text text-sm sm:text-base tracking-wide">
          {elements}
        </div>
      </div>
    );
  };

  // --- Keyboard Shortcuts for Practice Tab ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea/editable fields
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (activeTab !== "practice") return;
      const totalVerses = filteredVerses.length;
      if (totalVerses === 0) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (practiceSubTab === "card") {
            setIsPracticeCardFlipped((prev) => !prev);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentPracticeIndex < totalVerses - 1) {
            const currentVerse = filteredVerses[currentPracticeIndex];
            const feed = getTypingFeedback(practiceUserInput, currentVerse.text, typingMode);
            if (practiceSubTab === "typing" && feed?.isComplete) {
              handleUpdateStatus(currentVerse.chapter, currentVerse.verse, "learned");
            }
            setCurrentPracticeIndex((prev) => prev + 1);
            setIsPracticeCardFlipped(false);
            setPracticeUserInput("");
            setShowPracticeAnswer(false);
            setRevealedBlanks([]);
            stopTTS();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (currentPracticeIndex > 0) {
            setCurrentPracticeIndex((prev) => prev - 1);
            setIsPracticeCardFlipped(false);
            setPracticeUserInput("");
            setShowPracticeAnswer(false);
            setRevealedBlanks([]);
            stopTTS();
          }
          break;
        case "KeyL": // L: Mark Learned
          if (currentPracticeVerse) {
            handleUpdateStatus(currentPracticeVerse.chapter, currentPracticeVerse.verse, "learned");
          }
          break;
        case "KeyR": // R: Mark Reviewing
          if (currentPracticeVerse) {
            handleUpdateStatus(currentPracticeVerse.chapter, currentPracticeVerse.verse, "reviewing");
          }
          break;
        case "KeyU": // U: Mark Unlearned
          if (currentPracticeVerse) {
            handleUpdateStatus(currentPracticeVerse.chapter, currentPracticeVerse.verse, "unlearned");
          }
          break;
        case "KeyS": // S: Play/Stop TTS
          if (currentPracticeVerse) {
            if (isPlayingTTS) {
              stopTTS();
            } else {
              playTTS(currentPracticeVerse.text, `${currentPracticeVerse.chapter}:${currentPracticeVerse.verse}`);
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeTab,
    practiceSubTab,
    currentPracticeIndex,
    filteredVerses,
    practiceUserInput,
    typingMode,
    currentPracticeVerse,
    isPlayingTTS
  ]);

  // --- Statistics ---
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

  // Today Study Plan Status Calculator
  const todayStudyStatus = useMemo(() => {
    if (!studyPlan) return null;
    
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - offset * 60 * 1000);
    const todayStr = localDate.toISOString().split("T")[0];
    
    const startDate = new Date(studyPlan.startDate);
    const endDate = new Date(studyPlan.endDate);
    const today = new Date(todayStr);
    
    startDate.setHours(0,0,0,0);
    endDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    if (today < startDate) {
      const diffTime = startDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        status: "before",
        dDay: `D-${diffDays}`,
        todayStr,
        displayMsg: `학습 시작 대기 중 (D-${diffDays})`,
        currentDayNum: 0,
        elapsedDays: 0
      };
    }
    
    if (today > endDate) {
      return {
        status: "completed",
        todayStr,
        displayMsg: "학습 기간 완료",
        currentDayNum: studyPlan.totalDays,
        elapsedDays: studyPlan.totalDays
      };
    }
    
    const todaySched = studyPlan.schedule.find(s => s.date === todayStr);
    
    const diffTime = today.getTime() - startDate.getTime();
    const elapsedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (todaySched) {
      return {
        status: "study",
        todayStr,
        displayMsg: `학습 ${elapsedDays}일째 (스케줄 ${todaySched.day}일차)`,
        currentDayNum: todaySched.day,
        elapsedDays,
        verses: todaySched.verseIndices.map(idx => REVELATION_VERSES[idx])
      };
    } else {
      return {
        status: "rest",
        todayStr,
        displayMsg: `학습 ${elapsedDays}일째 (오늘은 휴식일)`,
        currentDayNum: null,
        elapsedDays
      };
    }
  }, [studyPlan]);

  // Streak calculator
  const currentStreak = useMemo(() => {
    if (studyPlan && todayStudyStatus && todayStudyStatus.status === "before") {
      return 0;
    }
    if (studyHistory.length === 0) return 0;
    
    const dates = studyHistory
      .filter((r) => r.count > 0)
      .map((r) => r.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
    if (dates.length === 0) return 0;
    
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

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
        break;
      }
    }
    return streak;
  }, [studyHistory, studyPlan, todayStudyStatus]);

  // --- Day Study & Test Helpers ---
  const activeDayVerses = useMemo(() => {
    if (activeDay === null) return [];
    return getVersesForDay(activeDay);
  }, [activeDay]);

  const handleStartDay = (dayNum: number) => {
    const verses = getVersesForDay(dayNum);
    setActiveDay(dayNum);
    setDayStudyStep("study");
    setDayTestAnswers(Array(verses.length).fill(""));
    setRevealStudyText(Array(verses.length).fill(true));
    setActiveTestVerseIdx(0);
    stopTTS();
  };

  const handleGoToTest = () => {
    setDayStudyStep("test");
    setDayTestAnswers(Array(activeDayVerses.length).fill(""));
    setActiveTestVerseIdx(0);
    stopTTS();
  };

  const activeTestVerse = activeDayVerses[activeTestVerseIdx];
  const activeTestFeedback = activeTestVerse
    ? getTypingFeedback(dayTestAnswers[activeTestVerseIdx], activeTestVerse.text, dayTestMode)
    : null;

  // --- Chapter Test Handlers ---
  const activeChapterTestVerses = useMemo(() => {
    if (activeChapterTest === null) return [];
    if (activeChapterTest === -1) {
      return REVELATION_VERSES.filter((v) => isKeyVerse(v.chapter, v.verse));
    }
    return REVELATION_VERSES.filter((v) => 
      v.chapter === activeChapterTest && 
      (!isKeyVerseTestOnly || isKeyVerse(v.chapter, v.verse))
    );
  }, [activeChapterTest, isKeyVerseTestOnly]);

  const handleStartChapterTest = (chapterNum: number, keyVersesOnly: boolean = false) => {
    setIsKeyVerseTestOnly(keyVersesOnly);
    setActiveChapterTest(chapterNum);
    setActiveChapterTestIdx(0);
    
    let count = 0;
    if (chapterNum === -1) {
      count = REVELATION_VERSES.filter((v) => isKeyVerse(v.chapter, v.verse)).length;
    } else {
      count = REVELATION_VERSES.filter((v) => 
        v.chapter === chapterNum && 
        (!keyVersesOnly || isKeyVerse(chapterNum, v.verse))
      ).length;
    }
    
    setChapterTestAnswers(Array(count).fill(""));
    setChapterTestMode("initial");
    setShowChapterTestAnswer(false);
    
    // Reset key verse test answers, grading status, and study views
    setKeyVerseAnswers({});
    setKeyVerseScoreStatus({});
    setKeyVerseStudyReveal({});
    setKeyVerseTestModeGlobal("full"); // Full typing comes first
    
    stopTTS();
  };

  const activeChapterTestVerse = activeChapterTestVerses[activeChapterTestIdx];
  const activeChapterTestFeedback = activeChapterTestVerse
    ? getTypingFeedback(chapterTestAnswers[activeChapterTestIdx], activeChapterTestVerse.text, chapterTestMode)
    : null;

  const handleCompleteChapterTest = () => {
    if (activeChapterTest === null) return;

    // Mark all verses of this chapter as learned in master progress
    const newProgress = { ...progress };
    activeChapterTestVerses.forEach((v) => {
      newProgress[`${v.chapter}:${v.verse}`] = "learned";
    });
    saveProgress(newProgress);

    if (isKeyVerseTestOnly) {
      alert(`🎉 요한계시록 ${activeChapterTest}장 핵심 주요 성구 시험을 합격하셨습니다! ${activeChapterTestVerses.length}개 주요 구절이 '암기 완료(🟢)'로 등록되었습니다.`);
    } else {
      alert(`🎉 요한계시록 ${activeChapterTest}장 전체 암송 시험을 합격하셨습니다! ${activeChapterTestVerses.length}개 전 구절이 '암기 완료(🟢)'로 등록되었습니다.`);
    }
    setActiveChapterTest(null);
  };

  // --- Backup & Restore Handlers (Manual File-based) ---
  const handleBackupData = () => {
    const backupObj = {
      progress,
      notes,
      studyHistory,
      completedDays,
      backupDate: new Date().toISOString()
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `revelation_planner_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleRestoreData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;
    
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        performMerge(parsed);
        alert("🎉 백업 파일 데이터가 정상적으로 병합 및 복원되었습니다!");
      } catch (err) {
        alert("❌ 올바르지 않은 백업 파일 형식이거나 파일 읽기에 실패했습니다.");
      }
    };
    fileReader.readAsText(file);
  };

  // --- Cloud Sync Handlers (PC ↔ Mobile Sync via Login) ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPw.trim() || !loginPwConfirm.trim()) {
      alert("아이디와 비밀번호, 비밀번호 확인을 모두 입력해주세요.");
      return;
    }
    if (loginPw !== loginPwConfirm) {
      alert("❌ 입력하신 두 비밀번호가 일치하지 않습니다. 다시 확인해주세요.");
      return;
    }
    setSyncLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginId, password: loginPw })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "회원가입 실패");
      }
      alert("🎉 회원가입 성공! 이제 로그인해주세요.");
      setIsRegisterMode(false);
      setLoginPw("");
      setLoginPwConfirm("");
      setShowPw(false);
      setShowPwConfirm(false);
    } catch (e: any) {
      alert(`❌ 회원가입 오류: ${e.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPw.trim()) {
      alert("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    setSyncLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginId, password: loginPw })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "로그인 실패");
      }
      
      setIsLoggedIn(true);
      setLoggedInUser(data.username);
      setSessionToken(data.token);
      localStorage.setItem("rev_username", data.username);
      localStorage.setItem("rev_token", data.token);

      setLoginId("");
      setLoginPw("");
      setLoginPwConfirm("");
      setShowPw(false);
      setShowPwConfirm(false);

      alert(`👋 ${data.username}님, 반갑습니다! 로그인 성공 및 클라우드 동기화가 활성화되었습니다.`);
    } catch (e: any) {
      alert(`❌ 로그인 오류: ${e.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까? 로컬의 공부 기록은 브라우저에 보존됩니다.")) {
      setIsLoggedIn(false);
      setLoggedInUser("");
      setSessionToken("");
      setLastSyncTime("");
      setLoginPwConfirm("");
      setShowPw(false);
      setShowPwConfirm(false);
      localStorage.removeItem("rev_username");
      localStorage.removeItem("rev_token");
      localStorage.removeItem("rev_last_sync_time");
      alert("로그아웃 되었습니다.");
    }
  };

  const handleUploadToCloud = async () => {
    if (!isLoggedIn || !loggedInUser || !sessionToken) return;
    setSyncLoading(true);
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loggedInUser,
          token: sessionToken,
          progress,
          notes,
          studyHistory,
          completedDays
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "동기화 실패");
      }
      const nowStr = new Date().toLocaleString();
      setLastSyncTime(nowStr);
      localStorage.setItem("rev_last_sync_time", nowStr);
      alert("📤 현재 진행상황을 클라우드 서버에 업로드(병합) 완료했습니다!");
    } catch (e: any) {
      alert(`❌ 업로드 오류: ${e.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDownloadAndMerge = async () => {
    if (!isLoggedIn || !loggedInUser || !sessionToken) return;
    setSyncLoading(true);
    try {
      const response = await fetch(`/api/sync?username=${encodeURIComponent(loggedInUser)}&token=${sessionToken}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "동기화 실패");
      }
      
      performMerge(data);
      const nowStr = new Date().toLocaleString();
      setLastSyncTime(nowStr);
      localStorage.setItem("rev_last_sync_time", nowStr);
      alert("📥 클라우드 서버의 학습 기록을 가져와 병합 완료했습니다!");
    } catch (e: any) {
      alert(`❌ 다운로드 오류: ${e.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // Background auto-sync function
  const triggerBackgroundUpload = async (
    currentProgress: VerseProgress,
    currentNotes: VerseNotes,
    currentHistory: StudyRecord[],
    currentCompleted: { [key: number]: boolean },
    currentPlan: StudyPlan | null
  ) => {
    const username = localStorage.getItem("rev_username");
    const token = localStorage.getItem("rev_token");
    if (!username || !token) return;
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          token,
          progress: currentProgress,
          notes: currentNotes,
          studyHistory: currentHistory,
          completedDays: currentCompleted,
          studyPlan: currentPlan
        })
      });
      const nowStr = new Date().toLocaleString();
      setLastSyncTime(nowStr);
      localStorage.setItem("rev_last_sync_time", nowStr);
    } catch (e) {
      console.error("Background auto sync failed", e);
    }
  };

  // --- Smart State Merger Helper ---
  const performMerge = (cloudData: any) => {
    // 1. Merge Progress (Take advanced status: learned > reviewing > unlearned)
    const mergedProgress = { ...progress };
    if (cloudData.progress) {
      Object.keys(cloudData.progress).forEach((key) => {
        const localStatus = progress[key] || "unlearned";
        const cloudStatus = cloudData.progress[key] as ProgressStatus;
        if (cloudStatus === "learned") {
          mergedProgress[key] = "learned";
        } else if (cloudStatus === "reviewing" && localStatus !== "learned") {
          mergedProgress[key] = "reviewing";
        }
      });
    }

    // 2. Merge Completed Days (Union of completed days)
    const mergedCompleted = { ...completedDays };
    if (cloudData.completedDays) {
      Object.keys(cloudData.completedDays).forEach((dayStr) => {
        const day = parseInt(dayStr);
        if (cloudData.completedDays[day]) {
          mergedCompleted[day] = true;
        }
      });
    }

    // 3. Merge Notes (Keep longer note)
    const mergedNotes = { ...notes };
    if (cloudData.notes) {
      Object.keys(cloudData.notes).forEach((key) => {
        const localNote = notes[key] || "";
        const cloudNote = cloudData.notes[key] || "";
        if (cloudNote.length > localNote.length) {
          mergedNotes[key] = cloudNote;
        }
      });
    }

    // 4. Merge Study History (Union of histories by date, keeping highest count)
    let mergedHistory = [...studyHistory];
    if (cloudData.studyHistory) {
      cloudData.studyHistory.forEach((cloudRec: StudyRecord) => {
        const localIdx = mergedHistory.findIndex(h => h.date === cloudRec.date);
        if (localIdx >= 0) {
          mergedHistory[localIdx].count = Math.max(mergedHistory[localIdx].count, cloudRec.count);
        } else {
          mergedHistory.push(cloudRec);
        }
      });
    }

    // 5. Merge Study Plan (Overwrite with cloud version if present)
    let mergedPlan = studyPlan;
    if (cloudData.studyPlan) {
      mergedPlan = cloudData.studyPlan;
    }

    // Apply states
    setProgress(mergedProgress);
    setCompletedDays(mergedCompleted);
    setNotes(mergedNotes);
    setStudyHistory(mergedHistory);
    setStudyPlan(mergedPlan);

    // Save to localStorage
    localStorage.setItem("rev_progress", JSON.stringify(mergedProgress));
    localStorage.setItem("rev_completed_days", JSON.stringify(mergedCompleted));
    localStorage.setItem("rev_notes", JSON.stringify(mergedNotes));
    localStorage.setItem("rev_history", JSON.stringify(mergedHistory));
    if (mergedPlan) {
      localStorage.setItem("rev_study_plan", JSON.stringify(mergedPlan));
    } else {
      localStorage.removeItem("rev_study_plan");
    }
  };

  if (authChecking) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-300 font-sans p-4 ${darkMode ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"}`}>
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="text-sm font-bold text-zinc-400">데이터베이스 및 로그인 정보 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-300 font-sans p-4 ${darkMode ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"}`}>
        <div className={`w-full max-w-md p-8 rounded-3xl border transition-all duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-xl"}`}>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">계시록 완벽숙지</h2>
            <p className="text-xs text-zinc-400 mt-2">
              {isRegisterMode ? "새로운 계정을 생성하여 암송 데이터를 연동하세요" : "계정에 로그인하여 기기간 학습 진도를 실시간 동기화하세요"}
            </p>
          </div>

          <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-zinc-400">아이디</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="아이디를 입력하세요 (2글자 이상)"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  disabled={syncLoading}
                  className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border outline-none transition-all duration-300 ${darkMode ? "bg-zinc-800 border-zinc-700 text-white focus:border-emerald-500" : "bg-slate-100 border-slate-200 text-slate-800 focus:border-emerald-500"}`}
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">👤</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-zinc-400">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="비밀번호를 입력하세요"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  disabled={syncLoading}
                  className={`w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border outline-none transition-all duration-300 ${darkMode ? "bg-zinc-800 border-zinc-700 text-white focus:border-emerald-500" : "bg-slate-100 border-slate-200 text-slate-800 focus:border-emerald-500"}`}
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">🔑</span>
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-450 hover:text-zinc-250 focus:outline-none text-xs"
                >
                  {showPw ? "👀 숨기기" : "🙈 보기"}
                </button>
              </div>
            </div>

            {isRegisterMode && (
              <div className="space-y-1 animate-fade-in">
                <label className="block text-xs font-bold text-zinc-400">비밀번호 확인</label>
                <div className="relative">
                  <input
                    type={showPwConfirm ? "text" : "password"}
                    placeholder="비밀번호를 다시 입력하세요"
                    value={loginPwConfirm}
                    onChange={(e) => setLoginPwConfirm(e.target.value)}
                    disabled={syncLoading}
                    className={`w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border outline-none transition-all duration-300 ${darkMode ? "bg-zinc-800 border-zinc-700 text-white focus:border-emerald-500" : "bg-slate-100 border-slate-200 text-slate-800 focus:border-emerald-500"}`}
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">🔒</span>
                  <button
                    type="button"
                    onClick={() => setShowPwConfirm(!showPwConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-450 hover:text-zinc-250 focus:outline-none text-xs"
                  >
                    {showPwConfirm ? "👀 숨기기" : "🙈 보기"}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={syncLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold rounded-2xl transition-all shadow-md shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
            >
              {syncLoading ? "처리 중..." : isRegisterMode ? "회원가입 완료" : "로그인"}
            </button>
          </form>

          <button
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setLoginId("");
              setLoginPw("");
              setLoginPwConfirm("");
              setShowPw(false);
              setShowPwConfirm(false);
            }}
            className="w-full text-center text-xs text-zinc-400 hover:text-zinc-200 underline mt-4 block"
          >
            {isRegisterMode ? "이미 계정이 있으신가요? 로그인하기" : "아직 계정이 없으신가요? 회원가입하기"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans ${darkMode ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"}`}>
      {/* --- HEADER --- */}
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors duration-300 ${darkMode ? "bg-zinc-900/80 border-zinc-800" : "bg-white/80 border-slate-200"}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div
            onClick={() => {
              setActiveTab("dashboard");
              setActiveDay(null);
              setActiveChapterTest(null);
              stopTTS();
            }}
            className="flex items-center gap-3 cursor-pointer hover:opacity-85 active:scale-95 transition-all select-none focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl p-1"
            role="button"
            tabIndex={0}
            title="대시보드로 돌아가기"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveTab("dashboard");
                setActiveDay(null);
                setActiveChapterTest(null);
                stopTTS();
              }
            }}
          >
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">계시록 완벽숙지</h1>
              <p className="text-xs text-zinc-400">성경 공부 및 암송 시험 점검 최적화 프로그램</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex bg-zinc-800/50 p-1 rounded-lg border border-zinc-700/50 text-xs sm:text-sm">
            <button
              onClick={() => { setActiveTab("dashboard"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${activeTab === "dashboard" && activeDay === null && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              대시보드
            </button>
            <button
              onClick={() => { setActiveTab("planner"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${activeTab === "planner" && activeDay === null && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              일일 플래너
            </button>
            <button
              onClick={() => { setActiveTab("read"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${activeTab === "read" && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              성경 학습 (1~22장)
            </button>
            <button
              onClick={() => { setActiveTab("key-verses"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${activeTab === "key-verses" && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              핵심 주요 성구
            </button>
            <button
              onClick={() => { setActiveTab("practice"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all duration-200 ${activeTab === "practice" && activeDay === null && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              개별 훈련
            </button>
          </nav>

          {/* Theme Switcher and User Account Info */}
          <div className="flex items-center gap-3">
            {isLoggedIn && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 font-bold hidden sm:inline">👤 {loggedInUser}</span>
                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-350 hover:text-zinc-200 rounded-xl border border-zinc-700 text-xs font-bold transition-colors"
                  title="로그아웃"
                >
                  로그아웃
                </button>
              </div>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors border ${darkMode ? "bg-zinc-800 hover:bg-zinc-750 border-zinc-700 text-yellow-400" : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"}`}
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
        
        {/* --- GLOBAL SEARCH & CHAPTER BAR (Only visible on Read and Practice tabs when not in Chapter Test) --- */}
        {(activeTab === "read" || activeTab === "practice") && activeChapterTest === null && (
          <div className={`p-4 mb-6 rounded-2xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
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

                {activeTab === "practice" && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">훈련 상태 필터</label>
                    <select
                      value={practiceFilterStatus}
                      onChange={(e) => setPracticeFilterStatus(e.target.value as any)}
                      className={`px-3 py-2 rounded-xl border font-medium outline-none text-sm ${darkMode ? "bg-zinc-800 border-zinc-700 text-white" : "bg-slate-100 border-slate-200 text-slate-800"}`}
                    >
                      <option value="all">전체 구절</option>
                      <option value="unlearned">🔴 미학습</option>
                      <option value="reviewing">🟡 복습 중</option>
                      <option value="learned">🟢 암기 완료</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex-1 max-w-md">
                <label className="block text-xs font-semibold text-zinc-400 mb-1">구절 본문 및 메모 검색</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="예: 생명수, 새 예루살렘, 1:1, 22:21..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 rounded-xl border outline-none text-sm transition-all duration-300 ${darkMode ? "bg-zinc-800 border-zinc-700 text-white focus:border-emerald-500" : "bg-slate-100 border-slate-200 text-slate-800 focus:border-emerald-500"}`}
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  </div>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800/40 flex items-center justify-between text-xs text-zinc-400">
              <div>
                검색된 구절 수: <span className="font-semibold text-emerald-400">{filteredVerses.length}</span>구절 / 전체 404구절
              </div>
              {filteredVerses.length > 0 && activeTab === "practice" && (
                <div>
                  구절 위치: {currentPracticeIndex + 1} / {filteredVerses.length}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- STUDY PLAN SETUP SCREEN (Shown when logged in but no active plan, for Dashboard & Planner tabs) --- */}
        {(activeTab === "dashboard" || activeTab === "planner") && studyPlan === null && activeDay === null && activeChapterTest === null && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in py-8">
            <div className={`p-8 rounded-3xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-xl"}`}>
              
              <div className="text-center mb-8 border-b border-zinc-800/80 pb-6">
                <div className="p-3 w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/20 mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <h2 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  나만의 계시록 암송 계획 수립
                </h2>
                <p className="text-xs text-zinc-400 mt-2">
                  요한계시록 전체 22장 404구절을 공부할 기간과 조건을 선택하세요.<br />
                  설정하신 내용에 맞춰 매일 공부할 구절이 자동으로 균등 분배됩니다.
                </p>
              </div>

              <div className="space-y-6">
                {/* Dates selection grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-400">학습 시작일</label>
                    <input
                      type="date"
                      value={setupStartDate}
                      onChange={(e) => setSetupStartDate(e.target.value)}
                      className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none font-medium transition-all duration-300 ${darkMode ? "bg-zinc-800 border-zinc-700 text-white focus:border-emerald-500" : "bg-slate-100 border-slate-200 text-slate-800 focus:border-emerald-500"}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-zinc-400">학습 목표 종료일</label>
                    <input
                      type="date"
                      value={setupEndDate}
                      onChange={(e) => setSetupEndDate(e.target.value)}
                      className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none font-medium transition-all duration-300 ${darkMode ? "bg-zinc-800 border-zinc-700 text-white focus:border-emerald-500" : "bg-slate-100 border-slate-200 text-slate-800 focus:border-emerald-500"}`}
                    />
                  </div>
                </div>

                {/* Exclude option switches */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <label className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-300 ${darkMode ? "bg-zinc-800/40 border-zinc-800 hover:bg-zinc-800" : "bg-slate-50 border-slate-100 hover:bg-slate-100"}`}>
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold block text-zinc-200">주말 제외 (토, 일)</span>
                      <span className="text-[10px] text-zinc-400 block">토요일과 일요일은 학습을 쉽니다.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={setupExcWk}
                      onChange={(e) => setSetupExcWk(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </label>

                  <label className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-300 ${darkMode ? "bg-zinc-800/40 border-zinc-800 hover:bg-zinc-800" : "bg-slate-50 border-slate-100 hover:bg-slate-100"}`}>
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold block text-zinc-200">공휴일 / 빨간날 제외</span>
                      <span className="text-[10px] text-zinc-400 block">신정, 설날, 추석 등 공휴일을 쉽니다.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={setupExcHol}
                      onChange={(e) => setSetupExcHol(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </label>
                </div>

                {/* Live Preview Info Area */}
                <div className={`p-5 rounded-2xl border space-y-3 transition-colors ${darkMode ? "bg-zinc-950/50 border-zinc-800/60" : "bg-emerald-50/10 border-emerald-100"}`}>
                  <h4 className="text-xs font-bold text-emerald-400">📊 계획 실시간 계산 결과</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-zinc-800/40">
                      <span className="text-[10px] text-zinc-400 block mb-0.5">총 학습일수</span>
                      <span className="text-sm font-extrabold text-white">{setupPreviewStats.netDays}일</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-800/40 col-span-2">
                      <span className="text-[10px] text-zinc-400 block mb-0.5">하루 평균 분량</span>
                      <span className="text-sm font-extrabold text-amber-400">약 {setupPreviewStats.avgVerses} 구절 / 일</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-400 text-center leading-relaxed">
                    ※ 총 404구절 대상 / 제외 설정(주말 및 휴일)이 실시간 적용된 수치입니다.
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={() => generateStudyPlan(setupStartDate, setupEndDate, setupExcWk, setupExcHol)}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-sm font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
                >
                  📅 이 계획으로 암송 시작하기
                </button>
              </div>

            </div>
          </div>
        )}

        {/* --- TAB 1: DASHBOARD --- */}
        {activeTab === "dashboard" && studyPlan !== null && activeDay === null && activeChapterTest === null && (
          <div className="space-y-6 animate-fade-in">
            {/* Quick summary header banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-800/80 to-teal-700/80 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="space-y-2 text-center md:text-left">
                <div className="flex items-center gap-2.5 justify-center md:justify-start">
                  <h2 className="text-2xl font-black">📖 나만의 계시록 암송 플래너</h2>
                  <button
                    onClick={resetStudyPlan}
                    className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 select-none"
                    title="학습 계획 초기화 및 다시 짜기"
                  >
                    🔄 계획 재설정
                  </button>
                </div>
                <p className="text-zinc-100 text-sm max-w-xl">
                  {studyPlan.startDate} ~ {studyPlan.endDate} 동안 총 {studyPlan.totalDays}일에 걸쳐 요한계시록 전체 404구절을 암송하는 계획입니다.
                </p>
                <div className="flex gap-2 justify-center md:justify-start pt-2 flex-wrap">
                  <span className="bg-white/20 text-xs px-3 py-1 rounded-full font-bold">🎯 하루 평균 {(404 / studyPlan.totalDays).toFixed(1)}구절</span>
                  <span className="bg-white/20 text-xs px-3 py-1 rounded-full font-bold">🗓️ {studyPlan.totalDays}일 과정</span>
                  {studyPlan.excludeWeekends && <span className="bg-white/20 text-xs px-3 py-1 rounded-full font-bold">☕ 주말 휴식</span>}
                  {studyPlan.excludeHolidays && <span className="bg-white/20 text-xs px-3 py-1 rounded-full font-bold">🎈 공휴일 휴식</span>}
                </div>
              </div>
              
              {todayStudyStatus && (
                <div className="flex flex-col items-center gap-2">
                  {todayStudyStatus.status === "study" && todayStudyStatus.currentDayNum ? (
                    <button
                      onClick={() => handleStartDay(todayStudyStatus.currentDayNum!)}
                      className="px-6 py-3 rounded-2xl bg-white text-emerald-800 font-extrabold text-sm hover:scale-105 transition-all shadow-md whitespace-nowrap"
                    >
                      🔥 오늘의 학습 ({todayStudyStatus.currentDayNum}일차) 시작
                    </button>
                  ) : todayStudyStatus.status === "before" ? (
                    <div className="px-5 py-3 rounded-2xl bg-zinc-950/40 border border-white/10 text-center">
                      <span className="text-xs text-zinc-300 block mb-0.5">학습 시작일까지</span>
                      <span className="text-lg font-black text-amber-300">{todayStudyStatus.dDay}</span>
                    </div>
                  ) : todayStudyStatus.status === "rest" ? (
                    <button
                      onClick={() => setActiveTab("planner")}
                      className="px-6 py-3 rounded-2xl bg-white/90 hover:bg-white text-emerald-800 font-extrabold text-sm hover:scale-105 transition-all shadow-md whitespace-nowrap"
                    >
                      ☕ 오늘은 휴식일 (일정 보기)
                    </button>
                  ) : (
                    <div className="px-5 py-3 rounded-2xl bg-zinc-950/40 border border-white/10 text-center">
                      <span className="text-xs text-zinc-300 block">🏆 암송 계획 완주 완료!</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Progress circle */}
              <div className={`p-6 rounded-3xl border flex flex-col justify-between transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <div>
                  <h3 className="text-base font-bold mb-4">전체 요한계시록 암송 현황</h3>
                  <div className="flex items-center justify-center py-6">
                    <div className="relative w-40 h-40">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle className={`${darkMode ? "text-zinc-800" : "text-slate-100"}`} strokeWidth="10" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50"/>
                        <circle className="text-emerald-500 transition-all duration-1000" strokeWidth="10" strokeDasharray={2*Math.PI*38} strokeDashoffset={2*Math.PI*38*(1 - stats.percent/100)} strokeLinecap="round" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50"/>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-extrabold">{stats.percent}%</span>
                        <span className="text-xs text-zinc-400 mt-1">암기 완료</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mt-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-2 text-zinc-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>🟢 암기 완료
                      </span>
                      <span className="font-bold">{stats.learned} 구절</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-2 text-zinc-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>🟡 복습 중
                      </span>
                      <span className="font-bold">{stats.reviewing} 구절</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-2 text-zinc-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>🔴 미학습
                      </span>
                      <span className="font-bold">{stats.unlearned} / {stats.total} 구절</span>
                    </div>
                  </div>
                </div>

                {/* Streak and Study Days info */}
                <div className="mt-6 p-4 rounded-2xl bg-gradient-to-tr from-amber-600/10 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🔥</div>
                    <div>
                      <h4 className="text-sm font-bold">연속 학습 일수</h4>
                      <p className="text-xs text-zinc-400">매일 빼놓지 않고 암송하세요!</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-extrabold text-amber-500">{currentStreak}</span>
                    <span className="text-xs text-zinc-400 ml-1">일째</span>
                  </div>
                </div>

                {/* 학습 계획 진행 현황 카드 */}
                {studyPlan && todayStudyStatus && (
                  <div className={`mt-4 p-4 rounded-2xl border transition-colors ${darkMode ? "bg-zinc-800/40 border-zinc-800 text-zinc-200" : "bg-slate-50 border-slate-200 text-slate-800"}`}>
                    <h4 className="text-xs font-bold text-emerald-500 mb-2">📅 학습 계획 진행 현황</h4>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold block">{todayStudyStatus.displayMsg}</span>
                        <span className="text-[10px] text-zinc-400 block">계획 기간: {studyPlan.startDate} ~ {studyPlan.endDate}</span>
                      </div>
                      <div className="text-right">
                        {todayStudyStatus.status === "before" ? (
                          <span className="text-xs font-extrabold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">{todayStudyStatus.dDay}</span>
                        ) : todayStudyStatus.status === "completed" ? (
                          <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">완주 완료 🏆</span>
                        ) : todayStudyStatus.status === "rest" ? (
                          <span className="text-xs font-extrabold text-teal-400 bg-teal-500/10 px-2 py-1 rounded-lg border border-teal-500/20">휴식일 ☕</span>
                        ) : (
                          <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                            {todayStudyStatus.currentDayNum} / {studyPlan.totalDays} 일차
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Chapter Progress Cards */}
              <div className={`p-6 rounded-3xl border lg:col-span-2 transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold">장별 상세 진행 진도</h3>
                  <span className="text-xs text-zinc-400">클릭 시 해당 장 학습 모드로 이동</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                  {stats.chapterStats.map((ch) => (
                    <button
                      key={ch.chapter}
                      onClick={() => {
                        setSelectedChapter(ch.chapter);
                        setActiveTab("read");
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.02] ${darkMode ? "bg-zinc-800/40 border-zinc-700/60 hover:bg-zinc-800" : "bg-slate-50 border-slate-200 hover:bg-slate-100"}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm">{ch.chapter}장</span>
                        <span className="text-xs font-semibold text-emerald-400">{ch.percent}%</span>
                      </div>
                      <div className="w-full bg-zinc-700/40 h-1.5 rounded-full overflow-hidden mb-1">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${ch.percent}%` }}></div>
                      </div>
                      <div className="text-[10px] text-zinc-400 flex justify-between">
                        <span>암송 완료: {ch.learned} / {ch.total}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>



            </div>
          </div>
        )}

        {/* --- TAB 2: DAILY PLANNER (하루 5구절 플래너) --- */}
        {activeTab === "planner" && studyPlan !== null && activeDay === null && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="text-xl font-extrabold">나만의 일일 암송 스케줄러</h3>
                <p className="text-xs text-zinc-400">
                  {studyPlan.startDate} ~ {studyPlan.endDate} 동안 총 {studyPlan.totalDays}일에 걸쳐 요한계시록을 공부하는 계획입니다.
                </p>
              </div>
              <div className="bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-semibold">
                🏆 완주한 날짜: <span className="font-bold text-lg">{Object.keys(completedDays).length}</span> / {studyPlan.totalDays}일
              </div>
            </div>

            {/* Days Grid list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: studyPlan.totalDays }, (_, i) => {
                const dayNum = i + 1;
                const verses = getVersesForDay(dayNum);
                const isCompleted = completedDays[dayNum];
                const daySched = studyPlan.schedule[i];
                const dateDisplay = daySched ? `${daySched.date} (${getDayOfWeek(daySched.date)})` : "";
                
                // Get display bounds
                const startRef = verses.length > 0 ? `${verses[0].chapter}:${verses[0].verse}` : "";
                const endRef = verses.length > 0 ? `${verses[verses.length - 1].chapter}:${verses[verses.length - 1].verse}` : "";

                // Count how many are learned
                let learnedCount = 0;
                verses.forEach((v) => {
                  if (progress[`${v.chapter}:${v.verse}`] === "learned") learnedCount++;
                });
                const percent = verses.length > 0 ? Math.round((learnedCount / verses.length) * 100) : 0;

                return (
                  <div
                    key={dayNum}
                    className={`p-4 rounded-2xl border flex flex-col justify-between transition-all duration-300 ${
                      isCompleted
                        ? "bg-emerald-950/15 border-emerald-500/40 text-emerald-100 shadow-sm shadow-emerald-500/5"
                        : darkMode
                        ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                        : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2 pb-1 border-b border-zinc-800/40">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-sm text-zinc-300">{dayNum}일차</span>
                          {dateDisplay && <span className="text-[10px] text-zinc-500 font-medium">{dateDisplay}</span>}
                        </div>
                        {isCompleted ? (
                          <span className="text-xs font-bold text-amber-500 flex items-center gap-0.5">🏆 완료</span>
                        ) : percent > 0 ? (
                          <span className="text-[10px] text-amber-400 font-medium">진행 중 ({percent}%)</span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-medium">미시작</span>
                        )}
                      </div>
                      <h4 className="text-base font-extrabold mb-1">계시록 {startRef} ~ {endRef}</h4>
                      <p className="text-[11px] text-zinc-400">총 {verses.length}구절</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-850/60 flex items-center justify-between gap-2">
                      <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                      </div>
                      <button
                        onClick={() => handleStartDay(dayNum)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          isCompleted
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                            : "bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700"
                        }`}
                      >
                        {isCompleted ? "다시 복습" : percent > 0 ? "이어서 학습" : "학습 & 시험"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- DEDICATED INDIVIDUAL DAY STUDY & TEST WORKSPACE --- */}
        {activeTab === "planner" && activeDay !== null && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            {/* Navigation back and header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <button
                onClick={() => { setActiveDay(null); stopTTS(); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-800"
              >
                ⬅️ 전체 일정 목록으로 돌아가기
              </button>
              <h3 className="text-lg font-black text-amber-500">
                {activeDay}일차 집중 훈련소
              </h3>
            </div>

            {/* Step Tabs (Study -> Test) */}
            <div className="grid grid-cols-3 bg-zinc-900 p-1 rounded-2xl border border-zinc-800 text-sm font-semibold">
              <button
                onClick={() => { setDayStudyStep("study"); stopTTS(); }}
                className={`py-2 rounded-xl transition-all ${dayStudyStep === "study" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
              >
                1단계: 본문 공부하기 (Study)
              </button>
              <button
                onClick={handleGoToTest}
                className={`py-2 rounded-xl transition-all ${dayStudyStep === "test" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
              >
                2단계: 암송 시험보기 (Test)
              </button>
              <button
                disabled={!completedDays[activeDay]}
                onClick={() => { setDayStudyStep("complete"); stopTTS(); }}
                className={`py-2 rounded-xl transition-all disabled:opacity-40 ${dayStudyStep === "complete" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
              >
                3단계: 완료 증명 (Complete)
              </button>
            </div>

            {/* --- STEP 1: STUDY SUB-PANEL --- */}
            {dayStudyStep === "study" && (
              <div className="space-y-6">
                <div className={`p-6 rounded-3xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800/80">
                    <span className="text-sm text-zinc-400">📖 오늘의 {activeDayVerses.length}구절 본문을 정독하고 음성을 들으며 눈으로 익히세요.</span>
                    <button
                      onClick={() => {
                        const allHidden = revealStudyText.every(x => !x);
                        setRevealStudyText(Array(activeDayVerses.length).fill(allHidden));
                      }}
                      className="text-xs bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-xl text-zinc-300"
                    >
                      {revealStudyText.every(x => !x) ? "👁️ 전체 구절 표시" : "🙈 전체 구절 가리기"}
                    </button>
                  </div>

                  <div className="space-y-6">
                    {activeDayVerses.map((verse, idx) => {
                      const key = `${verse.chapter}:${verse.verse}`;
                      const isRevealed = revealStudyText[idx];
                      const isTtsActive = activeTtsVerse === key;

                      return (
                        <div
                          key={key}
                          className={`p-4 rounded-2xl border transition-all duration-300 ${
                            isTtsActive
                              ? "bg-emerald-950/20 border-emerald-500"
                              : darkMode
                              ? "bg-zinc-850/40 border-transparent hover:bg-zinc-850"
                              : "bg-slate-50 border-transparent hover:bg-slate-100/60"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1.5 flex-wrap">
                              요한계시록 {verse.chapter}장 {verse.verse}절
                              {isKeyVerse(verse.chapter, verse.verse) && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 select-none" title="시험 출제 핵심 주요 성구">
                                  ⭐ 핵심 주요 성구
                                </span>
                              )}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const updated = [...revealStudyText];
                                  updated[idx] = !updated[idx];
                                  setRevealStudyText(updated);
                                }}
                                className="text-xs px-2 py-1 bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
                              >
                                {isRevealed ? "가리기" : "보여주기"}
                              </button>
                              <button
                                onClick={() => playTTS(verse.text, key)}
                                className="text-xs px-2.5 py-1 bg-zinc-800 rounded hover:bg-zinc-750"
                              >
                                🔊 듣기
                              </button>
                            </div>
                          </div>

                          <p className={`text-lg leading-relaxed font-semibold transition-all duration-300 break-keep ${isRevealed ? "text-zinc-100 opacity-100" : "text-transparent bg-zinc-800 rounded select-none filter blur-sm"}`}>
                            {verse.text}
                          </p>

                          {/* Personal notes */}
                          <div className="mt-3">
                            <input
                              type="text"
                              placeholder="💡 나만의 암기 요령, 단어 연상 팁 적기..."
                              value={notes[key] || ""}
                              onChange={(e) => handleSaveNote(verse.chapter, verse.verse, e.target.value)}
                              className={`w-full px-3 py-1.5 text-xs rounded-xl border outline-none ${darkMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-800"}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions bottom */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleGoToTest}
                    className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1.5"
                  >
                    ✏️ 암송 시험 보러가기
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 2: TEST SUB-PANEL --- */}
            {dayStudyStep === "test" && activeTestVerse && (
              <div className="space-y-6">
                <div className={`p-6 rounded-3xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
                  
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800/85">
                    <span className="text-sm font-bold text-zinc-400">
                      문제 {activeTestVerseIdx + 1} / {activeDayVerses.length}
                    </span>
                    <div className="flex bg-zinc-800 p-0.5 rounded-lg border border-zinc-700 text-xs">
                      <button
                        onClick={() => setDayTestMode("initial")}
                        className={`px-3 py-1 rounded-md font-medium transition-all ${dayTestMode === "initial" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                      >
                        초성 매칭 시험
                      </button>
                      <button
                        onClick={() => setDayTestMode("full")}
                        className={`px-3 py-1 rounded-md font-medium transition-all ${dayTestMode === "full" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                      >
                        전체 입력 시험
                      </button>
                    </div>
                  </div>

                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-black bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent flex items-center justify-center gap-1.5 flex-wrap">
                      요한계시록 {activeTestVerse.chapter}장 {activeTestVerse.verse}절
                      {isKeyVerse(activeTestVerse.chapter, activeTestVerse.verse) && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 select-none animate-pulse">
                          ⭐ 핵심 주요 성구
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">아래 빈칸에 알맞은 구절을 타이핑하세요.</p>
                  </div>

                  {/* Consonant hint */}
                  {dayTestMode === "initial" && (
                    <div className="mb-6 p-4 rounded-2xl bg-zinc-850/80 border border-zinc-800/90 text-center">
                      <span className="text-[10px] text-zinc-500 block mb-1">초성 힌트</span>
                      <p className="text-lg font-bold tracking-widest text-emerald-300 leading-relaxed break-all">
                        {getInitials(activeTestVerse.text)}
                      </p>
                    </div>
                  )}

                  {/* Textarea for answer input */}
                  <div className="space-y-4">
                    <textarea
                      autoFocus
                      placeholder={dayTestMode === "initial" ? "초성을 보며 초성대로 혹은 한글로 타이핑해보세요... (앞부분의 '1절', '1.' 등은 제외하고 치셔도 됩니다)" : "성경 구절 전체를 정확히 입력해보세요..."}
                      value={dayTestAnswers[activeTestVerseIdx]}
                      onChange={(e) => {
                        const updated = [...dayTestAnswers];
                        updated[activeTestVerseIdx] = e.target.value;
                        setDayTestAnswers(updated);
                      }}
                      className={`w-full p-4 text-base rounded-2xl border outline-none min-h-[120px] transition-all duration-300 ${
                        dayTestAnswers[activeTestVerseIdx] === ""
                          ? darkMode
                            ? "bg-zinc-800 border-zinc-700"
                            : "bg-slate-50 border-slate-200"
                          : activeTestFeedback?.isMatch
                          ? activeTestFeedback?.isComplete
                            ? "bg-emerald-950/20 border-emerald-500 text-emerald-300"
                            : "bg-zinc-800 border-emerald-600 text-zinc-200"
                          : "bg-rose-950/20 border-rose-600 text-rose-300"
                      }`}
                    />

                    <div className="flex justify-between items-center text-xs">
                      <div>
                        {dayTestAnswers[activeTestVerseIdx] !== "" && (
                          <span className="font-bold">
                            {activeTestFeedback?.isMatch ? (
                              activeTestFeedback?.isComplete ? (
                                <span className="text-emerald-400">🎉 정답입니다! 다음으로 넘어가세요.</span>
                              ) : (
                                <span className="text-emerald-400">✅ 맞게 쓰고 계십니다...</span>
                              )
                            ) : (
                              <span className="text-rose-500">❌ 오타가 있습니다. 본문을 다시 떠올려보세요.</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-500">
                        허용된 입력 형식: 본문만 입력하거나, 앞에 `1.`, `1절`, `1:1`, `:1`을 함께 쳐도 모두 정답 처리됩니다.
                      </div>
                    </div>

                    {dayTestAnswers[activeTestVerseIdx] !== "" && activeTestFeedback && !activeTestFeedback.isMatch && (
                      renderDiffFeedback(dayTestAnswers[activeTestVerseIdx], activeTestVerse.text, dayTestMode)
                    )}
                  </div>

                  {/* Peek Answer button */}
                  <div className="mt-4 pt-4 border-t border-zinc-800/40 flex justify-between gap-3">
                    <button
                      onClick={() => {
                        playTTS(activeTestVerse.text, `${activeTestVerse.chapter}:${activeTestVerse.verse}`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-xs text-zinc-400"
                    >
                      🔊 힌트 음성 듣기
                    </button>
                    
                    <button
                      onClick={() => {
                        const updated = [...dayTestAnswers];
                        updated[activeTestVerseIdx] = dayTestMode === "initial" ? getInitials(activeTestVerse.text) : activeTestVerse.text;
                        setDayTestAnswers(updated);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-xs text-zinc-400"
                    >
                      👁️ 바로 정답 채우기
                    </button>
                  </div>

                </div>

                {/* Navigation inside tests */}
                <div className="flex justify-between gap-4">
                  <button
                    disabled={activeTestVerseIdx === 0}
                    onClick={() => {
                      setActiveTestVerseIdx((prev) => prev - 1);
                      stopTTS();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-xs font-bold text-zinc-400 disabled:opacity-40"
                  >
                    이전 문제
                  </button>

                  <button
                    disabled={!activeTestFeedback?.isComplete}
                    onClick={() => {
                      if (activeTestVerseIdx === activeDayVerses.length - 1) {
                        handleCompleteDay(activeDay);
                        setDayStudyStep("complete");
                        stopTTS();
                      } else {
                        setActiveTestVerseIdx((prev) => prev + 1);
                        stopTTS();
                      }
                    }}
                    className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all ${
                      activeTestFeedback?.isComplete
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-zinc-900 text-zinc-650 cursor-not-allowed border border-zinc-800"
                    }`}
                  >
                    {activeTestVerseIdx === activeDayVerses.length - 1 ? "종료 및 도장 받기 🏆" : "다음 문제로"}
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 3: COMPLETE SUB-PANEL --- */}
            {dayStudyStep === "complete" && (
              <div className={`p-8 rounded-3xl border text-center space-y-6 transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="py-6">
                  <div className="text-6xl mb-4 animate-bounce">🏆</div>
                  <h3 className="text-2xl font-black text-emerald-400">{activeDay}일차 학습 통과!</h3>
                  <p className="text-zinc-400 text-sm max-w-md mx-auto mt-2">
                    오늘 목표인 {activeDayVerses.length}구절 암송 시험을 모두 정답으로 통과하였습니다. 이 기세로 {studyPlan ? studyPlan.totalDays : 81}일 완주까지 전진하세요!
                  </p>
                </div>

                <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-xs max-w-sm mx-auto text-emerald-300 font-medium">
                  ✔️ 암기 상태 업데이트: 오늘 통과한 {activeDayVerses.length}구절의 암기 마크가 대시보드에서 자동으로 &apos;암기 완료&apos;로 변경되었습니다.
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => { setActiveDay(null); stopTTS(); }}
                    className="px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-sm font-bold"
                  >
                    목록으로 가기
                  </button>
                  {activeDay < (studyPlan ? studyPlan.totalDays : 81) && (
                    <button
                      onClick={() => handleStartDay(activeDay + 1)}
                      className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md shadow-emerald-500/20"
                    >
                      ⏩ 다음 {activeDay + 1}일차 공부 시작
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- DEDICATED KEY VERSE BATCH TEST WORKSPACE (NEW) --- */}
        {(activeTab === "read" || activeTab === "key-verses") && activeChapterTest !== null && isKeyVerseTestOnly && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in p-4 sm:p-0">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 flex-wrap gap-2">
              <button
                onClick={() => { setActiveChapterTest(null); stopTTS(); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-800"
              >
                ⬅️ 핵심성구 학습으로 돌아가기
              </button>
              <h3 className="text-lg font-black text-amber-500">
                {activeChapterTest === -1 
                  ? "요한계시록 1~22장 전체 주요성구 시험" 
                  : `요한계시록 ${activeChapterTest}장 주요성구 시험`} (총 {activeChapterTestVerses.length}구절)
              </h3>
            </div>

            {/* Global Options */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <span className="text-xs font-semibold text-zinc-400">📝 시험 모드 설정 (전체 문제 일괄 적용)</span>
              <div className="flex bg-zinc-800 p-0.5 rounded-lg border border-zinc-700 text-xs">
                <button
                  onClick={() => setKeyVerseTestModeGlobal("full")}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${keyVerseTestModeGlobal === "full" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
                >
                  전체 입력
                </button>
                <button
                  onClick={() => setKeyVerseTestModeGlobal("initial")}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${keyVerseTestModeGlobal === "initial" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
                >
                  초성 매칭
                </button>
              </div>
            </div>

            {/* Scrollable list of verses */}
            <div className="space-y-6">
              {activeChapterTestVerses.map((verse, idx) => {
                const key = `${verse.chapter}:${verse.verse}`;
                const answer = keyVerseAnswers[key] || "";
                const feedback = keyVerseScoreStatus[key] || null;
                const showStudy = keyVerseStudyReveal[key] || false;
                const isCorrect = feedback?.isComplete;

                return (
                  <div 
                    key={key} 
                    className={`p-5 rounded-3xl border transition-colors duration-300 ${
                      darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"
                    }`}
                  >
                    {/* Header line */}
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4 flex-wrap gap-2">
                      <span className="text-base font-extrabold text-emerald-400">
                        {idx + 1}. 계 {verse.chapter}장 {verse.verse}절
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {/* Study button */}
                        <button
                          onClick={() => {
                            setKeyVerseStudyReveal(prev => ({ ...prev, [key]: !prev[key] }));
                          }}
                          className="text-[11px] px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-lg flex items-center gap-1 font-bold border border-zinc-700/60"
                        >
                          📖 {showStudy ? "닫기" : "공부하기"}
                        </button>
                        
                        {/* Speech input button */}
                        <button
                          onClick={() => {
                            const el = document.getElementById(`textarea-${key}`);
                            if (el) {
                              (el as HTMLTextAreaElement).focus();
                            }
                            alert("💡 터치 후 스마트폰 키보드의 마이크 아이콘(🎙️)을 누르시면 편리하게 음성 입력을 이용할 수 있습니다.");
                          }}
                          className="text-[11px] px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-lg flex items-center gap-1 font-bold border border-zinc-700/60"
                        >
                          🎤 음성 입력
                        </button>
                      </div>
                    </div>

                    {/* Quick study text reveal if clicked */}
                    {showStudy && (
                      <div className="mb-4 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-sm text-amber-300 font-medium leading-relaxed">
                        📖 <b className="text-amber-400">공부하기 본문:</b> {verse.text}
                      </div>
                    )}

                    {/* Consonant Hint */}
                    {keyVerseTestModeGlobal === "initial" && (
                      <div className="mb-4 p-3.5 rounded-xl bg-zinc-850/60 border border-zinc-800/80">
                        <span className="text-[10px] text-zinc-500 block mb-0.5">초성 힌트</span>
                        <p className="text-sm font-bold tracking-widest text-emerald-300 leading-relaxed break-all">
                          {getInitials(verse.text)}
                        </p>
                      </div>
                    )}

                    {/* Text Area */}
                    <div className="space-y-4">
                      <textarea
                        id={`textarea-${key}`}
                        placeholder={
                          keyVerseTestModeGlobal === "initial"
                            ? "초성을 보며 초성 혹은 한글로 입력해보세요..."
                            : "암송한 성구를 입력하세요..."
                        }
                        value={answer}
                        onChange={(e) => {
                          setKeyVerseAnswers(prev => ({ ...prev, [key]: e.target.value }));
                          if (keyVerseScoreStatus[key]) {
                            setKeyVerseScoreStatus(prev => ({ ...prev, [key]: null }));
                          }
                        }}
                        className={`w-full p-4 text-sm sm:text-base rounded-2xl border outline-none min-h-[100px] transition-all duration-350 ${
                          answer === ""
                            ? darkMode
                              ? "bg-zinc-800 border-zinc-700 focus:border-zinc-650"
                              : "bg-slate-50 border-slate-200"
                            : isCorrect
                            ? "bg-emerald-950/20 border-emerald-500 text-emerald-300 font-medium"
                            : feedback
                            ? "bg-rose-950/20 border-rose-600 text-rose-300"
                            : darkMode
                            ? "bg-zinc-800 border-zinc-700"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      />

                      {/* Score Result Status */}
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          {feedback && (
                            <span className="font-bold">
                              {isCorrect ? (
                                <span className="text-emerald-400">🎉 일치합니다! 암기완료로 등록되었습니다.</span>
                              ) : (
                                <span className="text-rose-500">❌ 오타가 있습니다. 다시 확인해보세요.</span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 text-right hidden sm:block">
                          본문만 적어도 모두 통과됩니다.
                        </div>
                      </div>

                      {feedback && !isCorrect && !feedback.isMatch && (
                        renderDiffFeedback(answer, verse.text, keyVerseTestModeGlobal)
                      )}

                      {/* Grading Submit Button */}
                      <button
                        onClick={() => {
                          const feed = getTypingFeedback(answer, verse.text, keyVerseTestModeGlobal);
                          setKeyVerseScoreStatus(prev => ({ ...prev, [key]: feed }));
                          
                          if (feed?.isComplete) {
                            handleUpdateStatus(verse.chapter, verse.verse, "learned");
                          }
                        }}
                        className={`w-full py-3 rounded-2xl text-white font-extrabold text-sm shadow-md transition-all ${
                          isCorrect
                            ? "bg-emerald-700 hover:bg-emerald-600 cursor-default"
                            : "bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] active:scale-95"
                        }`}
                      >
                        {isCorrect ? "채점 완료 (일치)" : "정답 제출"}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => {
                  let correctCount = 0;
                  activeChapterTestVerses.forEach(v => {
                    const key = `${v.chapter}:${v.verse}`;
                    if (keyVerseScoreStatus[key]?.isComplete) {
                      correctCount++;
                    }
                  });
                  
                  if (correctCount === activeChapterTestVerses.length) {
                    alert(`🎉 축하합니다! 모든 성구(${correctCount}개)를 통과하셨습니다.`);
                    setActiveChapterTest(null);
                  } else {
                    if (confirm(`현재 총 ${activeChapterTestVerses.length}구절 중 ${correctCount}구절을 통과하셨습니다. 시험을 중단하고 돌아가시겠습니까?`)) {
                      setActiveChapterTest(null);
                    }
                  }
                }}
                className="px-8 py-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-zinc-150 border border-zinc-800 text-sm font-bold rounded-2xl transition-colors"
              >
                시험 종료 및 돌아가기
              </button>
            </div>
          </div>
        )}

        {/* --- DEDICATED CHAPTER-BY-CHAPTER TEST WORKSPACE --- */}
        {(activeTab === "read" || activeTab === "key-verses") && activeChapterTest !== null && !isKeyVerseTestOnly && activeChapterTestVerse && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <button
                onClick={() => { setActiveChapterTest(null); stopTTS(); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-xs font-bold text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-800"
              >
                {isKeyVerseTestOnly ? "⬅️ 핵심성구 학습으로 돌아가기" : "⬅️ 성경 학습으로 돌아가기"}
              </button>
              <h3 className="text-lg font-black text-amber-500">
                요한계시록 {activeChapterTest}장 {isKeyVerseTestOnly ? "핵심 주요성구 시험" : "전체 시험"} (총 {activeChapterTestVerses.length}구절)
              </h3>
            </div>

            <div className={`p-6 rounded-3xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800/85">
                <span className="text-sm font-bold text-zinc-400">
                  구절 시험 {activeChapterTestIdx + 1} / {activeChapterTestVerses.length}
                </span>
                
                {/* Mode toggle */}
                <div className="flex bg-zinc-800 p-0.5 rounded-lg border border-zinc-700 text-xs">
                  <button
                    onClick={() => { setChapterTestMode("initial"); }}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${chapterTestMode === "initial" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
                  >
                    초성 매칭
                  </button>
                  <button
                    onClick={() => { setChapterTestMode("full"); }}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${chapterTestMode === "full" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
                  >
                    전체 입력
                  </button>
                </div>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-2xl font-black text-amber-400">
                  계시록 {activeChapterTestVerse.chapter}장 {activeChapterTestVerse.verse}절
                </h3>
              </div>

              {/* Consonant Hint */}
              {chapterTestMode === "initial" && (
                <div className="mb-4 p-3.5 rounded-xl bg-zinc-850/60 border border-zinc-800/80 text-center">
                  <span className="text-[10px] text-zinc-500 block mb-0.5">초성 힌트</span>
                  <p className="text-base font-bold tracking-widest text-emerald-300 leading-relaxed break-all">
                    {getInitials(activeChapterTestVerse.text)}
                  </p>
                </div>
              )}

              {/* Input Area */}
              <div className="space-y-4">
                <textarea
                  autoFocus
                  placeholder={chapterTestMode === "initial" ? "초성을 보며 초성 혹은 한글로 입력해보세요..." : "구절 텍스트 전체를 타이핑해보세요..."}
                  value={chapterTestAnswers[activeChapterTestIdx] || ""}
                  onChange={(e) => {
                    const updated = [...chapterTestAnswers];
                    updated[activeChapterTestIdx] = e.target.value;
                    setChapterTestAnswers(updated);
                  }}
                  className={`w-full p-4 text-base rounded-2xl border outline-none min-h-[110px] transition-all duration-350 ${
                    (chapterTestAnswers[activeChapterTestIdx] || "") === ""
                      ? darkMode
                        ? "bg-zinc-800 border-zinc-700"
                        : "bg-slate-50 border-slate-200"
                      : activeChapterTestFeedback?.isMatch
                      ? activeChapterTestFeedback?.isComplete
                        ? "bg-emerald-950/20 border-emerald-500 text-emerald-300"
                        : "bg-zinc-800 border-emerald-600 text-zinc-200"
                      : "bg-rose-950/20 border-rose-600 text-rose-300"
                  }`}
                />

                <div className="flex justify-between items-center text-xs">
                  <div>
                    {(chapterTestAnswers[activeChapterTestIdx] || "") !== "" && (
                      <span className="font-bold">
                        {activeChapterTestFeedback?.isMatch ? (
                          activeChapterTestFeedback?.isComplete ? (
                            <span className="text-emerald-400">🎉 일치합니다! 다음 구절로 가세요.</span>
                          ) : (
                            <span className="text-emerald-400">✅ 맞게 쓰고 계십니다...</span>
                          )
                        ) : (
                          <span className="text-rose-500">❌ 오타가 있습니다.</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="text-zinc-500">
                    앞부분에 장/절 번호(예: `1.`, `1절`, `1:1`, `:1`)를 적거나 본문만 적어도 모두 통과됩니다.
                  </div>
                </div>

                {(chapterTestAnswers[activeChapterTestIdx] || "") !== "" && activeChapterTestFeedback && !activeChapterTestFeedback.isMatch && (
                  renderDiffFeedback(chapterTestAnswers[activeChapterTestIdx] || "", activeChapterTestVerse.text, chapterTestMode)
                )}
              </div>

              {/* Hints */}
              <div className="mt-4 pt-4 border-t border-zinc-800/40 flex justify-between gap-3">
                <button
                  onClick={() => playTTS(activeChapterTestVerse.text, `${activeChapterTestVerse.chapter}:${activeChapterTestVerse.verse}`)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-400"
                >
                  🔊 음성 힌트 듣기
                </button>
                <button
                  onClick={() => {
                    const updated = [...chapterTestAnswers];
                    updated[activeChapterTestIdx] = chapterTestMode === "initial" ? getInitials(activeChapterTestVerse.text) : activeChapterTestVerse.text;
                    setChapterTestAnswers(updated);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-400"
                >
                  👁️ 정답 채우기
                </button>
              </div>

            </div>

            {/* Test Navigation */}
            <div className="flex justify-between gap-4">
              <button
                disabled={activeChapterTestIdx === 0}
                onClick={() => {
                  setActiveChapterTestIdx((prev) => prev - 1);
                  stopTTS();
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-xs font-bold text-zinc-400 disabled:opacity-40"
              >
                이전 구절
              </button>

              <button
                disabled={!activeChapterTestFeedback?.isComplete}
                onClick={() => {
                  if (activeChapterTestIdx === activeChapterTestVerses.length - 1) {
                    handleCompleteChapterTest();
                  } else {
                    setActiveChapterTestIdx((prev) => prev + 1);
                    stopTTS();
                  }
                }}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all ${
                  activeChapterTestFeedback?.isComplete
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-zinc-900 text-zinc-650 cursor-not-allowed border border-zinc-800"
                }`}
              >
                {activeChapterTestIdx === activeChapterTestVerses.length - 1 ? "채점 완료 및 시험 통과 🏆" : "다음 구절 시험"}
              </button>
            </div>

            {/* Answer peek panel */}
            <div className="text-center">
              <button
                onClick={() => setShowChapterTestAnswer(!showChapterTestAnswer)}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline"
              >
                {showChapterTestAnswer ? "힌트 본문 숨기기" : "힌트 본문 보기"}
              </button>
              {showChapterTestAnswer && (
                <div className="mt-4 p-4 rounded-xl border border-dashed border-zinc-800 text-left bg-zinc-900/50">
                  <p className="text-sm font-semibold">{activeChapterTestVerse.text}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 3: BIBLE READER (성경 학습 1~22장) --- */}
        {activeTab === "read" && activeChapterTest === null && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            
            {/* Audio controllers toolbar */}
            <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
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
                        const first = filteredVerses[0];
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
                  <span>배속:</span>
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

            {/* Main Reader panel */}
            <div className={`p-8 rounded-3xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="max-w-2xl mx-auto space-y-6">
                
                <div className="text-center mb-8 border-b border-zinc-800/80 pb-6">
                  <h2 className="text-3xl font-extrabold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    {selectedChapter === 0 ? "요한계시록 전체 구절" : `요한계시록 ${selectedChapter}장`}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-2">왼쪽 번호 및 기호(🟢🟡🔴)를 눌러서 개별 구절 상태를 변경하거나 스피커를 눌러 구절을 낭독시킬 수 있습니다.</p>
                  
                  {selectedChapter !== 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => handleStartChapterTest(selectedChapter)}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-2xl text-xs font-black hover:scale-105 transition-all shadow-md flex items-center gap-1.5 mx-auto"
                      >
                        ✏️ {selectedChapter}장 전체 시험보기 (총 {REVELATION_VERSES.filter(v => v.chapter === selectedChapter).length}구절)
                      </button>
                    </div>
                  )}
                </div>

                {filteredVerses.length === 0 && (
                  <div className="text-center py-10 text-zinc-500">조건과 일치하는 구절이 없습니다.</div>
                )}

                <div className="space-y-6">
                  {filteredVerses.map((v) => {
                    const key = `${v.chapter}:${v.verse}`;
                    const status = progress[key] || "unlearned";
                    const hasNote = !!notes[key];
                    const isTtsActive = activeTtsVerse === key;

                    return (
                      <div
                        key={key}
                        className={`group p-4 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-start gap-4 ${
                          isTtsActive
                            ? "bg-emerald-950/20 border-emerald-500 scale-[1.01]"
                            : darkMode
                            ? "bg-zinc-850/30 border-transparent hover:bg-zinc-850 hover:border-zinc-800"
                            : "bg-slate-50 border-transparent hover:bg-slate-100 hover:border-slate-200"
                        }`}
                      >
                        {/* Controllers side */}
                        <div className="flex items-center md:flex-col gap-2 min-w-[70px]">
                          <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-0.5">
                            {isKeyVerse(v.chapter, v.verse) && <span className="text-[11px]" title="핵심 주요 성구">⭐</span>}
                            {v.chapter}:{v.verse}
                          </span>
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
                            title="상태 전환"
                          >
                            {status === "learned" ? "🟢" : status === "reviewing" ? "🟡" : "🔴"}
                          </button>
                          <button
                            onClick={() => playTTS(v.text, key)}
                            className="p-1 rounded hover:bg-zinc-700/50 transition-opacity text-xs"
                            title="구절 읽기"
                          >
                            🔊
                          </button>
                        </div>

                        {/* Text Content side */}
                        <div className="flex-1">
                          <p className="text-lg leading-relaxed break-keep font-medium select-text">
                            {v.text}
                          </p>
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

        {/* --- TAB 3.5: KEY VERSES (핵심 주요 성구 학습) --- */}
        {activeTab === "key-verses" && activeChapterTest === null && (
          <div className="space-y-6 animate-fade-in">
            {/* Header info card */}
            <div className={`p-5 rounded-3xl border transition-colors duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-amber-400 flex items-center gap-2">⭐ 계시록 완벽숙지 - 핵심 주요 성구 (102구절)</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  ※ <b>시험 참고사항</b>: 서술형(통째로 쓰기) 문제는 오직 본 <b>장별 주요 성구(총 102구절)</b> 내에서만 출제됩니다.<br />
                  여기에 정리된 각 장별 핵심 성구들을 완벽하게 암송하고 자가 점검해 보세요.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-2xl select-none">
                <span className="text-amber-400 text-lg font-bold">🎯</span>
                <div>
                  <span className="text-[10px] text-zinc-400 block">전체 주요성구 암기율</span>
                  <span className="text-sm font-extrabold text-amber-400">
                    {(() => {
                      let totalKey = 0;
                      let learnedKey = 0;
                      REVELATION_VERSES.forEach((v) => {
                        if (isKeyVerse(v.chapter, v.verse)) {
                          totalKey++;
                          if (progress[`${v.chapter}:${v.verse}`] === "learned") {
                            learnedKey++;
                          }
                        }
                      });
                      const pct = totalKey > 0 ? Math.round((learnedKey / totalKey) * 100) : 0;
                      return `${learnedKey} / ${totalKey}구절 (${pct}%)`;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Split panel */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Left panel: Chapter selection with indicators */}
              <div className={`lg:col-span-1 p-4 rounded-3xl border h-fit space-y-2 max-h-[75vh] overflow-y-auto custom-scrollbar ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}`}>
                <span className="block text-xs font-bold text-zinc-400 mb-3 px-2">📖 장별 주요 성구 목록</span>
                <button
                  onClick={() => handleStartChapterTest(-1, true)}
                  className="w-full mb-3 px-3.5 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:scale-[1.02] active:scale-95 text-white rounded-2xl text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 transition-all"
                >
                  ⭐ 1~22장 전체 주요성구 시험
                </button>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                  {Array.from({ length: 22 }, (_, i) => {
                    const chNum = i + 1;
                    const chVerses = REVELATION_VERSES.filter((v) => v.chapter === chNum && isKeyVerse(chNum, v.verse));
                    const chTotal = chVerses.length;
                    let chLearned = 0;
                    chVerses.forEach((v) => {
                      if (progress[`${v.chapter}:${v.verse}`] === "learned") {
                        chLearned++;
                      }
                    });
                    const isSelected = keyVersesSelectedChapter === chNum;
                    const isAllLearned = chTotal > 0 && chLearned === chTotal;

                    return (
                      <button
                        key={chNum}
                        onClick={() => {
                          setKeyVersesSelectedChapter(chNum);
                          stopTTS();
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between border transition-all duration-200 active:scale-95 ${
                          isSelected
                            ? "bg-emerald-600 border-emerald-500 text-white shadow-md"
                            : isAllLearned
                            ? darkMode
                              ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-400 hover:bg-zinc-800"
                              : "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-slate-50"
                            : darkMode
                            ? "bg-zinc-850/60 border-transparent text-zinc-300 hover:bg-zinc-800"
                            : "bg-slate-50 border-transparent text-zinc-700 hover:bg-slate-100/60"
                        }`}
                      >
                        <span>계시록 {chNum}장</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : isAllLearned
                            ? "bg-emerald-500/10 text-emerald-400"
                            : darkMode
                            ? "bg-zinc-800 text-zinc-400"
                            : "bg-slate-200 text-slate-500"
                        }`}>
                          {chLearned}/{chTotal}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right panel: Verse study cards */}
              <div className="lg:col-span-3 space-y-4">
                {(() => {
                  const targetVerses = REVELATION_VERSES.filter(
                    (v) => v.chapter === keyVersesSelectedChapter && isKeyVerse(keyVersesSelectedChapter, v.verse)
                  );

                  if (targetVerses.length === 0) {
                    return (
                      <div className={`text-center py-20 text-zinc-500 rounded-3xl border ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}`}>
                        이 장에는 등록된 주요성구가 없습니다.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Chapter Test Trigger for Key Verses */}
                      <div className={`p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
                        <div className="space-y-1">
                          <span className="text-sm font-extrabold text-amber-400 block flex items-center gap-1.5">
                            ✏️ 계시록 {keyVersesSelectedChapter}장 주요성구 시험보기
                          </span>
                          <span className="text-xs text-zinc-400 block leading-relaxed">
                            이 장의 핵심 주요 성구 <b>{targetVerses.length}구절</b>만 대상으로 암송 쓰기 시험을 시작합니다.
                          </span>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                          {/* Hide/Reveal toggle button */}
                          <button
                            onClick={() => {
                              setHideAllKeyVerseText(prev => !prev);
                              setIndividualReveal({}); // Reset individual reveals
                            }}
                            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                              hideAllKeyVerseText
                                ? "bg-zinc-800 border-zinc-700 text-amber-400 font-extrabold"
                                : darkMode
                                ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-300"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {hideAllKeyVerseText ? "👁️ 전체 보이기" : "🙈 전체 가리기"}
                          </button>
                          <button
                            onClick={() => handleStartChapterTest(keyVersesSelectedChapter, true)}
                            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:scale-105 active:scale-95 text-white rounded-2xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap transition-all"
                          >
                            주요성구 시험 시작
                          </button>
                        </div>
                      </div>

                      {targetVerses.map((v) => {
                        const key = `${v.chapter}:${v.verse}`;
                        const status = progress[key] || "unlearned";

                        return (
                          <div
                            key={key}
                            className={`p-5 rounded-3xl border transition-all duration-300 flex flex-col gap-4 ${
                              darkMode
                                ? "bg-zinc-900 border-zinc-800 hover:border-zinc-750"
                                : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                            }`}
                          >
                            {/* Card Header: Reference and Status Badge only */}
                            <div className="flex items-center justify-between border-b pb-3 border-zinc-800/20 flex-wrap gap-2">
                              <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1.5">
                                ⭐ 요한계시록 {v.chapter}장 {v.verse}절
                              </span>
                              <div className="flex items-center gap-2">
                                {status === "learned" ? (
                                  <span className="text-[10px] px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-lg">
                                    🟢 암기 완료
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold rounded-lg">
                                    🔴 미학습
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Card Content: Text with interactive blur hide masking */}
                            <div 
                              onClick={() => {
                                if (hideAllKeyVerseText) {
                                  setIndividualReveal(prev => ({ ...prev, [key]: !prev[key] }));
                                }
                              }}
                              className={`p-1.5 rounded-xl transition-all ${
                                hideAllKeyVerseText && !individualReveal[key]
                                  ? "bg-zinc-950/40 text-transparent select-none blur-sm cursor-pointer hover:bg-zinc-950/20"
                                  : "cursor-text"
                              }`}
                            >
                              <p className="text-lg leading-relaxed break-keep font-medium select-text">
                                {v.text}
                              </p>
                              {hideAllKeyVerseText && !individualReveal[key] && (
                                <span className="block text-[10px] text-center text-zinc-400 font-bold mt-1.5 animate-pulse">
                                  💡 터치하여 본문 가리기 해제
                                </span>
                              )}
                            </div>

                            {/* Card Footer: Notes/Memos */}
                            <div className="pt-2">
                              <textarea
                                placeholder="여기에 암기 팁이나 묵상한 핵심 키워드를 적으세요..."
                                value={notes[key] || ""}
                                onChange={(e) => handleSaveNote(v.chapter, v.verse, e.target.value)}
                                className={`w-full p-2.5 text-xs rounded-xl border outline-none min-h-[50px] ${
                                  darkMode
                                    ? "bg-zinc-800 border-zinc-700 text-white focus:border-emerald-500/50"
                                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500/50"
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        )}

        {/* --- TAB 4: PRACTICE (개별 훈련소) --- */}
        {activeTab === "practice" && currentPracticeVerse && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            
            {/* Sub-tab selection */}
            <div className="grid grid-cols-3 bg-zinc-900 p-1 rounded-2xl border border-zinc-800 text-sm font-semibold">
              <button
                onClick={() => setPracticeSubTab("card")}
                className={`py-2 rounded-xl transition-all ${practiceSubTab === "card" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
              >
                플래시카드 훈련
              </button>
              <button
                onClick={() => setPracticeSubTab("blank")}
                className={`py-2 rounded-xl transition-all ${practiceSubTab === "blank" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
              >
                빈칸 채우기 훈련
              </button>
              <button
                onClick={() => setPracticeSubTab("typing")}
                className={`py-2 rounded-xl transition-all ${practiceSubTab === "typing" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
              >
                타이핑 테스트 훈련
              </button>
            </div>

            {/* --- SUB-TAB A: FLASHCARD --- */}
            {practiceSubTab === "card" && (
              <div className="space-y-6">
                <div className="perspective-1000 w-full min-h-[260px] cursor-pointer" onClick={() => setIsPracticeCardFlipped(!isPracticeCardFlipped)}>
                  <div className={`relative w-full h-full min-h-[260px] duration-500 preserve-3d ${isPracticeCardFlipped ? "rotate-y-180" : ""}`}>
                    
                    {/* Front */}
                    <div className={`absolute inset-0 w-full h-full p-8 rounded-3xl border flex flex-col justify-between backface-hidden transition-all duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800 hover:border-zinc-750" : "bg-white border-slate-200 hover:border-slate-300 shadow-lg"}`}>
                      <div className="flex justify-between items-center">
                        <span className="px-3 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                          요한계시록
                          {isKeyVerse(currentPracticeVerse.chapter, currentPracticeVerse.verse) && (
                            <span className="text-amber-400 font-bold" title="핵심 주요 성구">★ 핵심</span>
                          )}
                        </span>
                        <span className="text-xs text-zinc-400">클릭하여 뒤집기</span>
                      </div>
                      <div className="text-center my-auto py-6">
                        <h2 className="text-4xl font-extrabold tracking-tight flex items-center justify-center gap-2">
                          {currentPracticeVerse.chapter}장 {currentPracticeVerse.verse}절
                          {isKeyVerse(currentPracticeVerse.chapter, currentPracticeVerse.verse) && (
                            <span className="text-2xl text-amber-400" title="핵심 주요 성구">⭐</span>
                          )}
                        </h2>
                      </div>
                      <div className="flex justify-between items-center text-xs text-zinc-400">
                        <span>번호: {currentPracticeIndex + 1} / {filteredVerses.length}</span>
                        <span>
                          상태: {progress[`${currentPracticeVerse.chapter}:${currentPracticeVerse.verse}`] === "learned" ? "🟢 암기완료" : progress[`${currentPracticeVerse.chapter}:${currentPracticeVerse.verse}`] === "reviewing" ? "🟡 복습중" : "🔴 미학습"}
                        </span>
                      </div>
                    </div>

                    {/* Back */}
                    <div className={`absolute inset-0 w-full h-full p-8 rounded-3xl border flex flex-col justify-between rotate-y-180 backface-hidden transition-all duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-lg"}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                          {currentPracticeVerse.chapter}장 {currentPracticeVerse.verse}절
                          {isKeyVerse(currentPracticeVerse.chapter, currentPracticeVerse.verse) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 select-none">
                              ★ 핵심 주요 성구
                            </span>
                          )}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playTTS(currentPracticeVerse.text, `${currentPracticeVerse.chapter}:${currentPracticeVerse.verse}`);
                          }}
                          className="p-1 rounded bg-zinc-800 text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          🔊 듣기
                        </button>
                      </div>
                      <div className="my-auto py-2">
                        <p className="text-lg sm:text-xl leading-relaxed font-semibold text-center break-keep tracking-wide">{currentPracticeVerse.text}</p>
                      </div>
                      <div className="text-right text-xs text-zinc-500">클릭하여 다시 가리기</div>
                    </div>

                  </div>
                </div>

                {/* Tag status */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleUpdateStatus(currentPracticeVerse.chapter, currentPracticeVerse.verse, "unlearned")}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${progress[`${currentPracticeVerse.chapter}:${currentPracticeVerse.verse}`] === "unlearned" || !progress[`${currentPracticeVerse.chapter}:${currentPracticeVerse.verse}`] ? "bg-rose-600 border-rose-500 text-white" : "bg-zinc-900 text-rose-500"}`}
                  >
                    🔴 미학습
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(currentPracticeVerse.chapter, currentPracticeVerse.verse, "reviewing")}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${progress[`${currentPracticeVerse.chapter}:${currentPracticeVerse.verse}`] === "reviewing" ? "bg-amber-600 border-amber-500 text-white" : "bg-zinc-900 text-amber-500"}`}
                  >
                    🟡 복습 중
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(currentPracticeVerse.chapter, currentPracticeVerse.verse, "learned")}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${progress[`${currentPracticeVerse.chapter}:${currentPracticeVerse.verse}`] === "learned" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-zinc-900 text-emerald-500"}`}
                  >
                    🟢 암기 완료
                  </button>
                </div>
                {/* Keyboard Shortcuts Guide */}
                <div className="hidden md:flex justify-center items-center gap-x-4 gap-y-1 flex-wrap text-[10px] text-zinc-500 bg-zinc-900/30 p-2.5 rounded-xl border border-zinc-800/40 mt-3 select-none">
                  <span>⌨️ <b>단축키</b></span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">Space</kbd> 뒤집기</span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">←</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">→</kbd> 이동</span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">L</kbd> 암기완료</span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">R</kbd> 복습중</span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">U</kbd> 미학습</span>
                  <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">S</kbd> 오디오 재생/정지</span>
                </div>
              </div>
            )}

            {/* --- SUB-TAB B: BLANKS --- */}
            {practiceSubTab === "blank" && (
              <div className="space-y-6">
                <div className={`p-6 rounded-3xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
                  <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h3 className="text-base font-bold text-emerald-400">{currentPracticeVerse.chapter}장 {currentPracticeVerse.verse}절</h3>
                    <div className="flex bg-zinc-850 p-0.5 rounded-lg border border-zinc-700 text-xs">
                      {(["easy", "medium", "hard"] as const).map((diff) => (
                        <button
                          key={diff}
                          onClick={() => { setBlankDifficulty(diff); setRevealedBlanks([]); }}
                          className={`px-2.5 py-1 rounded-md font-medium transition-all ${blankDifficulty === diff ? "bg-emerald-600 text-white" : "text-zinc-400"}`}
                        >
                          {diff === "easy" ? "쉬움" : diff === "medium" ? "보통" : "어려움"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-lg sm:text-xl leading-loose font-semibold text-center py-6 select-none flex flex-wrap gap-x-2 gap-y-3 justify-center">
                    {blankedPracticeWords.map((word, idx) => {
                      const isRevealed = revealedBlanks.includes(idx);
                      if (word.isMasked && !isRevealed) {
                        return (
                          <span
                            key={idx}
                            onClick={() => setRevealedBlanks([...revealedBlanks, idx])}
                            className="px-3 bg-zinc-800 hover:bg-zinc-700 text-transparent border-b-2 border-emerald-500 rounded cursor-pointer transition-colors"
                          >
                            {word.text.replace(/./g, "?")}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={idx}
                          onClick={() => { if (word.isMasked) setRevealedBlanks(revealedBlanks.filter(i => i !== idx)); }}
                          className={`transition-all ${word.isMasked ? "text-emerald-400 border-b-2 border-dashed border-emerald-400/50" : ""}`}
                        >
                          {word.text}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between gap-3">
                  <button onClick={() => setRevealedBlanks([])} className="px-3 py-1.5 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs rounded-xl">
                    🔄 다시 가리기
                  </button>
                  <button onClick={() => setRevealedBlanks(Array.from({ length: blankedPracticeWords.length }, (_, i) => i))} className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs rounded-xl">
                    👁️ 전체 정답 보기
                  </button>
                </div>
              </div>
            )}

            {/* --- SUB-TAB C: TYPING TEST --- */}
            {practiceSubTab === "typing" && (
              <div className="space-y-6">
                <div className={`p-6 rounded-3xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>
                  <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h3 className="text-base font-bold text-emerald-400">{currentPracticeVerse.chapter}장 {currentPracticeVerse.verse}절</h3>
                    <div className="flex bg-zinc-805 p-0.5 rounded-lg border border-zinc-700 text-[10px]">
                      <button onClick={() => { setTypingMode("initial"); setPracticeUserInput(""); }} className={`px-2.5 py-1 rounded transition-all ${typingMode === "initial" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>
                        초성 모드
                      </button>
                      <button onClick={() => { setTypingMode("full"); setPracticeUserInput(""); }} className={`px-2.5 py-1 rounded transition-all ${typingMode === "full" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>
                        전체 모드
                      </button>
                    </div>
                  </div>

                  {typingMode === "initial" && (
                    <div className="mb-4 p-3 rounded-xl bg-zinc-850/60 border border-zinc-800/80 text-center">
                      <span className="text-[10px] text-zinc-500 block mb-0.5">초성 힌트</span>
                      <p className="text-sm font-bold tracking-widest text-emerald-300 leading-relaxed">
                        {getInitials(currentPracticeVerse.text)}
                      </p>
                    </div>
                  )}

                  <textarea
                    placeholder="암송하며 한글 혹은 초성으로 입력해 보세요..."
                    value={practiceUserInput}
                    onChange={(e) => setPracticeUserInput(e.target.value)}
                    className={`w-full p-4 text-base rounded-2xl border outline-none min-h-[110px] transition-all duration-350 ${
                      practiceUserInput === ""
                        ? darkMode
                          ? "bg-zinc-800 border-zinc-700"
                          : "bg-slate-50 border-slate-200"
                        : getTypingFeedback(practiceUserInput, currentPracticeVerse.text, typingMode)?.isMatch
                        ? getTypingFeedback(practiceUserInput, currentPracticeVerse.text, typingMode)?.isComplete
                          ? "bg-emerald-950/20 border-emerald-500 text-emerald-300"
                          : "bg-zinc-800 border-emerald-600 text-zinc-200"
                        : "bg-rose-950/20 border-rose-600 text-rose-300"
                    }`}
                  />

                  <div className="flex justify-between items-center text-xs mt-2">
                    <div>
                      {practiceUserInput !== "" && (
                        <span className="font-bold">
                          {getTypingFeedback(practiceUserInput, currentPracticeVerse.text, typingMode)?.isMatch ? (
                            getTypingFeedback(practiceUserInput, currentPracticeVerse.text, typingMode)?.isComplete ? (
                              <span className="text-emerald-400">🎉 정답 통과!</span>
                            ) : (
                              <span className="text-emerald-400">✅ 올바른 입력 중...</span>
                            )
                          ) : (
                            <span className="text-rose-500">❌ 오타가 있습니다.</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-zinc-500">
                      앞부분에 `1.`, `1절`, `1:1`, `:1`을 쓰거나 생략해도 채점 시 정상 통과됩니다.
                    </div>
                  </div>
                </div>

                <div className="flex justify-between gap-3">
                  <button onClick={() => setShowPracticeAnswer(!showPracticeAnswer)} className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-xl">
                    {showPracticeAnswer ? "👁️ 정답 숨기기" : "👁️ 정답 보기"}
                  </button>
                  <button onClick={() => setPracticeUserInput("")} className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 text-xs rounded-xl">
                    지우기
                  </button>
                </div>

                {showPracticeAnswer && (
                  <div className="p-4 rounded-xl border border-dashed border-emerald-800 bg-emerald-950/5">
                    <p className="text-sm font-semibold leading-relaxed">{currentPracticeVerse.text}</p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation inside practices */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <button
                disabled={currentPracticeIndex === 0}
                onClick={() => {
                  setCurrentPracticeIndex((prev) => prev - 1);
                  setIsPracticeCardFlipped(false);
                  setPracticeUserInput("");
                  setShowPracticeAnswer(false);
                  setRevealedBlanks([]);
                  stopTTS();
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-xs font-bold text-zinc-400 disabled:opacity-40"
              >
                이전 구절
              </button>

              <button
                disabled={currentPracticeIndex === filteredVerses.length - 1}
                onClick={() => {
                  const feed = getTypingFeedback(practiceUserInput, currentPracticeVerse.text, typingMode);
                  if (practiceSubTab === "typing" && feed?.isComplete) {
                    handleUpdateStatus(currentPracticeVerse.chapter, currentPracticeVerse.verse, "learned");
                  }
                  
                  setCurrentPracticeIndex((prev) => prev + 1);
                  setIsPracticeCardFlipped(false);
                  setPracticeUserInput("");
                  setShowPracticeAnswer(false);
                  setRevealedBlanks([]);
                  stopTTS();
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-40"
              >
                다음 구절
              </button>
            </div>

            {/* Personal Notes section */}
            <div className={`p-4 rounded-2xl border ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}`}>
              <label className="block text-xs font-bold text-zinc-400 mb-2">📝 개인 묵상 및 메모 기록</label>
              <textarea
                placeholder="해당 구절에 메모나 연상 단어를 적어 기억을 돕도록 하세요..."
                value={notes[`${currentPracticeVerse.chapter}:${currentPracticeVerse.verse}`] || ""}
                onChange={(e) => handleSaveNote(currentPracticeVerse.chapter, currentPracticeVerse.verse, e.target.value)}
                className={`w-full p-3 text-xs rounded-xl border outline-none min-h-[80px] ${darkMode ? "bg-zinc-800 border-zinc-700 text-white" : "bg-slate-50 border-slate-200 text-slate-800"}`}
              />
            </div>

          </div>
        )}

      </main>

      {/* --- FOOTER --- */}
      <footer className={`mt-12 py-8 border-t text-center text-xs text-zinc-500 transition-colors duration-300 ${darkMode ? "bg-zinc-950 border-zinc-900" : "bg-slate-100 border-slate-200"}`}>
        <p className="mb-2">계시록 완벽숙지 | 1장 1절 ~ 22장 21절 (404구절)</p>
        <p>© 2026 Revelation Planner. 공부하고 채점하는 암송 학습지.</p>
      </footer>
    </div>
  );
}
