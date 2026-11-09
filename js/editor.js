/* ==========================================================================
   editor.js — محرّر أكواد خفيف مبني من الصفر (بدون مكتبات)
   - طبقة <pre> للتلوين تحت <textarea> شفاف
   - ترقيم الأسطر، تلوين بايثون، إزاحة تلقائية، Tab، Ctrl+Enter للتشغيل
   - إمكانية إبراز سطر معيّن (يُستخدم عند الضغط على شرح سطر)
   ========================================================================== */
(function () {
  const PL = window.PL;
  const h = PL.h;

  const KEYWORDS = new Set(
    "if elif else for while in not and or break continue pass def return import from as class try except finally with lambda is del global yield".split(" ")
  );
  const CONSTS = new Set(["True", "False", "None"]);
  const BUILTINS = new Set(
    "print input range type len int str float bool list dict set sum min max abs round sorted open".split(" ")
  );

  const TOKEN =
    /(#.*$)|([fFrRbB]{0,2}"(?:[^"\\]|\\.)*"?|[fFrRbB]{0,2}'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_\u0600-\u06FF][\w\u0600-\u06FF]*)|(\s+|[\s\S])/g;

  /** يلوّن سطراً واحداً من بايثون ويعيد HTML آمناً */
  function highlightLine(line) {
    let html = "";
    let m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(line)) !== null) {
      const [tok, comment, str, num, ident] = m;
      if (comment) html += `<span class="t-com">${PL.esc(tok)}</span>`;
      else if (str) {
        let s = PL.esc(tok);
        if (/^[fF]|^[rRbB][fF]/.test(tok)) s = s.replace(/\{[^{}]*\}/g, '<span class="t-brace">$&</span>');
        html += `<span class="t-str">${s}</span>`;
      } else if (num) html += `<span class="t-num">${tok}</span>`;
      else if (ident) {
        if (KEYWORDS.has(tok)) html += `<span class="t-kw">${tok}</span>`;
        else if (CONSTS.has(tok)) html += `<span class="t-const">${tok}</span>`;
        else if (BUILTINS.has(tok)) html += `<span class="t-fn">${tok}</span>`;
        else html += PL.esc(tok);
      } else html += PL.esc(tok);
    }
    return html;
  }
  PL.highlightLine = highlightLine;

  /* ------------------------------------------------------------------
     كتلة كود ثابتة (للقراءة فقط) مع إمكانية إبراز الأسطر
     ------------------------------------------------------------------ */
  PL.codeBlock = function (code) {
    const lines = code.replace(/\n$/, "").split("\n");
    const rows = lines.map((l, i) =>
      h("div", { class: "cb-line", "data-line": i + 1 },
        h("span", { class: "cb-num" }, i + 1),
        h("span", { class: "cb-code", html: highlightLine(l) || "&nbsp;" }))
    );
    const el = h("div", { class: "codeblock", dir: "ltr" }, rows);
    el.highlight = (n) =>
      rows.forEach((r, i) => r.classList.toggle("active", n != null && i + 1 === n));
    return el;
  };

  /* ------------------------------------------------------------------
     المحرّر التفاعلي
     ------------------------------------------------------------------ */
  PL.CodeEditor = function (opts) {
    opts = opts || {};
    const gutter = h("div", { class: "ed-gutter", "aria-hidden": "true" });
    const hl = h("pre", { class: "ed-hl", "aria-hidden": "true" });
    const ta = h("textarea", {
      class: "ed-ta",
      spellcheck: "false",
      autocapitalize: "off",
      autocomplete: "off",
      autocorrect: "off",
      "aria-label": "محرّر كود بايثون",
      dir: "ltr",
    });
    const root = h("div", { class: "ed", dir: "ltr" }, gutter, h("div", { class: "ed-body" }, hl, ta));

    let activeLine = null;

    function render() {
      const lines = ta.value.split("\n");
      hl.innerHTML = lines
        .map((l, i) => `<div class="ln${activeLine === i + 1 ? " active" : ""}">${highlightLine(l) || " "}</div>`)
        .join("");
      gutter.innerHTML = lines
        .map((_, i) => `<div class="${activeLine === i + 1 ? "active" : ""}">${i + 1}</div>`)
        .join("");
      syncScroll();
    }
    function syncScroll() {
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
      gutter.scrollTop = ta.scrollTop;
    }

    function insert(text) {
      ta.focus();
      // execCommand يحافظ على سجلّ التراجع (Ctrl+Z)
      if (!document.execCommand || !document.execCommand("insertText", false, text)) {
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
      }
      render();
      opts.onChange && opts.onChange(ta.value);
    }

    ta.addEventListener("input", () => {
      render();
      opts.onChange && opts.onChange(ta.value);
    });
    ta.addEventListener("scroll", syncScroll);
    ta.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        opts.onRun && opts.onRun();
      } else if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        insert("    ");
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        const pos = ta.selectionStart;
        const start = ta.value.lastIndexOf("\n", pos - 1) + 1;
        const m = /^ {1,4}/.exec(ta.value.slice(start));
        if (m) {
          ta.setSelectionRange(start, start + m[0].length);
          insert("");
          ta.setSelectionRange(Math.max(start, pos - m[0].length), Math.max(start, pos - m[0].length));
        }
      } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        const pos = ta.selectionStart;
        const start = ta.value.lastIndexOf("\n", pos - 1) + 1;
        const before = ta.value.slice(start, pos);
        let indent = /^ */.exec(before)[0];
        if (/:\s*$/.test(before)) indent += "    ";
        insert("\n" + indent);
      }
    });

    const api = {
      el: root,
      getValue: () => ta.value,
      setValue(v) {
        ta.value = v;
        ta.scrollTop = 0;
        render();
      },
      highlightLine(n) {
        activeLine = n;
        render();
      },
      focus: () => ta.focus(),
    };
    ta.value = opts.value || "";
    // الرسم الأول بعد إدراج العنصر في الصفحة
    render();
    return api;
  };
})();
