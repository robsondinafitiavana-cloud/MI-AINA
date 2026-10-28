/* Simulation uniquement : température adulte au repos, variation lente bornée. */
(function (root) {
  function createTemperatureSimulator(initial = 36.7) {
    let value = initial;
    let trend = 0.01;
    let captureCount = 0;
    let running = false;
    function generateTemperature(reference = value) {
      if (Number.isFinite(Number(reference))) {
        captureCount += 1;
        value = Number(reference) + Math.sin(captureCount * 1.37) * 0.025;
      }
      if (running) {
        trend += Math.sin(Date.now() / 17000) * 0.0015;
        trend = Math.max(-0.025, Math.min(0.025, trend));
        value += trend + Math.sin(Date.now() / 2300) * 0.012;
        if (value < 36.3 || value > 37.2) trend = -trend;
        value = Math.max(36.3, Math.min(37.2, value));
      }
      value = Math.max(36.3, Math.min(37.2, value));
      return Number(value.toFixed(1));
    }
    return {
      generateTemperature,
      start() { running = true; },
      stop() { running = false; },
      reset() { value = initial; trend = 0.01; captureCount = 0; running = false; },
      getCurrentValue() { return Number(value.toFixed(1)); },
    };
  }
  root.MiAinaTemperatureSimulator = { create: createTemperatureSimulator };
})(window);
