/* ==========================================================================
   app.js — الهيكل العام (الترويسة) + التوجيه (Routing) بالـ hash
   المسارات:
     #/                                 لوحة التحكم
     #/level/:levelId                   صفحة المستوى
     #/level/:levelId/lesson/:lessonId  الدرس
     #/level/:levelId/quiz              اختبار المستوى
   ========================================================================== */
(function () {
  const PL = window.PL;
  const h = PL.h;

  const view = h("main", { id: "view", tabindex: "-1" });
  const percentChip = h("span", { class: "chip header-pct" });
  const themeBtn = h("button", { class: "icon-btn", title: "تبديل الوضع الليلي/النهاري", "aria-label": "تبديل المظهر", onClick: toggleTheme });

  const header = h("header", { class: "topbar" },
    h("a", { class: "brand", href: "#/" }, h("span", { class: "brand-logo" }, "🐍"), h("span", {}, "بايثون بالعربي")),
    h("div", { class: "topbar-end" }, percentChip, themeBtn));

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    themeBtn.textContent = t === "dark" ? "☀️" : "🌙";
  }
  function toggleTheme() {
    const t = PL.store.getTheme() === "dark" ? "light" : "dark";
    PL.store.setTheme(t);
    applyTheme(t);
  }
  function updateHeader() {
    percentChip.textContent = "التقدّم " + PL.store.overall().percent + "%";
  }

  let current = null; // العرض الحالي (لتنظيف الموارد)

  function mount(node, opts) {
    if (current && current.dispose) current.dispose();
    current = node;
    view.replaceChildren(node);
    document.body.classList.toggle("is-lesson", !!(opts && opts.lesson));
    if (!(opts && opts.keepScroll)) window.scrollTo(0, 0);
  }

  function redirect(hash, msg) {
    if (msg) PL.toast(msg, "warn");
    location.hash = hash;
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    updateHeader();
    document.title = "بايثون بالعربي";

    if (parts.length === 0) {
      mount(PL.views.dashboard());
      return;
    }
    if (parts[0] === "level") {
      const level = PL.getLevel(parts[1]);
      if (!level || level.comingSoon) return redirect("#/", "هذا المستوى غير متاح بعد");
      if (!PL.store.isLevelUnlocked(level)) return redirect("#/", "🔒 أكمل المستوى السابق أولاً");

      if (parts.length === 2) {
        document.title = level.short + " — بايثون بالعربي";
        return mount(PL.views.level(level));
      }
      if (parts[2] === "lesson") {
        const lesson = level.lessons.find((l) => l.id === parts[3]);
        if (!lesson) return redirect("#/level/" + level.id);
        document.title = lesson.title + " — بايثون بالعربي";
        return mount(PL.views.lesson(level, lesson), { lesson: true });
      }
      if (parts[2] === "quiz") {
        if (!PL.store.allLessonsDone(level)) return redirect("#/level/" + level.id, "أنهِ كل دروس المستوى أولاً لتفتح الاختبار");
        document.title = "اختبار " + level.short + " — بايثون بالعربي";
        return mount(PL.views.quiz(level));
      }
    }
    redirect("#/");
  }

  PL.app = {
    updateHeader,
    refresh: route,
  };

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(PL.store.getTheme());
    document.getElementById("app").append(header, view);
    window.addEventListener("hashchange", route);
    route();
    // نحمّل بيئة بايثون في الخلفية ليكون التشغيل فورياً عند أول درس
    setTimeout(() => PL.runner.warmUp(), 300);
  });
})();
