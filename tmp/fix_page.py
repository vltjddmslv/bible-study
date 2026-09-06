# coding: utf-8
"""Binary-safe patch script for page.tsx"""
import codecs

filepath = r"d:\01.vibe\nextjs\02.study\app\page.tsx"

with open(filepath, "rb") as f:
    raw = f.read()

print("File size:", len(raw), "bytes")

def b(s):
    return s.encode("utf-8")

# ── CHANGE 1: handleCompleteDay ──────────────────────────────────────────────
old1 = b(
    '  const handleCompleteDay = (day: number) => {\r\n'
    '    const newCompleted = { ...completedDays, [day]: true };\r\n'
    '    setCompletedDays(newCompleted);\r\n'
    '    localStorage.setItem("rev_completed_days", JSON.stringify(newCompleted));\r\n'
    '\r\n'
    '    // Mark all verses in this day as learned\r\n'
    '    const dayVerses = getVersesForDay(day);\r\n'
    '    const newProgress = { ...progress };\r\n'
    '    dayVerses.forEach((v) => {\r\n'
    '      newProgress[`${v.chapter}:${v.verse}`] = "learned";\r\n'
    '    });\r\n'
    '    saveProgress(newProgress);\r\n'
    '  };'
)
new1 = b(
    '  const handleCompleteDay = (day: number) => {\r\n'
    '    // Only record the day as completed. Do NOT auto-mark verses as learned.\r\n'
    '    // Progress percent only increases when the user manually checks each verse.\r\n'
    '    const newCompleted = { ...completedDays, [day]: true };\r\n'
    '    setCompletedDays(newCompleted);\r\n'
    '    localStorage.setItem("rev_completed_days", JSON.stringify(newCompleted));\r\n'
    '    triggerBackgroundUpload(progress, notes, studyHistory, newCompleted, studyPlan, hardVerses);\r\n'
    '  };'
)
assert old1 in raw, "CHANGE 1 not found!"
raw = raw.replace(old1, new1, 1)
print("CHANGE 1 applied")

# ── CHANGE 2: stats useMemo – add keyVerse stats ─────────────────────────────
old2 = b(
    '    return {\r\n'
    '      total,\r\n'
    '      learned,\r\n'
    '      reviewing,\r\n'
    '      unlearned,\r\n'
    '      percent,\r\n'
    '      chapterStats\r\n'
    '    };\r\n'
    '  }, [progress]);'
)
new2 = b(
    '    // --- Key Verses Stats ---\r\n'
    '    const keyVersesList = REVELATION_VERSES.filter((v) => isKeyVerse(v.chapter, v.verse));\r\n'
    '    const keyTotal = keyVersesList.length;\r\n'
    '    let keyLearned = 0;\r\n'
    '    let keyReviewing = 0;\r\n'
    '    keyVersesList.forEach((v) => {\r\n'
    '      const s = progress[`${v.chapter}:${v.verse}`] || "unlearned";\r\n'
    '      if (s === "learned") keyLearned++;\r\n'
    '      else if (s === "reviewing") keyReviewing++;\r\n'
    '    });\r\n'
    '    const keyPercent = keyTotal > 0 ? Math.round((keyLearned / keyTotal) * 100) : 0;\r\n'
    '\r\n'
    '    const dailyTotal = total;\r\n'
    '    const dailyLearned = learned;\r\n'
    '    const dailyPercent = percent;\r\n'
    '\r\n'
    '    return {\r\n'
    '      total,\r\n'
    '      learned,\r\n'
    '      reviewing,\r\n'
    '      unlearned,\r\n'
    '      percent,\r\n'
    '      chapterStats,\r\n'
    '      keyTotal,\r\n'
    '      keyLearned,\r\n'
    '      keyReviewing,\r\n'
    '      keyPercent,\r\n'
    '      dailyTotal,\r\n'
    '      dailyLearned,\r\n'
    '      dailyPercent\r\n'
    '    };\r\n'
    '  }, [progress]);'
)
assert old2 in raw, "CHANGE 2 not found!"
raw = raw.replace(old2, new2, 1)
print("CHANGE 2 applied")

