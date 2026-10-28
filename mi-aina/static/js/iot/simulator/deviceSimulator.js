/* Capture-based demo adapter: MLX90614 temperature and simulated pulse only. */
(function (root) {
  const NORMAL_PROFILES = [
    { temperature: 36.6, heartRate: 68 }, { temperature: 36.8, heartRate: 72 },
    { temperature: 36.7, heartRate: 75 }, { temperature: 36.9, heartRate: 70 },
    { temperature: 36.5, heartRate: 73 }, { temperature: 36.7, heartRate: 71 },
    { temperature: 36.8, heartRate: 76 }, { temperature: 36.6, heartRate: 69 },
    { temperature: 37.0, heartRate: 74 }, { temperature: 36.5, heartRate: 72 },
  ];
  const PROFILE_ORDER = [0, 6, 3, 8, 1, 7, 4, 9, 2, 5];

  function createDeviceSimulator() {
    const temperatureSensor = root.MiAinaTemperatureSimulator.create();
    let profileCursor = -1;
    let activeProfile = null;
    let capturedTemperature = null;
    let lastMeasurement = null;
    let queue = [];
    const listeners = new Set();
    function emit() { listeners.forEach(listener => listener(getState())); }

    function generateTemperature(profile = activeProfile) {
      if (!profile) throw new Error('Lancez d’abord une capture.');
      return temperatureSensor.generateTemperature(profile.temperature);
    }
    function generateHeartRate(profile = activeProfile) {
      if (!profile) throw new Error('La température doit être capturée avant le pouls.');
      return Math.max(60, Math.min(90, Math.round(profile.heartRate)));
    }
    function getState() {
      return {
        deviceId: 'MI-AINA-ESP32-SIM', temperature: capturedTemperature,
        bpm: lastMeasurement?.bpm ?? null, lastMeasurement,
        pending: queue.length, source: 'SIMULATION',
      };
    }

    return {
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      generateTemperature,
      generateHeartRate,
      beginCapture() {
        profileCursor = (profileCursor + 1) % PROFILE_ORDER.length;
        activeProfile = NORMAL_PROFILES[PROFILE_ORDER[profileCursor]];
        capturedTemperature = null;
        lastMeasurement = null;
        queue = [];
        emit();
        return activeProfile;
      },
      captureTemperature() {
        capturedTemperature = generateTemperature(activeProfile);
        emit();
        return capturedTemperature;
      },
      finishCapture() {
        if (capturedTemperature === null) throw new Error('La température doit être capturée avant le pouls.');
        const measurement = {
          event_id: crypto.randomUUID(), timestamp: new Date().toISOString(),
          temperature: capturedTemperature, bpm: generateHeartRate(activeProfile),
          source: 'SIMULATION',
        };
        lastMeasurement = measurement;
        queue = [measurement];
        emit();
        return measurement;
      },
      resetCapture() {
        activeProfile = null;
        capturedTemperature = null;
        lastMeasurement = null;
        queue = [];
        emit();
      },
      getState,
      async flush(url, csrf, consultationId) {
        if (!consultationId) throw new Error('Consultation absente.');
        const pending = queue.slice();
        const sent = [];
        for (const item of pending) {
          const response = await fetch(url, { method: 'POST', headers: {
            'X-CSRFToken': csrf, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...item, consultation_id: consultationId }) });
          const result = await response.json();
          if (!response.ok || !result.ok) throw new Error(result.erreur || 'Envoi de la simulation impossible.');
          sent.push({ ...item, measure_id: result.measure_id, device_id: result.device_id });
        }
        queue = queue.slice(sent.length);
        emit();
        return sent;
      },
    };
  }
  root.MiAinaDeviceSimulator = { create: createDeviceSimulator };
})(window);
