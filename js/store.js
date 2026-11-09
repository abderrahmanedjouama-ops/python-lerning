/* ==========================================================================
   store.js — حفظ التقدّم في localStorage + منطق فتح المستويات
   القاعدة: المستوى n+1 لا يُفتح إلا بعد إتمام المستوى n
   (كل دروسه + اجتياز اختباره).
   ========================================================================== */
(function () {
  const PL = window.PL;
  const KEY = "pylearn-ar:v1";

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && typeof d === "object") return Object.assign({ lessons: {}, quizzes: {}, theme: "dark" }, d);
    } catch (e) {}
    return { lessons: {}, quizzes: {}, theme: "dark" };
  }
  let state = load();
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  };

  const store = (PL.store = {
    /* ----- الدروس ----- */
    isLessonDone: (level, lesson) => !!state.lessons[PL.lessonKey(level, lesson)],
    markLessonDone(level, lesson) {
      state.lessons[PL.lessonKey(level, lesson)] = true;
      save();
    },
    /* ----- الاختبارات ----- */
    isQuizPassed: (level) => !!state.quizzes[level.id],
    markQuizPassed(level) {
      state.quizzes[level.id] = true;
      save();
    },
    /* ----- حالة المستوى ----- */
    doneLessons: (level) => level.lessons.filter((l) => store.isLessonDone(level, l)).length,
    allLessonsDone: (level) => level.lessons.length > 0 && store.doneLessons(level) === level.lessons.length,
    isLevelDone: (level) => !level.comingSoon && store.allLessonsDone(level) && store.isQuizPassed(level),
    isLevelUnlocked(level) {
      if (level.comingSoon) return false;
      const i = PL.LEVELS.indexOf(level);
      if (i <= 0) return true;
      return store.isLevelDone(PL.LEVELS[i - 1]);
    },
    levelPercent(level) {
      const total = level.lessons.length + 1; // الدروس + الاختبار
      const done = store.doneLessons(level) + (store.isQuizPassed(level) ? 1 : 0);
      return PL.pct(done, total);
    },
    /* ----- نظرة عامة ----- */
    overall() {
      const real = PL.LEVELS.filter((l) => !l.comingSoon);
      let total = 0, done = 0, lessons = 0, levels = 0;
      real.forEach((l) => {
        total += l.lessons.length + 1;
        done += store.doneLessons(l) + (store.isQuizPassed(l) ? 1 : 0);
        lessons += store.doneLessons(l);
        if (store.isLevelDone(l)) levels++;
      });
      return { percent: PL.pct(done, total), lessons, levels, totalLevels: real.length };
    },
    /* أول درس غير مكتمل في أول مستوى مفتوح (لزر "تابع التعلّم") */
    nextStep() {
      for (const level of PL.LEVELS) {
        if (level.comingSoon || !store.isLevelUnlocked(level)) continue;
        const lesson = level.lessons.find((l) => !store.isLessonDone(level, l));
        if (lesson) return { level, lesson, href: `#/level/${level.id}/lesson/${lesson.id}` };
        if (!store.isQuizPassed(level)) return { level, quiz: true, href: `#/level/${level.id}/quiz` };
      }
      return null;
    },
    /* ----- المظهر ----- */
    getTheme: () => state.theme,
    setTheme(t) {
      state.theme = t;
      save();
    },
    reset() {
      state = { lessons: {}, quizzes: {}, theme: state.theme };
      save();
    },
  });
})();
