/* Signal synthétique de démonstration. Il ne représente pas un ECG médical acquis. */
(function (root) {
  function createEcgSimulator() {
    let bpm = 72;
    let running = false;
    const sampleRate = 128;
    function valueAt(seconds) {
      const phase = ((seconds * bpm / 60) % 1 + 1) % 1;
      const g = (center, width) => Math.exp(-Math.pow((phase - center) / width, 2));
      const baseline = Math.sin(seconds * 0.7) * 0.025 + Math.sin(seconds * 9.1) * 0.006;
      const p = 0.11 * g(0.18, 0.034);
      const q = -0.16 * g(0.295, 0.012);
      const r = 0.92 * g(0.315, 0.009);
      const s = -0.24 * g(0.338, 0.013);
      const t = 0.28 * g(0.61, 0.075);
      const noise = Math.sin(seconds * 37.1) * 0.007 + Math.sin(seconds * 53.7) * 0.004;
      return Math.max(-1, Math.min(1, baseline + p + q + r + s + t + noise));
    }
    function getCurrentSignal(duration = 2) {
      const end = Date.now() / 1000;
      const count = Math.round(sampleRate * duration);
      return Array.from({ length: count }, (_, i) => {
        const v = valueAt(end - duration + i / sampleRate);
        return Math.round(2048 + v * 1250);
      });
    }
    return {
      start() { running = true; }, stop() { running = false; },
      reset() { running = false; bpm = 72; },
      getCurrentSignal, getHeartRate() { return bpm; },
      setHeartRate(value) { bpm = Math.max(60, Math.min(90, Math.round(value))); },
      isRunning() { return running; },
      sampleRate,
    };
  }
  root.MiAinaEcgSimulator = { create: createEcgSimulator };
})(window);
