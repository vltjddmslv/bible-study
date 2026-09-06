const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/page.tsx');
if (!fs.existsSync(filePath)) {
  console.error("Error: app/page.tsx not found at", filePath);
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');
const originalLength = content.length;
console.log(`Original file size: ${originalLength} characters`);

const hasCrLf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Navigation bar element replacement
const oldNavBar = `          {/* Navigation Tabs */}
          <nav className={\`flex p-1 rounded-lg border text-xs sm:text-sm \${darkMode ? "bg-zinc-800/50 border-zinc-700/50" : "bg-slate-100 border-slate-200"}\`}>
            <button
              onClick={() => { setActiveTab("dashboard"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={\`px-3 py-1.5 rounded-md font-medium transition-all duration-200 \${activeTab === "dashboard" && activeDay === null && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : (darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-600 hover:text-slate-900")}\`}
            >
              대시보드
            </button>
            <button
              onClick={() => { setActiveTab("planner"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={\`px-3 py-1.5 rounded-md font-medium transition-all duration-200 \${activeTab === "planner" && activeDay === null && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : (darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-600 hover:text-slate-900")}\`}
            >
              일일 플래너
            </button>
            <button
              onClick={() => { setActiveTab("read"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={\`px-3 py-1.5 rounded-md font-medium transition-all duration-200 \${activeTab === "read" && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : (darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-600 hover:text-slate-900")}\`}
            >
              성경 학습 (1~22장)
            </button>
            <button
              onClick={() => { setActiveTab("key-verses"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={\`px-3 py-1.5 rounded-md font-medium transition-all duration-200 \${activeTab === "key-verses" && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : (darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-600 hover:text-slate-900")}\`}
            >
              핵심 주요 성구
            </button>
            <button
              onClick={() => { setActiveTab("practice"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={\`px-3 py-1.5 rounded-md font-medium transition-all duration-200 \${activeTab === "practice" && activeDay === null && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : (darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-600 hover:text-slate-900")}\`}
            >
              개별 훈련
            </button>
          </nav>`;

const newNavBar = `          {/* Navigation Tabs */}
          <nav className={\`flex p-1 rounded-lg border text-xs sm:text-sm overflow-x-auto whitespace-nowrap scrollbar-none max-w-full \${darkMode ? "bg-zinc-800/50 border-zinc-700/50" : "bg-slate-100 border-slate-200"}\`}>
            <button
              onClick={() => { setActiveTab("dashboard"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={\`flex-shrink-0 px-3 py-1.5 rounded-md font-medium transition-all duration-200 \${activeTab === "dashboard" && activeDay === null && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : (darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-600 hover:text-slate-900")}\`}
            >
              대시보드
            </button>
            <button
              onClick={() => { setActiveTab("planner"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={\`flex-shrink-0 px-3 py-1.5 rounded-md font-medium transition-all duration-200 \${activeTab === "planner" && activeDay === null && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : (darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-600 hover:text-slate-900")}\`}
            >
              일일 플래너
            </button>
            <button
              onClick={() => { setActiveTab("read"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={\`flex-shrink-0 px-3 py-1.5 rounded-md font-medium transition-all duration-200 \${activeTab === "read" && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : (darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-600 hover:text-slate-900")}\`}
            >
              성경 학습 (1~22장)
            </button>
            <button
              onClick={() => { setActiveTab("key-verses"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={\`flex-shrink-0 px-3 py-1.5 rounded-md font-medium transition-all duration-200 \${activeTab === "key-verses" && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : (darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-600 hover:text-slate-900")}\`}
            >
              핵심 주요 성구
            </button>
            <button
              onClick={() => { setActiveTab("practice"); setActiveDay(null); setActiveChapterTest(null); stopTTS(); }}
              className={\`flex-shrink-0 px-3 py-1.5 rounded-md font-medium transition-all duration-200 \${activeTab === "practice" && activeDay === null && activeChapterTest === null ? "bg-emerald-600 text-white shadow-sm" : (darkMode ? "text-zinc-400 hover:text-zinc-200" : "text-slate-600 hover:text-slate-900")}\`}
            >
              개별 훈련
            </button>
          </nav>`;

if (!content.includes(oldNavBar)) {
  console.error("Error: Navigation bar target not found!");
  process.exit(1);
}
content = content.replace(oldNavBar, newNavBar);
console.log("Success: Navigation bar replaced.");

// 2. Day study step tabs replacement
const oldStudyTabs = `            {/* Step Tabs (Study -> Test) */}
            <div className="grid grid-cols-3 bg-zinc-900 p-1 rounded-2xl border border-zinc-800 text-sm font-semibold">
              <button
                onClick={() => { setDayStudyStep("study"); stopTTS(); }}
                className={\`py-2 rounded-xl transition-all \${dayStudyStep === "study" ? "bg-emerald-600 text-white" : "text-zinc-400"}\`}
              >
                1단계: 본문 공부하기 (Study)
              </button>
              <button
                onClick={handleGoToTest}
                className={\`py-2 rounded-xl transition-all \${dayStudyStep === "test" ? "bg-emerald-600 text-white" : "text-zinc-400"}\`}
              >
                2단계: 암송 시험보기 (Test)
              </button>
              <button
                disabled={!completedDays[activeDay]}
                onClick={() => { setDayStudyStep("complete"); stopTTS(); }}
                className={\`py-2 rounded-xl transition-all disabled:opacity-40 \${dayStudyStep === "complete" ? "bg-emerald-600 text-white" : "text-zinc-400"}\`}
              >
                3단계: 완료 증명 (Complete)
              </button>
            </div>`;

const newStudyTabs = `            {/* Step Tabs (Study -> Test) */}
            <div className="grid grid-cols-3 bg-zinc-900 p-1 rounded-2xl border border-zinc-800 text-xs sm:text-sm font-semibold">
              <button
                onClick={() => { setDayStudyStep("study"); stopTTS(); }}
                className={\`py-2 rounded-xl transition-all \${dayStudyStep === "study" ? "bg-emerald-600 text-white" : "text-zinc-400"}\`}
              >
                <span className="hidden sm:inline">1단계: 본문 공부하기 (Study)</span>
                <span className="sm:hidden">1단계: 공부</span>
              </button>
              <button
                onClick={handleGoToTest}
                className={\`py-2 rounded-xl transition-all \${dayStudyStep === "test" ? "bg-emerald-600 text-white" : "text-zinc-400"}\`}
              >
                <span className="hidden sm:inline">2단계: 암송 시험보기 (Test)</span>
                <span className="sm:hidden">2단계: 시험</span>
              </button>
              <button
                disabled={!completedDays[activeDay]}
                onClick={() => { setDayStudyStep("complete"); stopTTS(); }}
                className={\`py-2 rounded-xl transition-all disabled:opacity-40 \${dayStudyStep === "complete" ? "bg-emerald-600 text-white" : "text-zinc-400"}\`}
              >
                <span className="hidden sm:inline">3단계: 완료 증명 (Complete)</span>
                <span className="sm:hidden">3단계: 완료</span>
              </button>
            </div>`;

if (!content.includes(oldStudyTabs)) {
  console.error("Error: Day study step tabs target not found!");
  process.exit(1);
}
content = content.replace(oldStudyTabs, newStudyTabs);
console.log("Success: Day study step tabs replaced.");

// 3. Test modes selector replacement
const oldTestModes = `                    <div className="flex bg-zinc-800 p-0.5 rounded-lg border border-zinc-700 text-xs">
                      <button
                        onClick={() => setDayTestMode("initial")}
                        className={\`px-3 py-1 rounded-md font-medium transition-all \${dayTestMode === "initial" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"}\`}
                      >
                        초성 매칭 시험
                      </button>
                      <button
                        onClick={() => setDayTestMode("full")}
                        className={\`px-3 py-1 rounded-md font-medium transition-all \${dayTestMode === "full" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"}\`}
                      >
                        전체 입력 시험
                      </button>
                    </div>`;

const newTestModes = `                    <div className="flex bg-zinc-800 p-0.5 rounded-lg border border-zinc-700 text-xs">
                      <button
                        onClick={() => setDayTestMode("initial")}
                        className={\`px-3 py-1 rounded-md font-medium transition-all \${dayTestMode === "initial" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"}\`}
                      >
                        <span className="hidden sm:inline">초성 매칭 시험</span>
                        <span className="sm:hidden">초성 시험</span>
                      </button>
                      <button
                        onClick={() => setDayTestMode("full")}
                        className={\`px-3 py-1 rounded-md font-medium transition-all \${dayTestMode === "full" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"}\`}
                      >
                        <span className="hidden sm:inline">전체 입력 시험</span>
                        <span className="sm:hidden">전문 시험</span>
                      </button>
                    </div>`;

if (!content.includes(oldTestModes)) {
  console.error("Error: Test modes target not found!");
  process.exit(1);
}
content = content.replace(oldTestModes, newTestModes);
console.log("Success: Test modes selector replaced.");

// 4. Typing test feedback row replacement
const oldFeedbackRow = `                    <div className="flex justify-between items-center text-xs">
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
                        허용된 입력 형식: 본문만 입력하거나, 앞에 \`1.\`, \`1절\`, \`1:1\`, \`:1\`을 함께 쳐도 모두 정답 처리됩니다.
                      </div>
                    </div>`;

const newFeedbackRow = `                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-2">
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
                      <div className="text-zinc-500 text-[10px] sm:text-xs">
                        허용된 입력 형식: 본문만 입력하거나, 앞에 \`1.\`, \`1절\`, \`1:1\`, \`:1\`을 함께 쳐도 모두 정답 처리됩니다.
                      </div>
                    </div>`;

if (!content.includes(oldFeedbackRow)) {
  console.error("Error: Typing test feedback row target not found!");
  process.exit(1);
}
content = content.replace(oldFeedbackRow, newFeedbackRow);
console.log("Success: Typing test feedback row replaced.");

// 5. Practice sub-tabs replacement
const oldPracticeTabs = `                  <button
                    onClick={() => {
                      setPracticeSubTab("blank");
                      setIsPracticeCardFlipped(false);
                      setPracticeUserInput("");
                      setShowPracticeAnswer(false);
                      setRevealedBlanks([]);
                      stopTTS();
                    }}
                    className={\`py-2 rounded-xl transition-all \${practiceSubTab === "blank" ? "bg-emerald-600 text-white shadow-sm" : darkMode ? "text-zinc-400 hover:text-zinc-300" : "text-slate-600 hover:text-slate-800"}\`}
                  >
                    빈칸 채우기 훈련
                  </button>
                  <button
                    onClick={() => {
                      setPracticeSubTab("typing");
                      setIsPracticeCardFlipped(false);
                      setPracticeUserInput("");
                      setShowPracticeAnswer(false);
                      setRevealedBlanks([]);
                      stopTTS();
                    }}
                    className={\`py-2 rounded-xl transition-all \${practiceSubTab === "typing" ? "bg-emerald-600 text-white shadow-sm" : darkMode ? "text-zinc-400 hover:text-zinc-300" : "text-slate-600 hover:text-slate-800"}\`}
                  >
                    타이핑 테스트 훈련
                  </button>`;

const newPracticeTabs = `                  <button
                    onClick={() => {
                      setPracticeSubTab("blank");
                      setIsPracticeCardFlipped(false);
                      setPracticeUserInput("");
                      setShowPracticeAnswer(false);
                      setRevealedBlanks([]);
                      stopTTS();
                    }}
                    className={\`py-2 rounded-xl transition-all \${practiceSubTab === "blank" ? "bg-emerald-600 text-white shadow-sm" : darkMode ? "text-zinc-400 hover:text-zinc-300" : "text-slate-600 hover:text-slate-800"}\`}
                  >
                    <span className="hidden sm:inline">빈칸 채우기 훈련</span>
                    <span className="sm:hidden">빈칸 채우기</span>
                  </button>
                  <button
                    onClick={() => {
                      setPracticeSubTab("typing");
                      setIsPracticeCardFlipped(false);
                      setPracticeUserInput("");
                      setShowPracticeAnswer(false);
                      setRevealedBlanks([]);
                      stopTTS();
                    }}
                    className={\`py-2 rounded-xl transition-all \${practiceSubTab === "typing" ? "bg-emerald-600 text-white shadow-sm" : darkMode ? "text-zinc-400 hover:text-zinc-300" : "text-slate-600 hover:text-slate-800"}\`}
                  >
                    <span className="hidden sm:inline">타이핑 테스트 훈련</span>
                    <span className="sm:hidden">타이핑 테스트</span>
                  </button>`;

// Also replace the first button in Practice tabs:
const oldPracticeFirstBtn = `                  <button
                    onClick={() => {
                      setPracticeSubTab("card");
                      setIsPracticeCardFlipped(false);
                      setPracticeUserInput("");
                      setShowPracticeAnswer(false);
                      setRevealedBlanks([]);
                      stopTTS();
                    }}
                    className={\`py-2 rounded-xl transition-all \${practiceSubTab === "card" ? "bg-emerald-600 text-white shadow-sm" : darkMode ? "text-zinc-400 hover:text-zinc-300" : "text-slate-600 hover:text-slate-800"}\`}
                  >
                    플래시카드 훈련
                  </button>`;

const newPracticeFirstBtn = `                  <button
                    onClick={() => {
                      setPracticeSubTab("card");
                      setIsPracticeCardFlipped(false);
                      setPracticeUserInput("");
                      setShowPracticeAnswer(false);
                      setRevealedBlanks([]);
                      stopTTS();
                    }}
                    className={\`py-2 rounded-xl transition-all \${practiceSubTab === "card" ? "bg-emerald-600 text-white shadow-sm" : darkMode ? "text-zinc-400 hover:text-zinc-300" : "text-slate-600 hover:text-slate-800"}\`}
                  >
                    <span className="hidden sm:inline">플래시카드 훈련</span>
                    <span className="sm:hidden">플래시카드</span>
                  </button>`;

if (!content.includes(oldPracticeTabs) || !content.includes(oldPracticeFirstBtn)) {
  console.error("Error: Practice tabs target not found!");
  process.exit(1);
}
content = content.replace(oldPracticeTabs, newPracticeTabs);
content = content.replace(oldPracticeFirstBtn, newPracticeFirstBtn);
console.log("Success: Practice sub-tabs replaced.");

// 6. Fix Complete Sub-Panel Text bug
const oldCompleteText = `                <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-xs max-w-sm mx-auto text-emerald-300 font-medium">
                  ✔️ 암기 상태 업데이트: 오늘 통과한 {activeDayVerses.length}구절의 암기 마크가 대시보드에서 자동으로 &apos;암기 완료&apos;로 변경되었습니다.
                </div>`;

const newCompleteText = `                <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-xs max-w-sm mx-auto text-emerald-300 font-medium">
                  ✔️ 오늘 학습 완료: 오늘 분량의 학습 도장을 완료하였습니다! (각 구절의 암송 퍼센트는 성경 학습이나 일일 플래너의 개별 구절 완료 버튼을 직접 눌러야 반영됩니다)
                </div>`;

if (!content.includes(oldCompleteText)) {
  console.error("Error: Complete sub-panel text target not found!");
  process.exit(1);
}
content = content.replace(oldCompleteText, newCompleteText);
console.log("Success: Complete sub-panel text replaced.");

// 7. Step 1 study panel text unrevealed background
const oldStudyUnrevealed = `                          <p className={\`text-lg leading-relaxed font-semibold transition-all duration-300 break-keep \${isRevealed ? "text-zinc-100 opacity-100" : "text-transparent bg-zinc-800 rounded select-none filter blur-sm"}\`}>`;

const newStudyUnrevealed = `                          <p className={\`text-lg leading-relaxed font-semibold transition-all duration-300 break-keep \${isRevealed ? "opacity-100" : \`text-transparent \${darkMode ? "bg-zinc-800" : "bg-slate-200"} rounded select-none filter blur-sm\`}\`}>`;

if (!content.includes(oldStudyUnrevealed)) {
  console.error("Error: Step 1 study unrevealed target not found!");
  process.exit(1);
}
content = content.replace(oldStudyUnrevealed, newStudyUnrevealed);
console.log("Success: Step 1 study unrevealed text class replaced.");

if (hasCrLf) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Success! File size is now ${fs.readFileSync(filePath, 'utf8').length} characters.`);
