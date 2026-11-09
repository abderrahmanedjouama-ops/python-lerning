/* ==========================================================================
   runner.js — تشغيل بايثون داخل المتصفح عبر Pyodide داخل Web Worker
   - الـ Worker يمنع تجمّد الصفحة، ويمكن إيقافه إذا وقع المستخدم في حلقة لا نهائية.
   - input(): لأن الـ Worker لا يستطيع الانتظار المتزامن للمستخدم، نستخدم تقنية
     "إعادة التشغيل": إذا طلب البرنامج إدخالاً جديداً نوقفه، نسأل المستخدم،
     ثم نعيد تشغيله من البداية مع تمرير كل الإجابات السابقة.
     (مناسب تماماً لبرامج التعلّم لأنها حتمية.)
   ========================================================================== */
(function () {
  const PL = window.PL;
  const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
  const TIMEOUT_MS = 8000;

  /* ---------------- كود بايثون الذي يُحمَّل داخل الـ Worker ---------------- */
  const PRELUDE = String.raw`
import sys, json, traceback

class _NeedInput(BaseException):
    pass

class _Out:
    LIMIT = 20000
    def __init__(self):
        self.parts = []
        self.size = 0
    def write(self, s):
        s = str(s)
        self.size += len(s)
        if self.size > self.LIMIT:
            raise RuntimeError("المخرجات كبيرة جداً! هل لديك حلقة تطبع بلا توقف؟")
        self.parts.append(s)
        return len(s)
    def flush(self):
        pass
    def text(self):
        return "".join(self.parts)

def __run(code, answers):
    out = _Out()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    state = {"i": 0}
    result = {"needInput": False, "error": None}

    def fake_input(prompt=""):
        sys.stdout.write(str(prompt))
        if state["i"] < len(answers):
            a = str(answers[state["i"]])
            state["i"] += 1
            sys.stdout.write(a + "\n")
            return a
        raise _NeedInput()

    g = {"__name__": "__main__", "input": fake_input}
    try:
        exec(compile(code, "main.py", "exec"), g)
    except _NeedInput:
        result["needInput"] = True
    except SystemExit:
        pass
    except BaseException as e:
        line = None
        tb = e.__traceback__
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == "main.py":
                line = tb.tb_lineno
            tb = tb.tb_next
        msg = str(e)
        if isinstance(e, SyntaxError):
            line = e.lineno
            msg = e.msg
        result["error"] = {"type": type(e).__name__, "msg": msg, "line": line}
    finally:
        sys.stdout, sys.stderr = old_out, old_err
    result["out"] = out.text()
    return json.dumps(result, ensure_ascii=False)
`;

  const WORKER_SRC = String.raw`
let pyodide = null;
const ready = (async () => {
  importScripts("__URL__");
  pyodide = await loadPyodide();
  pyodide.runPython(__PRELUDE__);
  postMessage({ type: "ready" });
})().catch((e) => { postMessage({ type: "fatal", message: String(e) }); throw e; });

onmessage = async (ev) => {
  const { id, code, answers } = ev.data;
  try {
    await ready;
    pyodide.globals.set("__code", code);
    pyodide.globals.set("__answers", pyodide.toPy(answers));
    const json = pyodide.runPython("__run(__code, list(__answers))");
    postMessage({ type: "result", id, data: JSON.parse(json) });
  } catch (e) {
    postMessage({ type: "result", id, data: { out: "", error: { type: "InternalError", msg: String(e), line: null } } });
  }
};
`
    .replace("__URL__", PYODIDE_URL)
    .replace("__PRELUDE__", () => JSON.stringify(PRELUDE));

  /* ---------------- إدارة الـ Worker ---------------- */
  let worker = null;
  let isReady = false;
  let fatal = null;
  let readyWaiters = [];
  let pending = null; // { id, resolve, timer }
  let nextId = 1;
  const statusListeners = new Set();

  function emit() {
    const s = fatal ? "error" : isReady ? "ready" : "loading";
    statusListeners.forEach((fn) => fn(s, fatal));
  }

  function spawn() {
    isReady = false;
    fatal = null;
    const blob = new Blob([WORKER_SRC], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    worker = new Worker(url);
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "ready") {
        isReady = true;
        readyWaiters.splice(0).forEach((w) => w.resolve());
        emit();
      } else if (m.type === "fatal") {
        fatal = m.message;
        readyWaiters.splice(0).forEach((w) => w.reject(new Error(m.message)));
        emit();
      } else if (m.type === "result" && pending && pending.id === m.id) {
        clearTimeout(pending.timer);
        const p = pending;
        pending = null;
        p.resolve(m.data);
      }
    };
    worker.onerror = (e) => {
      fatal = e.message || "worker error";
      readyWaiters.splice(0).forEach((w) => w.reject(new Error(fatal)));
      emit();
    };
    emit();
  }

  function whenReady() {
    if (isReady) return Promise.resolve();
    if (fatal) return Promise.reject(new Error(fatal));
    return new Promise((resolve, reject) => readyWaiters.push({ resolve, reject }));
  }

  function killWorker() {
    if (worker) worker.terminate();
    worker = null;
    if (pending) {
      clearTimeout(pending.timer);
    }
  }

  PL.runner = {
    /** تحميل مسبق لبيئة بايثون في الخلفية */
    warmUp() {
      if (!worker) spawn();
    },
    onStatus(fn) {
      statusListeners.add(fn);
      return () => statusListeners.delete(fn);
    },
    status: () => (fatal ? "error" : isReady ? "ready" : "loading"),

    /** تشغيل مرة واحدة. يعيد { out, needInput, error, stopped?, timeout? } */
    async run(code, answers) {
      if (!worker) spawn();
      try {
        await whenReady();
      } catch (e) {
        killWorker();
        return { out: "", error: { type: "LoadError", msg: String(e.message || e), line: null } };
      }
      return new Promise((resolve) => {
        const id = nextId++;
        const timer = setTimeout(() => {
          pending = null;
          killWorker();
          spawn(); // نجهّز بيئة جديدة للمرة القادمة
          resolve({ out: "", timeout: true });
        }, TIMEOUT_MS);
        pending = { id, resolve, timer };
        worker.postMessage({ id, code, answers: answers || [] });
      });
    },

    /** إيقاف التشغيل الحالي فوراً */
    stop() {
      if (!pending) return false;
      const p = pending;
      pending = null;
      clearTimeout(p.timer);
      killWorker();
      spawn();
      p.resolve({ out: "", stopped: true });
      return true;
    },
  };

  /* ---------------- ترجمة الأخطاء إلى عربية مبسّطة ---------------- */
  PL.explainError = function (err) {
    const { type, msg } = err;
    const nameMatch = /'([^']+)'/.exec(msg || "");
    const n = nameMatch ? nameMatch[1] : "";
    switch (type) {
      case "SyntaxError":
        return "خطأ في **كتابة** الكود. تأكد من: إغلاق كل قوس وعلامة تنصيص، وعدم نسيان النقطتين [[:]] بعد [[if]] أو [[for]] أو [[while]] أو [[else]].";
      case "IndentationError":
      case "TabError":
        return "مشكلة في **المسافات** في بداية السطر. الأسطر داخل [[if]] أو [[for]] يجب أن تبدأ بنفس العدد من المسافات (4 مسافات).";
      case "NameError":
        return `بايثون لا يعرف الاسم [[${n}]]. تأكد من: كتابة اسم المتغير بنفس الحروف تماماً، وأنك أنشأته قبل استخدامه، وأنك وضعت النص بين علامتي تنصيص.`;
      case "TypeError":
        return "هناك خلط بين **أنواع** البيانات (مثلاً جمع نص مع رقم). تذكّر: [[input()]] يعيد نصاً دائماً.";
      case "ZeroDivisionError":
        return "لا يمكن القسمة على صفر!";
      case "ValueError":
        return "القيمة غير مناسبة لهذه العملية (مثلاً تحويل كلمة إلى رقم).";
      case "RuntimeError":
        return msg;
      case "LoadError":
        return "تعذّر تحميل بيئة بايثون. تأكد من اتصالك بالإنترنت (تُحمَّل مرة واحدة فقط) ثم أعد تحميل الصفحة.";
      default:
        return "حدث خطأ أثناء التشغيل. اقرأ الرسالة الإنجليزية بالأسفل؛ فهي تدلّك على السطر والمشكلة.";
    }
  };
})();
