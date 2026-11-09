/* ==========================================================================
   workspace.js — مكوّن الجهة اليسرى في شاشة الدرس:
   محرّر + أزرار تشغيل + شاشة نتائج + إدخال (input) + فحص التحدّي
   ========================================================================== */
(function () {
  const PL = window.PL;
  const h = PL.h;

  PL.Workspace = function (level, lesson, hooks) {
    hooks = hooks || {};
    let mode = "example"; // example | challenge
    const codes = { example: lesson.example.code, challenge: lesson.challenge.starter };
    let running = false;
    let token = 0;
    let inputResolver = null;

    /* ---------- المحرّر ---------- */
    const editor = PL.CodeEditor({
      value: codes.example,
      onChange: (v) => (codes[mode] = v),
      onRun: () => run(),
    });

    /* ---------- العناصر ---------- */
    const tabExample = h("button", { class: "tab active", onClick: () => setMode("example") }, "🧪 المثال");
    const tabChallenge = h("button", { class: "tab", onClick: () => setMode("challenge") }, "🎯 التحدّي");

    const statusChip = h("span", { class: "chip status loading", title: "حالة بيئة بايثون" }, "⏳ تحميل بايثون…");
    const btnRun = h("button", { class: "btn primary", title: "Ctrl + Enter", onClick: () => run() }, "▶ تشغيل");
    const btnStop = h("button", { class: "btn danger hidden", onClick: () => stop() }, "⏹ إيقاف");
    const btnReset = h("button", { class: "btn ghost", onClick: () => reset() }, "↺ إعادة");
    const btnCheck = h("button", { class: "btn success hidden", onClick: () => run(true) }, "✔ تحقّق من حلّي");

    const strip = h("div", { class: "challenge-strip hidden" });

    const outEl = h("pre", { class: "out", dir: "auto" });
    const errEl = h("div", { class: "err hidden" });
    const inputLabel = h("span", { class: "input-label", dir: "auto" });
    const inputField = h("input", { class: "input-field", type: "text", autocomplete: "off", dir: "auto", "aria-label": "إدخال المستخدم" });
    const inputBtn = h("button", { class: "btn primary small", type: "submit" }, "إرسال ↵");
    const inputRow = h("form", { class: "input-row hidden" }, inputLabel, inputField, inputBtn);
    const feedback = h("div", { class: "feedback hidden" });

    inputRow.addEventListener("submit", (e) => {
      e.preventDefault();
      if (inputResolver) {
        const r = inputResolver;
        inputResolver = null;
        const v = inputField.value;
        inputField.value = "";
        inputRow.classList.add("hidden");
        r(v);
      }
    });

    const consoleEl = h("div", { class: "console" },
      h("div", { class: "console-head" },
        h("span", {}, "🖥️ النتيجة"),
        h("button", { class: "link-btn", onClick: () => clearConsole() }, "مسح")),
      h("div", { class: "console-body" }, outEl, errEl, inputRow),
      feedback);

    const el = h("section", { class: "pane workspace" },
      h("div", { class: "ws-head" },
        h("div", { class: "tabs" }, tabExample, tabChallenge),
        statusChip),
      strip,
      h("div", { class: "ws-toolbar" }, btnRun, btnStop, btnCheck, btnReset,
        h("span", { class: "hint-keys" }, "Ctrl + Enter للتشغيل")),
      h("div", { class: "ed-wrap" }, editor.el),
      consoleEl);

    /* ---------- حالة بيئة بايثون ---------- */
    function paintStatus(s) {
      statusChip.className = "chip status " + s;
      statusChip.textContent =
        s === "ready" ? "🟢 بايثون جاهز" : s === "error" ? "🔴 تعذّر التحميل" : "⏳ تحميل بايثون…";
    }
    paintStatus(PL.runner.status());
    const off = PL.runner.onStatus(paintStatus);
    el.dispose = () => {
      off();
      stop(true);
    };
    PL.runner.warmUp();

    /* ---------- الوضعان ---------- */
    function setMode(m) {
      if (running) stop();
      codes[mode] = editor.getValue();
      mode = m;
      tabExample.classList.toggle("active", m === "example");
      tabChallenge.classList.toggle("active", m === "challenge");
      editor.setValue(codes[m]);
      editor.highlightLine(null);
      clearConsole();
      const isCh = m === "challenge";
      btnCheck.classList.toggle("hidden", !isCh);
      strip.classList.toggle("hidden", !isCh);
      if (isCh) {
        strip.innerHTML = "";
        strip.append(...[
          h("div", { class: "strip-title" }, "🎯 المطلوب منك"),
          h("div", { html: PL.rich(lesson.challenge.prompt) }),
          lesson.challenge.expected
            ? h("div", { class: "strip-expected" }, "الناتج المتوقّع:", h("pre", { dir: "auto" }, lesson.challenge.expected))
            : null
        ].filter(Boolean));
      }
      hooks.onMode && hooks.onMode(m);
    }

    function reset() {
      if (running) stop();
      codes[mode] = mode === "example" ? lesson.example.code : lesson.challenge.starter;
      editor.setValue(codes[mode]);
      editor.highlightLine(null);
      clearConsole();
    }

    function clearConsole() {
      outEl.textContent = "";
      errEl.classList.add("hidden");
      feedback.classList.add("hidden");
      feedback.innerHTML = "";
      inputRow.classList.add("hidden");
    }

    function setRunning(r) {
      running = r;
      btnRun.disabled = r;
      btnCheck.disabled = r;
      btnStop.classList.toggle("hidden", !r);
    }

    function askInput() {
      return new Promise((resolve) => {
        inputResolver = resolve;
        inputLabel.textContent = "⌨️ البرنامج ينتظر إجابتك:";
        inputRow.classList.remove("hidden");
        inputField.focus();
      });
    }

    function showError(err) {
      errEl.classList.remove("hidden");
      errEl.innerHTML = "";
      errEl.append(...[
        h("div", { class: "err-ar", html: "🛑 " + PL.rich(PL.explainError(err)) }),
        err.type !== "LoadError" && err.type !== "RuntimeError"
          ? h("pre", { class: "err-en", dir: "ltr" }, `${err.type}: ${err.msg}` + (err.line ? `  (line ${err.line})` : ""))
          : null
      ].filter(Boolean));
      if (err.line) editor.highlightLine(err.line);
    }

    /* ---------- التنفيذ ---------- */
    async function run(isCheck) {
      if (running) return;
      const myToken = ++token;
      const code = editor.getValue();
      clearConsole();
      editor.highlightLine(null);
      setRunning(true);
      if (PL.runner.status() !== "ready") outEl.textContent = "⏳ جارٍ تحميل بيئة بايثون (مرة واحدة فقط، قد تستغرق ثوانٍ)…";

      const answers = [];
      let res;
      while (true) {
        res = await PL.runner.run(code, answers);
        if (myToken !== token) return; // أُوقف التشغيل
        outEl.textContent = res.out || "";
        if (res.needInput) {
          const a = await askInput();
          if (a === null || myToken !== token) return;
          answers.push(a);
          continue;
        }
        break;
      }
      setRunning(false);

      if (res.timeout) {
        showError({ type: "RuntimeError", msg: "⏱️ استغرق البرنامج وقتاً طويلاً فأوقفناه. غالباً لديك حلقة لا نهائية: تأكد أن شرط [[while]] سيصبح خاطئاً في النهاية.", line: null });
        return;
      }
      if (res.error) {
        showError(res.error);
        if (isCheck) fail("الكود فيه خطأ، صحّحه أولاً ثم اضغط «تحقّق» من جديد.");
        return;
      }
      if (!res.out) outEl.textContent = "(لم يطبع البرنامج شيئاً — استخدم print لترى النتيجة)";
      if (isCheck) verify(res.out, code);
    }

    function stop(silent) {
      token++;
      if (inputResolver) {
        const r = inputResolver;
        inputResolver = null;
        r(null);
      }
      PL.runner.stop();
      inputRow.classList.add("hidden");
      setRunning(false);
      if (!silent) outEl.textContent += (outEl.textContent ? "\n" : "") + "⏹ تم إيقاف التشغيل.";
    }

    /* ---------- فحص التحدّي ---------- */
    function fail(msg) {
      feedback.className = "feedback bad";
      feedback.innerHTML = "";
      feedback.append(h("div", { html: "❌ " + PL.rich(msg) }));
    }

    function verify(out, code) {
      let ok = false;
      try {
        ok = !!lesson.challenge.check(out, code);
      } catch (e) {
        ok = false;
      }
      if (!ok) {
        fail("ليس بعد! قارن ناتجك بالناتج المتوقّع في الأعلى وتأكد أنك استخدمت المفهوم المطلوب. يمكنك فتح «تلميح» في الجهة اليمنى.");
        return;
      }
      const first = !PL.store.isLessonDone(level, lesson);
      PL.store.markLessonDone(level, lesson);
      feedback.className = "feedback good";
      feedback.innerHTML = "";
      feedback.append(
        h("div", { html: PL.rich("✅ **أحسنت!** حلّك صحيح.") }),
        h("a", { class: "btn primary small", href: hooks.nextHref || "#/" }, hooks.nextLabel || "التالي ←")
      );
      hooks.onPass && hooks.onPass(first);
    }

    /* ---------- واجهة للخارج ---------- */
    el.api = {
      highlight(n) {
        if (mode === "example") editor.highlightLine(n);
      },
      showExample(runIt) {
        if (mode !== "example") setMode("example");
        codes.example = lesson.example.code;
        editor.setValue(codes.example);
        if (runIt) run();
      },
      startChallenge() {
        setMode("challenge");
        editor.focus();
      },
      markDone() {
        tabChallenge.textContent = "🎯 التحدّي ✅";
      },
    };
    if (PL.store.isLessonDone(level, lesson)) el.api.markDone();
    return el;
  };
})();