# ── CHANGE 3: Dashboard - replace left column ─────────────────────────────────
marker_start = b('            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">\r\n              {/* Left Column: Progress circle */')
marker_end   = b('            </div>\r\n          </div>\r\n        )}\r\n\r\n        {/* --- TAB 2: DAILY PLANNER')

si = raw.find(marker_start)
ei = raw.find(marker_end)
assert si > 0, "Start marker not found"
assert ei > si, "End marker not found"

end_tag = b('            </div>\r\n          </div>\r\n        )}')
actual_end = ei + len(end_tag)
print("Dashboard section: bytes", si, "to", actual_end)

# Build the new section line by line to avoid any encoding issues
lines = [
    '            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">',
    '              {/* Left Column: \uc77c\uc77c\uacc4\ud68d + \ud575\uc2ec\uc131\uad6c 2\uac1c \uce74\ub4dc */}',
    '              <div className="flex flex-col gap-4">',
    '',
    '                {/* \u2460 \uc77c\uc77c\uacc4\ud68d \uc554\uc1a1 \ud604\ud669 */}',
    '                <div className={`p-5 rounded-3xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>',
    '                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">',
    '                    <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">\ud83d\udcc5</span>',
    '                    \uc77c\uc77c\uacc4\ud68d \uc554\uc1a1 \ud604\ud669',
    '                    <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${darkMode ? "bg-zinc-800 text-zinc-400" : "bg-slate-100 text-slate-500"}`}>\uc804\uccb4 {stats.dailyTotal}\uad6c\uc808</span>',
    '                  </h3>',
    '                  <div className="flex items-center gap-4">',
    '                    <div className="relative w-24 h-24 flex-shrink-0">',
    '                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">',
    '                        <circle className={`${darkMode ? "text-zinc-800" : "text-slate-100"}`} strokeWidth="12" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50"/>',
    '                        <circle className="text-emerald-500 transition-all duration-1000" strokeWidth="12" strokeDasharray={2*Math.PI*38} strokeDashoffset={2*Math.PI*38*(1 - stats.dailyPercent/100)} strokeLinecap="round" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50"/>',
    '                      </svg>',
    '                      <div className="absolute inset-0 flex flex-col items-center justify-center">',
    '                        <span className="text-2xl font-extrabold">{stats.dailyPercent}%</span>',
    '                        <span className="text-[9px] text-zinc-400 mt-0.5">\uc554\uae30 \uc644\ub8cc</span>',
    '                      </div>',
    '                    </div>',
    '                    <div className="flex-1 space-y-2">',
    '                      <div className="flex justify-between items-center text-xs">',
    '                        <span className="flex items-center gap-1.5 text-zinc-400"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>\uc644\ub8cc</span>',
    '                        <span className="font-bold text-emerald-400">{stats.dailyLearned}\uad6c\uc808</span>',
    '                      </div>',
    '                      <div className="flex justify-between items-center text-xs">',
    '                        <span className="flex items-center gap-1.5 text-zinc-400"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>\ubcf5\uc2b5 \uc911</span>',
    '                        <span className="font-bold text-amber-400">{stats.reviewing}\uad6c\uc808</span>',
    '                      </div>',
    '                      <div className="flex justify-between items-center text-xs">',
    '                        <span className="flex items-center gap-1.5 text-zinc-400"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>\ubbf8\ud559\uc2b5</span>',
    '                        <span className="font-bold text-rose-400">{stats.unlearned}\uad6c\uc808</span>',
    '                      </div>',
    '                    </div>',
    '                  </div>',
    '                  <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">\ud83d\udca1 \uac01 \uad6c\uc808\uc758 \ud83d\udfe2 \uc644\ub8cc \ubc84\ud2bc\uc744 \ub20c\ub7ec\uc57c \ud37c\uc13c\ud2b8\uac00 \uc62c\ub77c\uac11\ub2c8\ub2e4</p>',
    '                </div>',
    '',
    '                {/* \u2461 \ud575\uc2ec\uc131\uad6c \uc554\uc1a1 \ud604\ud669 */}',
    '                <div className={`p-5 rounded-3xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-amber-500/20" : "bg-white border-amber-200 shadow-sm"}`}>',
    '                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">',
    '                    <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400">\u2b50</span>',
    '                    \ud575\uc2ec\uc131\uad6c \uc554\uc1a1 \ud604\ud669',
    '                    <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${darkMode ? "bg-zinc-800 text-zinc-400" : "bg-slate-100 text-slate-500"}`}>\uc804\uccb4 {stats.keyTotal}\uad6c\uc808</span>',
    '                  </h3>',
    '                  <div className="flex items-center gap-4">',
    '                    <div className="relative w-24 h-24 flex-shrink-0">',
    '                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">',
    '                        <circle className={`${darkMode ? "text-zinc-800" : "text-slate-100"}`} strokeWidth="12" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50"/>',
    '                        <circle className="text-amber-500 transition-all duration-1000" strokeWidth="12" strokeDasharray={2*Math.PI*38} strokeDashoffset={2*Math.PI*38*(1 - stats.keyPercent/100)} strokeLinecap="round" stroke="currentColor" fill="transparent" r="38" cx="50" cy="50"/>',
    '                      </svg>',
    '                      <div className="absolute inset-0 flex flex-col items-center justify-center">',
    '                        <span className="text-2xl font-extrabold text-amber-400">{stats.keyPercent}%</span>',
    '                        <span className="text-[9px] text-zinc-400 mt-0.5">\uc554\uae30 \uc644\ub8cc</span>',
    '                      </div>',
    '                    </div>',
    '                    <div className="flex-1 space-y-2">',
    '                      <div className="flex justify-between items-center text-xs">',
    '                        <span className="flex items-center gap-1.5 text-zinc-400"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>\uc644\ub8cc</span>',
    '                        <span className="font-bold text-amber-400">{stats.keyLearned}\uad6c\uc808</span>',
    '                      </div>',
    '                      <div className="flex justify-between items-center text-xs">',
    '                        <span className="flex items-center gap-1.5 text-zinc-400"><span className="w-2 h-2 rounded-full bg-amber-600 inline-block"></span>\ubcf5\uc2b5 \uc911</span>',
    '                        <span className="font-bold text-amber-500">{stats.keyReviewing}\uad6c\uc808</span>',
    '                      </div>',
    '                      <div className="flex justify-between items-center text-xs">',
    '                        <span className="flex items-center gap-1.5 text-zinc-400"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>\ubbf8\ud559\uc2b5</span>',
    '                        <span className="font-bold text-rose-400">{stats.keyTotal - stats.keyLearned - stats.keyReviewing}\uad6c\uc808</span>',
    '                      </div>',
    '                    </div>',
    '                  </div>',
    '                  <button',
    '                    onClick={() => { setActiveTab("key-verses"); }}',
    '                    className="mt-3 w-full text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl py-1.5 transition-all"',
    '                  >',
    '                    \u2b50 \ud575\uc2ec\uc131\uad6c \ud0ed\uc73c\ub85c \uc774\ub3d9\ud558\uc5ec \uccb4\ud06c\ud558\uae30 ->',
    '                  </button>',
    '                </div>',
    '',
    '                {/* Streak + \ud559\uc2b5\uacc4\ud68d \ud604\ud669 */}',
    '                <div className={`p-4 rounded-2xl border transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>',
    '                  <div className="flex items-center justify-between">',
    '                    <div className="flex items-center gap-3">',
    '                      <div className="text-2xl">\ud83d\udd25</div>',
    '                      <div>',
    '                        <h4 className="text-sm font-bold">\uc5f0\uc18d \ud559\uc2b5 \uc77c\uc218</h4>',
    '                        <p className="text-xs text-zinc-400">\ub9e4\uc77c \ube7c\ub193\uc9c0 \uc54a\uace0 \uc554\uc1a1\ud558\uc138\uc694!</p>',
    '                      </div>',
    '                    </div>',
    '                    <div className="text-right">',
    '                      <span className="text-3xl font-extrabold text-amber-500">{currentStreak}</span>',
    '                      <span className="text-xs text-zinc-400 ml-1">\uc77c\uc9f8</span>',
    '                    </div>',
    '                  </div>',
    '                  {studyPlan && todayStudyStatus && (',
    '                    <div className={`mt-3 pt-3 border-t ${darkMode ? "border-zinc-800" : "border-slate-100"}`}>',
    '                      <div className="flex items-center justify-between">',
    '                        <div className="space-y-0.5">',
    '                          <span className="text-xs font-bold block">{todayStudyStatus.displayMsg}</span>',
    '                          <span className="text-[10px] text-zinc-400 block">\ud83d\udcc5 {studyPlan.startDate} ~ {studyPlan.endDate}</span>',
    '                        </div>',
    '                        <div className="text-right">',
    '                          {todayStudyStatus.status === "before" ? (',
    '                            <span className="text-xs font-extrabold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">{todayStudyStatus.dDay}</span>',
    '                          ) : todayStudyStatus.status === "completed" ? (',
    '                            <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">\uc644\uc8fc \uc644\ub8cc \ud83c\udfc6</span>',
    '                          ) : todayStudyStatus.status === "rest" ? (',
    '                            <span className="text-xs font-extrabold text-teal-400 bg-teal-500/10 px-2 py-1 rounded-lg border border-teal-500/20">\ud734\uc2dd\uc77c</span>',
    '                          ) : (',
    '                            <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">',
    '                              {todayStudyStatus.currentDayNum} / {studyPlan.totalDays} \uc77c\ucc28',
    '                            </span>',
    '                          )}',
    '                        </div>',
    '                      </div>',
    '                    </div>',
    '                  )}',
    '                </div>',
    '              </div>',
    '',
    '              {/* Right Column: Chapter Progress Cards */}',
    '              <div className={`p-6 rounded-3xl border lg:col-span-2 transition-colors duration-300 ${darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"}`}>',
    '                <div className="flex justify-between items-center mb-4">',
    '                  <h3 className="text-base font-bold">\uc7a5\ubcc4 \uc0c1\uc138 \uc9c4\ud589 \uc9c4\ub3c4</h3>',
    '                  <span className="text-xs text-zinc-400">\ud074\ub9ad \uc2dc \ud574\ub2f9 \uc7a5 \ud559\uc2b5 \ubaa8\ub4dc\ub85c \uc774\ub3d9</span>',
    '                </div>',
    '',
    '                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">',
    '                  {stats.chapterStats.map((ch) => (',
    '                    <button',
    '                      key={ch.chapter}',
    '                      onClick={() => {',
    '                        setSelectedChapter(ch.chapter);',
    '                        setActiveTab("read");',
    '                      }}',
    '                      className={`p-3 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.02] ${darkMode ? "bg-zinc-800/40 border-zinc-700/60 hover:bg-zinc-800" : "bg-slate-50 border-slate-200 hover:bg-slate-100"}`}',
    '                    >',
    '                      <div className="flex justify-between items-center mb-1">',
    '                        <span className="font-bold text-sm">{ch.chapter}\uc7a5</span>',
    '                        <span className="text-xs font-semibold text-emerald-400">{ch.percent}%</span>',
    '                      </div>',
    '                      <div className="w-full bg-zinc-700/40 h-1.5 rounded-full overflow-hidden mb-1">',
    '                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${ch.percent}%` }}></div>',
    '                      </div>',
    '                      <div className="text-[10px] text-zinc-400 flex justify-between">',
    '                        <span>\uc554\uc1a1 \uc644\ub8cc: {ch.learned} / {ch.total}</span>',
    '                      </div>',
    '                    </button>',
    '                  ))}',
    '                </div>',
    '              </div>',
    '',
    '            </div>',
    '          </div>',
    '        )}',
]

new_dashboard = ("\r\n".join(lines)).encode("utf-8")
raw = raw[:si] + new_dashboard + raw[actual_end:]
print("CHANGE 3 applied")

with open(filepath, "wb") as f:
    f.write(raw)

print("Done! New file size:", len(raw), "bytes")
