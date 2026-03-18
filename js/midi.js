function describeMidiError(error) {
  const name = error?.name || "UnknownError";
  const message = (error?.message || "").toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  if (name === "SecurityError" || message.includes("secure context")) {
    return {
      short: "HTTPS REQUERIDO",
      detail: "WebMIDI exige contexto seguro. En tablet, abre por HTTPS o localhost nativo del dispositivo.",
    };
  }

  if (name === "NotSupportedError" || message.includes("not supported")) {
    return {
      short: "NO SOPORTADO",
      detail: "Este navegador no expone WebMIDI para la app web.",
    };
  }

  if (name === "NotAllowedError" || message.includes("permission")) {
    return {
      short: "PERMISO MIDI",
      detail: "Permite el acceso MIDI en el navegador y vuelve a intentar.",
    };
  }

  if (message.includes("platform dependent initialization failed")) {
    return {
      short: isMobile ? "MIDI NO DISPONIBLE EN ESTE NAVEGADOR" : "FALLO DEL SISTEMA MIDI",
      detail:
        "El navegador no pudo inicializar la capa MIDI del sistema. En tablets suele ser limitacion del navegador WebMIDI. Prueba navegador compatible o usa un bridge de red hacia la Mac.",
    };
  }

  return {
    short: "ERROR MIDI",
    detail: error?.message || "Error desconocido al inicializar MIDI.",
  };
}

export function createMidiManager(onStatusChange) {
  let midiAccess = null;
  let midiOut = null;

  const emit = (status) => {
    if (typeof onStatusChange === "function") {
      onStatusChange(status);
    }
  };

  function pickOutput() {
    if (!midiAccess) {
      midiOut = null;
      return null;
    }

    const outputs = Array.from(midiAccess.outputs.values());
    if (outputs.length === 0) {
      midiOut = null;
      return null;
    }

    midiOut = outputs.find((port) => port.state === "connected") || outputs[0];
    return midiOut;
  }

  function refreshStatus() {
    const out = pickOutput();

    if (out) {
      emit({
        kind: "connected",
        label: "CONECTADO",
        detail: `Salida: ${out.name || "MIDI Out"}`,
      });
      return;
    }

    emit({
      kind: "no-output",
      label: "SIN PUERTO",
      detail: "No hay salidas MIDI disponibles.",
    });
  }

  async function request() {
    emit({ kind: "pending", label: "ESPERANDO...", detail: "Solicitando acceso MIDI." });

    if (!("requestMIDIAccess" in navigator)) {
      emit({
        kind: "unsupported",
        label: "NO SOPORTADO",
        detail: "Este navegador no soporta WebMIDI.",
      });
      return;
    }

    try {
      midiAccess = await navigator.requestMIDIAccess({ sysex: true });
      midiAccess.onstatechange = () => refreshStatus();
      refreshStatus();
    } catch (error) {
      const mapped = describeMidiError(error);
      emit({
        kind: "error",
        label: mapped.short,
        detail: mapped.detail,
        error,
      });
    }
  }

  function getDiagnostics() {
    return {
      secureContext: window.isSecureContext,
      hasWebMIDI: "requestMIDIAccess" in navigator,
      userAgent: navigator.userAgent,
      outputCount: midiAccess ? midiAccess.outputs.size : 0,
      inputCount: midiAccess ? midiAccess.inputs.size : 0,
    };
  }

  function sendNoteOn(note, velocity = 127) {
    if (!midiOut || Number.isNaN(note)) return;
    midiOut.send([0x90, note, velocity]);
  }

  function sendNoteOff(note) {
    if (!midiOut || Number.isNaN(note)) return;
    midiOut.send([0x80, note, 0]);
  }

  function sendCC(cc, value) {
    if (!midiOut || Number.isNaN(cc) || Number.isNaN(value)) return;
    midiOut.send([0xb0, cc, value]);
  }

  return {
    request,
    refreshStatus,
    sendNoteOn,
    sendNoteOff,
    sendCC,
    getDiagnostics,
  };
}
