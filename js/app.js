import { createMidiManager } from "./midi.js";

let isImgEdit = false;
let isLabelEdit = false;
let currentPad = null;
const fxStates = { "fx-a": false, "fx-b": false };

function updateStatusBadge(status) {
  const st = document.getElementById("status-text");
  if (!st) return;

  st.innerText = status.label;
  st.title = status.detail || "";

  if (status.kind === "connected") {
    st.className = "text-[10px] font-black text-green-500 uppercase tracking-widest border border-green-900 px-2 py-1 rounded";
    return;
  }

  if (status.kind === "pending") {
    st.className = "text-[10px] font-black text-amber-400 uppercase tracking-widest border border-amber-900 px-2 py-1 rounded";
    return;
  }

  if (status.kind === "no-output") {
    st.className = "text-[10px] font-black text-orange-500 uppercase tracking-widest border border-orange-900 px-2 py-1 rounded";
    return;
  }

  st.className = "text-[10px] font-black text-red-600 uppercase tracking-widest border border-red-900 px-2 py-1 rounded";
}

const midi = createMidiManager((status) => {
  updateStatusBadge(status);
  if (status.kind === "error") {
    console.error("MIDI error:", status.error);
    console.table(midi.getDiagnostics());
    alert(`${status.label}: ${status.detail}`);
  }
});

function switchTab(tab) {
  document.getElementById("view-mixer")?.classList.toggle("hidden", tab !== "mixer");
  document.getElementById("view-pads")?.classList.toggle("hidden", tab !== "pads");
  document.getElementById("img-btn")?.classList.toggle("hidden", tab !== "pads");

  const mixerBtn = document.getElementById("btn-mixer");
  const padsBtn = document.getElementById("btn-pads");

  if (mixerBtn) mixerBtn.className = `tab-btn text-[11px] uppercase ${tab === "mixer" ? "tab-active" : "text-zinc-600"}`;
  if (padsBtn) padsBtn.className = `tab-btn text-[11px] uppercase ${tab === "pads" ? "tab-active" : "text-zinc-600"}`;
}

function toggleLabelEdit() {
  isLabelEdit = !isLabelEdit;
  document
    .querySelectorAll(".editable, .dj-pad, .round-btn, .bj-block button, .dj-btn")
    .forEach((el) => el.classList.toggle("editing-border", isLabelEdit));
}

function changeLabel(el) {
  const newText = prompt("Renombrar:", el.innerText || "");
  if (newText === null) return;

  el.innerText = newText;
  localStorage.setItem("label_" + (el.id || el.getAttribute("data-note")), newText);
}

function handleFX(el, note) {
  const id = el.id;
  fxStates[id] = !fxStates[id];
  midi.sendNoteOn(note, fxStates[id] ? 127 : 0);
  el.classList.toggle("fx-blink", fxStates[id]);
}

function initButtonEvents() {
  document.querySelectorAll(".dj-btn, .fx-btn, .dj-pad, .bj-block button").forEach((el) => {
    const rawNote = el.getAttribute("data-note") || (el.id ? el.id.split("-")[1] : "");
    const note = parseInt(rawNote, 10);

    el.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();

        if (isLabelEdit) {
          changeLabel(el);
          return;
        }

        if (isImgEdit && el.classList.contains("dj-pad")) {
          currentPad = note;
          document.getElementById("pad-file-input")?.click();
          return;
        }

        if (el.classList.contains("fx-btn")) {
          handleFX(el, note);
          return;
        }

        midi.sendNoteOn(note);
        el.classList.add("glow-active");
      },
      { passive: false }
    );

    const stop = () => {
      if (el.classList.contains("fx-btn")) return;
      midi.sendNoteOff(note);
      el.classList.remove("glow-active");
    };

    el.addEventListener("touchend", stop);
    el.addEventListener("touchcancel", stop);

    el.addEventListener("mousedown", () => {
      if (isLabelEdit) {
        changeLabel(el);
        return;
      }

      if (el.classList.contains("fx-btn")) {
        handleFX(el, note);
        return;
      }

      el.classList.add("glow-active");
      midi.sendNoteOn(note);
    });

    el.addEventListener("mouseup", stop);
    el.addEventListener("mouseleave", stop);
  });
}

function initPadsGrid() {
  const grid = document.getElementById("pads-grid");
  if (!grid) return;

  for (let i = 0; i < 16; i += 1) {
    const note = 60 + i;
    const pad = document.createElement("div");

    pad.id = "pad-" + note;
    pad.setAttribute("data-note", String(note));
    pad.className =
      "dj-pad flex items-center justify-center rounded-2xl border border-zinc-800 text-zinc-600 font-black text-2xl";
    pad.innerText = localStorage.getItem("label_" + pad.id) || String(i + 1);

    const bg = localStorage.getItem(`img_${note}`);
    if (bg) {
      pad.style.backgroundImage = `url(${bg})`;
      pad.innerText = "";
    }

    grid.appendChild(pad);
  }
}

function restoreSavedLabels() {
  document.querySelectorAll(".editable, .dj-btn").forEach((el) => {
    const saved = localStorage.getItem("label_" + (el.id || el.getAttribute("data-note")));
    if (saved) el.innerText = saved;
  });
}

function toggleImgEdit() {
  isImgEdit = !isImgEdit;
  const btn = document.getElementById("img-btn");
  if (btn) btn.innerText = isImgEdit ? "IMG: ON" : "IMG: OFF";
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    return;
  }

  document.exitFullscreen();
}

function bindPadImageInput() {
  const input = document.getElementById("pad-file-input");
  if (!input) return;

  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file || currentPad == null) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const el = document.getElementById(`pad-${currentPad}`);
      if (!el) return;

      el.style.backgroundImage = `url(${ev.target.result})`;
      el.innerText = "";
      localStorage.setItem(`img_${currentPad}`, ev.target.result);
    };
    reader.readAsDataURL(file);
  };
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("SW registration failed:", error);
    });
  }
}

function bindGlobals() {
  window.requestMidi = () => midi.request();
  window.switchTab = switchTab;
  window.toggleLabelEdit = toggleLabelEdit;
  window.toggleImgEdit = toggleImgEdit;
  window.toggleFullscreen = toggleFullscreen;
  window.sendCC = (cc, value) => midi.sendCC(Number(cc), Number(value));
  window.midiDebug = () => {
    const info = midi.getDiagnostics();
    console.table(info);
    return info;
  };
}

function initAutoRequestOnFirstTouch() {
  window.addEventListener(
    "touchstart",
    () => {
      midi.request();
    },
    { once: true }
  );
}

function init() {
  window.oncontextmenu = (e) => e.preventDefault();

  bindGlobals();
  registerServiceWorker();
  initPadsGrid();
  restoreSavedLabels();
  initButtonEvents();
  bindPadImageInput();
  initAutoRequestOnFirstTouch();

  updateStatusBadge({
    kind: "idle",
    label: "DESCONECTADO",
    detail: "Toca el estado para solicitar acceso MIDI.",
  });
}

init();
