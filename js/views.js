/* ==========================================================================
   views.js — شاشات التطبيق: لوحة التحكم، المستوى، الدرس، الاختبار
   ========================================================================== */
(function () {
  const PL = window.PL;
  const h = PL.h;
  const store = () => PL.store;

  const crumbs = (...items) =>
    h("nav", { class: "crumbs", "aria-label": "مسار التنقل" },
      items.map((it, i) => [
        i > 0 ? h("span", { class: "sep" }, "›") : null,
        it.href ? h("a", { href: it.href }, it.label) : h("span", { class: "cur" }, it.label),
      ]));

  /* ===================================================================
     لوحة التحكم
     =================================================================== */
  function ring(percent) {
    const r = 52, c = 2 * Math.PI * r;
    return h("div", { class: "ring" },
      h("div", { html:
        `<svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">` +
        `<circle cx="60" cy="60" r="${r}" class="ring-bg"/>` +
        `<circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - percent / 100)}" transform="rotate(-90 60 60)"/></svg>` }),
      h("div", { class: "ring-label" }, h("b", {}, percent + "%"), h("small", {}, "إنجازك")));
  }

  PL.views = {};

  PL.views.dashboard = function () {
    const o = store().overall();
    const next = store().nextStep();
    const started = o.percent > 0;

    const hero = h("section", { class: "hero" },
      h("div", { class: "hero-text" },
        h("span", { class: "eyebrow" }, "🐍 تعلّم بايثون من الصفر"),
        h("h1", {}, "ابدأ رحلتك في البرمجة، خطوة صغيرة كل يوم"),
        h("p", {}, "دروس بالعربية البسيطة، أمثلة هي الأقصر على الإطلاق، وشرح لكل سطر كأنك لم تبرمج من قبل. اكتب الكود وشغّله مباشرة في المتصفح."),
        next
          ? h("a", { class: "btn primary big", href: next.href }, started ? "تابع التعلّم ←" : "ابدأ الدرس الأول ←")
          : h("div", { class: "chip good" }, "🎉 أنهيت كل المستويات المتاحة حالياً!")),
      h("div", { class: "hero-stats" },
        ring(o.percent),
        h("div", { class: "stats" },
          h("div", { class: "stat" }, h("b", {}, o.lessons), h("span", {}, "درس مكتمل")),
          h("div", { class: "stat" }, h("b", {}, `${o.levels}/${o.totalLevels}`), h("span", {}, "مستوى مكتمل")))));

    const cards = PL.LEVELS.map((level, i) => {
      const soon = !!level.comingSoon;
      const unlocked = store().isLevelUnlocked(level);
      const done = store().isLevelDone(level);
      const pct = soon ? 0 : store().levelPercent(level);
      const state = soon ? "soon" : done ? "done" : unlocked ? "open" : "locked";
      const badge = { soon: "🚧 قريباً", done: "✅ مكتمل", open: pct > 0 ? "▶ قيد التقدّم" : "🚀 ابدأ", locked: "🔒 مقفل" }[state];
      const card = h(unlocked ? "a" : "div", {
        class: `level-card ${state}`,
        style: { "--lc": level.color },
        href: unlocked ? `#/level/${level.id}` : null,
        "aria-disabled": unlocked ? null : "true",
        title: state === "locked" ? "أكمل المستوى السابق لفتح هذا المستوى" : null,
      },
        h("div", { class: "lc-top" },
          h("span", { class: "lc-emoji" }, level.emoji),
          h("span", { class: "lc-badge" }, badge)),
        h("div", { class: "lc-num" }, "المستوى " + level.order),
        h("h3", {}, level.short),
        h("p", {}, level.tagline),
        soon ? null : h("div", { class: "progress" }, h("i", { style: { width: pct + "%" } })),
        soon ? null : h("div", { class: "lc-meta" },
          `${store().doneLessons(level)}/${level.lessons.length} دروس`, " • ", "اختبار " + (store().isQuizPassed(level) ? "✅" : "⬜")));
      return card;
    });

    const resetBtn = h("button", {
      class: "link-btn danger",
      onClick: () => {
        if (confirm("هل تريد حذف كل تقدّمك والبدء من جديد؟")) {
          store().reset();
          PL.app.refresh();
          PL.toast("تمت إعادة ضبط التقدّم", "info");
        }
      },
    }, "إعادة ضبط التقدّم");

    return h("div", { class: "container" },
      hero,
      h("div", { class: "section-head" },
        h("h2", {}, "🗺️ خارطة المستويات"),
        h("p", {}, "أكمل دروس المستوى واجتز اختباره القصير لتفتح المستوى التالي.")),
      h("div", { class: "levels-grid" }, cards),
      h("footer", { class: "foot" }, "التقدّم محفوظ في متصفحك فقط. ", resetBtn));
  };

  /* ===================================================================
     شاشة المستوى
     =================================================================== */
  PL.views.level = function (level) {
    const st = store();
    const allDone = st.allLessonsDone(level);
    const quizDone = st.isQuizPassed(level);
    const idx = PL.LEVELS.indexOf(level);
    const nextLevel = PL.LEVELS[idx + 1];

    const lessons = level.lessons.map((lesson, i) => {
      const done = st.isLessonDone(level, lesson);
      return h("a", { class: "lesson-row" + (done ? " done" : ""), href: `#/level/${level.id}/lesson/${lesson.id}` },
        h("span", { class: "lr-num" }, done ? "✓" : i + 1),
        h("span", { class: "lr-title" }, lesson.title),
        h("span", { class: "lr-min" }, `⏱ ${lesson.minutes} د`),
        h("span", { class: "lr-go" }, "←"));
    });

    const quizRow = allDone
      ? h("a", { class: "lesson-row quiz" + (quizDone ? " done" : ""), href: `#/level/${level.id}/quiz` },
          h("span", { class: "lr-num" }, quizDone ? "✓" : "★"),
          h("span", { class: "lr-title" }, "اختبار المستوى" + (quizDone ? " (مُجتاز)" : "")),
          h("span", { class: "lr-min" }, `${level.quiz.questions.length} أسئلة`),
          h("span", { class: "lr-go" }, "←"))
      : h("div", { class: "lesson-row quiz locked" },
          h("span", { class: "lr-num" }, "🔒"),
          h("span", { class: "lr-title" }, "اختبار المستوى (يُفتح بعد إنهاء كل الدروس)"));

    return h("div", { class: "container narrow", style: { "--lc": level.color } },
      crumbs({ label: "الرئيسية", href: "#/" }, { label: level.short }),
      h("section", { class: "level-hero" },
        h("div", { class: "lh-emoji" }, level.emoji),
        h("div", {},
          h("h1", {}, level.title),
          h("p", {}, level.description),
          h("div", { class: "progress big" }, h("i", { style: { width: st.levelPercent(level) + "%" } })),
          h("small", {}, `${st.doneLessons(level)} من ${level.lessons.length} دروس • ${st.levelPercent(level)}% مكتمل`))),
      h("div", { class: "lesson-list" }, lessons, quizRow),
      st.isLevelDone(level) && nextLevel
        ? h("div", { class: "callout good" },
            h("b", {}, "🎉 أكملت هذا المستوى! "),
            st.isLevelUnlocked(nextLevel)
              ? h("a", { class: "btn primary", href: `#/level/${nextLevel.id}` }, "انتقل إلى " + nextLevel.short + " ←")
              : h("span", {}, "المستوى التالي قيد التحضير، ترقّب المزيد."))
        : null);
  };

  /* ===================================================================
     شاشة الدرس (تقسيم الشاشة)
     =================================================================== */
  PL.views.lesson = function (level, lesson) {
    const st = store();
    const idx = level.lessons.indexOf(lesson);
    const prev = level.lessons[idx - 1];
    const next = level.lessons[idx + 1];
    const nextHref = next ? `#/level/${level.id}/lesson/${next.id}` : `#/level/${level.id}/quiz`;
    const nextLabel = next ? "الدرس التالي ←" : "إلى اختبار المستوى ←";

    const ws = PL.Workspace(level, lesson, {
      nextHref,
      nextLabel,
      onPass(first) {
        ws.api.markDone();
        const nextBtn = document.getElementById("next-nav");
        if (nextBtn) nextBtn.classList.add("pulse");
        PL.app.updateHeader();
        if (first) {
          PL.toast("🎉 أنجزت الدرس!", "good");
          if (st.allLessonsDone(level)) PL.toast("فتحت اختبار المستوى، اختبر نفسك!", "info");
        }
      },
    });

    /* ----- الكود الثابت + الشرح ----- */
    const block = PL.codeBlock(lesson.example.code);
    const lit = (n) => {
      block.highlight(n);
      ws.api.highlight(n);
    };

    const explainItems = lesson.example.explain.map((e) =>
      h("li", {
        class: "ex-item", tabindex: "0",
        onMouseenter: () => lit(e.line), onMouseleave: () => lit(null),
        onFocus: () => lit(e.line), onBlur: () => lit(null),
      },
        h("div", { class: "ex-tags" },
          h("span", { class: "tag-line" }, "سطر " + e.line),
          h("code", { class: "tag-part", dir: "ltr" }, e.part)),
        h("div", { class: "ex-text", html: PL.rich(e.text) })));

    const useCaseCards = lesson.useCases.map((u) =>
      h("div", { class: "uc-card" },
        h("div", { class: "uc-icon" }, u.icon),
        h("div", {}, h("h4", {}, u.title), h("p", { html: PL.rich(u.text) }))));

    const theory = h("article", { class: "pane theory", style: { "--lc": level.color } },
      crumbs({ label: "الرئيسية", href: "#/" }, { label: level.short, href: `#/level/${level.id}` }, { label: lesson.title }),
      h("header", { class: "lesson-head" },
        h("div", { class: "chips" },
          h("span", { class: "chip" }, `الدرس ${idx + 1} من ${level.lessons.length}`),
          h("span", { class: "chip" }, `⏱ ${lesson.minutes} دقائق`),
          st.isLessonDone(level, lesson) ? h("span", { class: "chip good" }, "✅ مكتمل") : null),
        h("h1", {}, lesson.title)),

      h("div", { class: "callout idea" }, h("b", {}, "💡 الفكرة في جملة: "), h("span", { html: PL.rich(lesson.intro) })),

      h("section", { class: "block" },
        h("h2", {}, "🧪 أبسط مثال ممكن"),
        block,
        h("div", { class: "row" },
          h("button", { class: "btn primary small", onClick: () => ws.api.showExample(true) }, "▶ جرّبه الآن في المحرر"),
          h("small", { class: "muted" }, "عدّل عليه كما تشاء وشاهد ماذا يحدث!"))),

      h("section", { class: "block" },
        h("h2", {}, "👶 اشرحها لي كأنني لم أبرمج قط"),
        h("p", { class: "muted" }, "مرّر الفأرة على كل نقطة لترى السطر المقصود في الكود."),
        h("ol", { class: "ex-list" }, explainItems),
        ...(lesson.notes || []).map((n) => h("div", { class: "callout warn" }, h("b", {}, "⚠️ انتبه: "), h("span", { html: PL.rich(n) })))),

      h("section", { class: "block where", id: "where" },
        h("h2", {}, "🌍 أين نستخدم هذا في الواقع؟"),
        h("div", { class: "uc-grid" }, useCaseCards)),

      h("section", { class: "block challenge-block" },
        h("h2", {}, "🎯 التحدّي: طبّق بنفسك"),
        h("p", { html: PL.rich(lesson.challenge.prompt) }),
        h("div", { class: "row" },
          h("button", { class: "btn success", onClick: () => ws.api.startChallenge() }, "ابدأ التحدّي في المحرر ➜")),
        h("details", { class: "reveal" },
          h("summary", {}, "💡 أحتاج تلميحاً"),
          h("p", { html: PL.rich(lesson.challenge.hint) })),
        h("details", { class: "reveal" },
          h("summary", {}, "🔑 أرني الحل (حاول أولاً!)"),
          PL.codeBlock(lesson.challenge.solution))),

      h("nav", { class: "lesson-nav" },
        prev
          ? h("a", { class: "btn ghost", href: `#/level/${level.id}/lesson/${prev.id}` }, "→ الدرس السابق")
          : h("a", { class: "btn ghost", href: `#/level/${level.id}` }, "→ قائمة الدروس"),
        h("a", { class: "btn primary", id: "next-nav", href: nextHref }, nextLabel)));

    const root = h("div", { class: "lesson-split" }, theory, ws);
    root.dispose = ws.dispose;
    return root;
  };

  /* ===================================================================
     اختبار المستوى
     =================================================================== */
  PL.views.quiz = function (level) {
    const st = store();
    const box = h("div", { class: "container narrow", style: { "--lc": level.color } });
    const letters = ["أ", "ب", "ج", "د"];

    function renderQuiz() {
      const picked = {};
      const form = h("form", { class: "quiz" });
      level.quiz.questions.forEach((q, qi) => {
        const opts = q.options.map((o, oi) =>
          h("label", { class: "opt" },
            h("input", { type: "radio", name: "q" + qi, value: oi, onChange: () => (picked[qi] = oi) }),
            h("span", { class: "opt-letter" }, letters[oi]),
            h("span", { class: "opt-text", dir: "auto", html: PL.rich(o) })));
        form.append(h("fieldset", { class: "q-card", id: "q" + qi },
          h("legend", {}, `السؤال ${qi + 1}`),
          h("p", { class: "q-text", html: PL.rich(q.q) }),
          q.code ? PL.codeBlock(q.code) : null,
          h("div", { class: "opts" }, opts),
          h("div", { class: "q-why hidden" })));
      });
      const submit = h("button", { class: "btn primary big", type: "submit" }, "تحقّق من إجاباتي");
      form.append(submit);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (Object.keys(picked).length < level.quiz.questions.length) {
          PL.toast("أجب عن كل الأسئلة أولاً", "warn");
          return;
        }
        grade(form, picked);
      });
      return form;
    }

    function grade(form, picked) {
      let score = 0;
      level.quiz.questions.forEach((q, qi) => {
        const card = form.querySelector("#q" + qi);
        const ok = picked[qi] === q.answer;
        if (ok) score++;
        card.classList.add(ok ? "right" : "wrong");
        card.querySelectorAll(".opt").forEach((lab, oi) => {
          lab.classList.toggle("is-answer", oi === q.answer);
          lab.classList.toggle("is-wrong", oi === picked[qi] && !ok);
          lab.querySelector("input").disabled = true;
        });
        const why = card.querySelector(".q-why");
        why.classList.remove("hidden");
        why.innerHTML = (ok ? "✅ صحيح! " : "❌ ليست صحيحة. ") + PL.rich(q.why);
      });
      form.querySelector("button[type=submit]").remove();

      const passed = score >= level.quiz.pass;
      const first = passed && !st.isQuizPassed(level);
      if (passed) st.markQuizPassed(level);
      PL.app.updateHeader();

      const idx = PL.LEVELS.indexOf(level);
      const nextLevel = PL.LEVELS[idx + 1];
      const result = h("div", { class: "quiz-result " + (passed ? "good" : "bad") },
        h("div", { class: "qr-score" }, `${score} / ${level.quiz.questions.length}`),
        h("h3", {}, passed ? (first ? "🎉 مبروك! أنهيت هذا المستوى" : "✅ اجتزت الاختبار") : "قريب جداً! تحتاج " + level.quiz.pass + " إجابات صحيحة على الأقل"),
        h("div", { class: "row center" },
          passed
            ? [
                nextLevel && st.isLevelUnlocked(nextLevel)
                  ? h("a", { class: "btn primary", href: `#/level/${nextLevel.id}` }, `المستوى التالي: ${nextLevel.short} ←`)
                  : h("a", { class: "btn primary", href: "#/" }, "العودة للوحة التحكم"),
              ]
            : [h("button", { class: "btn primary", onClick: () => { box.querySelector(".quiz-wrap").replaceWith(h("div", { class: "quiz-wrap" }, renderQuiz())); window.scrollTo(0, 0); } }, "↺ أعد المحاولة"),
               h("a", { class: "btn ghost", href: `#/level/${level.id}` }, "راجع الدروس")]));
      form.append(result);
      result.scrollIntoView({ behavior: "smooth", block: "center" });
      if (first) PL.toast("🔓 تم فتح المستوى التالي", "good");
    }

    box.append(
      crumbs({ label: "الرئيسية", href: "#/" }, { label: level.short, href: `#/level/${level.id}` }, { label: "الاختبار" }),
      h("header", { class: "lesson-head" }, h("h1", {}, `📝 اختبار ${level.short}`),
        h("p", { class: "muted" }, `أجب عن ${level.quiz.questions.length} أسئلة. تحتاج ${level.quiz.pass} إجابات صحيحة لفتح المستوى التالي.`)),
      h("div", { class: "quiz-wrap" }, renderQuiz()));
    return box;
  };
})();
