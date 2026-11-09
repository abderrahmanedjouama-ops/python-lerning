/* ==========================================================================
   core.js — الفضاء العام للتطبيق + أدوات مساعدة صغيرة
   لا يوجد نظام بناء: كل الملفات سكربتات عادية تعمل بفتح index.html مباشرة.
   ========================================================================== */
(function () {
  const PL = (window.PL = window.PL || {});

  /* ---------- سجلّ المستويات ---------- */
  PL.LEVELS = [];
  PL.registerLevel = function (level) {
    PL.LEVELS.push(level);
    PL.LEVELS.sort((a, b) => a.order - b.order);
  };
  PL.getLevel = (id) => PL.LEVELS.find((l) => l.id === id);
  PL.lessonKey = (level, lesson) => level.id + "." + lesson.id;

  /* ---------- إنشاء عناصر DOM (hyperscript بسيط) ---------- */
  PL.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "style" && typeof v === "object")
        Object.entries(v).forEach(([p, val]) =>
          p.startsWith("--") ? el.style.setProperty(p, val) : (el.style[p] = val));
      else if (k.startsWith("on") && typeof v === "function")
        el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    kids.flat(Infinity).forEach((c) => {
      if (c == null || c === false) return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  };

  /* ---------- نص غني آمن: [[كود]] و **غامق** ---------- */
  PL.esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  PL.rich = function (text) {
    return PL.esc(text)
      .replace(/\[\[(.+?)\]\]/g, '<code dir="ltr">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  };

  /* ---------- إشعارات سريعة ---------- */
  PL.toast = function (msg, type) {
    let box = document.getElementById("toasts");
    if (!box) {
      box = PL.h("div", { id: "toasts", class: "toasts", "aria-live": "polite" });
      document.body.append(box);
    }
    const t = PL.h("div", { class: "toast " + (type || "info") }, msg);
    box.append(t);
    setTimeout(() => t.classList.add("out"), 3600);
    setTimeout(() => t.remove(), 4000);
  };

  /* ---------- أرقام عربية-هندية اختيارية (نستخدم الأرقام العادية للوضوح) ---------- */
  PL.pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
})();
