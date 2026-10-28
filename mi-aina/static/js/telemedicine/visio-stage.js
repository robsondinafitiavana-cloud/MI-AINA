/* MI-AINA - WebRTC media and Channels signaling for the telemedicine stage. */
(function () {
  const RTC_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };
  let state = null;

  function csrfToken() {
    return document.querySelector('#csrfHolder [name=csrfmiddlewaretoken]')?.value
      || document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] || '';
  }

  function setStatus(text) {
    const status = document.getElementById('vcStatus');
    if (status) status.textContent = text;
  }

  function stage() {
    return document.getElementById('vStage');
  }

  function endUrl(callId) {
    return `/telemedicine/${encodeURIComponent(callId)}/terminer/`;
  }

  function setTrack(button, enabled, iconOn, iconOff) {
    if (!button) return;
    button.classList.toggle('on', enabled);
    button.classList.toggle('off', !enabled);
    const icon = button.querySelector('i');
    if (icon) icon.dataset.lucide = enabled ? iconOn : iconOff;
    if (window.lucide) window.lucide.createIcons();
  }

  async function createOffer() {
    if (!state || !state.peer || state.makingOffer) return;
    state.makingOffer = true;
    try {
      const offer = await state.peer.createOffer();
      await state.peer.setLocalDescription(offer);
      state.socket.send(JSON.stringify({ type: 'offer', sdp: state.peer.localDescription }));
    } finally {
      state.makingOffer = false;
    }
  }

  async function handleSignal(message) {
    if (!state || !state.peer) return;
    if (message.type === 'offer') {
      await state.peer.setRemoteDescription(message.sdp);
      for (const candidate of state.pendingCandidates.splice(0)) {
        await state.peer.addIceCandidate(candidate);
      }
      const answer = await state.peer.createAnswer();
      await state.peer.setLocalDescription(answer);
      state.socket.send(JSON.stringify({ type: 'answer', sdp: state.peer.localDescription }));
      return;
    }
    if (message.type === 'answer') {
      await state.peer.setRemoteDescription(message.sdp);
      for (const candidate of state.pendingCandidates.splice(0)) {
        await state.peer.addIceCandidate(candidate);
      }
      return;
    }
    if (message.type === 'ice' && message.candidate) {
      const candidate = new RTCIceCandidate(message.candidate);
      if (state.peer.remoteDescription) await state.peer.addIceCandidate(candidate);
      else state.pendingCandidates.push(candidate);
      return;
    }
    if (message.type === 'peer-left') {
      const remote = document.getElementById('remoteVideo');
      if (remote) remote.srcObject = null;
      setStatus('Le correspondant a quitté la salle.');
      const currentStage = stage();
      const callId = currentStage?.dataset.call;
      const resume = document.getElementById('consultCallNotes')?.value.trim() || '';
      stop();
      if (currentStage) currentStage.dataset.call = '';
      let summarySaved = true;
      if (callId) {
        try {
          const response = await fetch(endUrl(callId), {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken(), 'Content-Type': 'application/json' },
            body: JSON.stringify({resume}),
          });
          summarySaved = response.ok;
        } catch (_) { summarySaved = false; }
      }
      stop();
      if (currentStage) currentStage.dataset.call = '';
      setStatus('Appel terminé. Vous pouvez en démarrer un autre.');
      document.dispatchEvent(new CustomEvent('mi-call-ended', {detail: {summarySaved}}));
    }
  }

  function bindControls() {
    if (!state || state.controlsBound) return;
    const endControl = document.getElementById('vcEnd');
    if (endControl?.dataset.rtcBound === '1') { state.controlsBound = true; return; }
    state.controlsBound = true;
    const mic = document.getElementById('vcMic');
    const cam = document.getElementById('vcCam');
    const eco = document.getElementById('vcEco');
    const end = document.getElementById('vcEnd');
    if (end) end.dataset.rtcBound = '1';

    mic?.addEventListener('click', () => {
      const track = state.stream?.getAudioTracks()[0];
      if (!track) return;
      track.enabled = !track.enabled;
      setTrack(mic, track.enabled, 'mic', 'mic-off');
    });
    cam?.addEventListener('click', () => {
      const track = state.stream?.getVideoTracks()[0];
      if (!track) return;
      track.enabled = !track.enabled;
      setTrack(cam, track.enabled, 'video', 'video-off');
    });
    eco?.addEventListener('click', () => {
      const currentStage = stage();
      if (!currentStage) return;
      currentStage.classList.toggle('eco');
      const enabled = !currentStage.classList.contains('eco');
      const pill = document.getElementById('netPill');
      if (pill) pill.textContent = enabled ? 'HD · 720p · 4G' : 'ÉCO · 240p · 3G';
      setStatus(enabled ? 'Qualité standard.' : 'Mode économie de données activé.');
    });
    end?.addEventListener('click', async () => {
      const currentStage = stage();
      const callId = currentStage?.dataset.call;
      const resume = document.getElementById('consultCallNotes')?.value.trim() || '';
      stop();
      if (currentStage) currentStage.dataset.call = '';
      setStatus('Appel terminé. Vous pouvez en démarrer un autre.');
      let summarySaved = true;
      if (callId) {
        try {
          const response = await fetch(endUrl(callId), {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken(), 'Content-Type': 'application/json' },
            body: JSON.stringify({resume}),
          });
          summarySaved = response.ok;
        } catch (_) { summarySaved = false; }
      }
      stop();
      if (currentStage) currentStage.dataset.call = '';
      setStatus('Appel terminé. Vous pouvez en démarrer un autre.');
      document.dispatchEvent(new CustomEvent('mi-call-ended', {detail: {summarySaved}}));
    });
  }

  async function start(callId) {
    const currentStage = stage();
    if (!currentStage || !callId) return;
    if (state?.callId === String(callId)) return;
    stop();
    state = {
      callId: String(callId),
      socket: null,
      peer: null,
      stream: null,
      pendingCandidates: [],
      makingOffer: false,
      controlsBound: false,
    };
    bindControls();
    setStatus('Demande d’accès à la caméra et au microphone...');

    try {
      const eco = currentStage.classList.contains('eco');
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: eco ? { width: { ideal: 320 }, height: { ideal: 240 } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const local = document.getElementById('localVideo');
      if (local) local.srcObject = state.stream;
      setTrack(document.getElementById('vcMic'), true, 'mic', 'mic-off');
      setTrack(document.getElementById('vcCam'), true, 'video', 'video-off');

      state.peer = new RTCPeerConnection(RTC_CONFIG);
      state.stream.getTracks().forEach(track => state.peer.addTrack(track, state.stream));
      state.peer.ontrack = event => {
        const remote = document.getElementById('remoteVideo');
        if (remote) remote.srcObject = event.streams[0];
        const fallback = currentStage.querySelector('.vc-peer');
        if (fallback) fallback.style.display = 'none';
        setStatus('Connexion vidéo établie.');
        document.dispatchEvent(new CustomEvent('mi-call-connected'));
      };
      state.peer.onicecandidate = event => {
        if (event.candidate && state.socket?.readyState === WebSocket.OPEN) {
          state.socket.send(JSON.stringify({ type: 'ice', candidate: event.candidate }));
        }
      };
      state.peer.onconnectionstatechange = () => {
        if (['failed', 'disconnected'].includes(state.peer.connectionState)) setStatus('Connexion instable.');
        if (state.peer.connectionState === 'connected') setStatus('Connexion vidéo établie.');
      };

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      state.socket = new WebSocket(`${protocol}://${window.location.host}/ws/telemedicine/${encodeURIComponent(callId)}/`);
      state.socket.onopen = () => setStatus('Salle sécurisée, en attente du correspondant...');
      state.socket.onmessage = async event => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'peer-joined' && currentStage.dataset.role === 'PREMIERE_LIGNE') await createOffer();
          if (message.type === 'ready' && currentStage.dataset.role === 'PREMIERE_LIGNE') return;
          await handleSignal(message);
        } catch (error) {
          setStatus('Signalisation indisponible.');
        }
      };
      state.socket.onerror = () => setStatus('WebSocket indisponible. Vérifiez le serveur ASGI.');
      state.socket.onclose = () => {
        if (state) setStatus('Signalisation terminée.');
      };
    } catch (error) {
      setStatus('Caméra ou microphone refusé.');
      if (window.MI?.toast) window.MI.toast('Autorisez la caméra et le microphone pour démarrer la visio.', 'error');
    }
  }

  function stop() {
    if (!state) return;
    state.socket?.close();
    state.peer?.close();
    state.stream?.getTracks().forEach(track => track.stop());
    const local = document.getElementById('localVideo');
    const remote = document.getElementById('remoteVideo');
    if (local) local.srcObject = null;
    if (remote) remote.srcObject = null;
    const fallback = stage()?.querySelector('.vc-peer');
    if (fallback) fallback.style.display = '';
    state = null;
  }

  window.MIWebRTC = { start, stop };
  window.initTelemedicineStage = function () {
    const currentStage = stage();
    if (currentStage?.dataset.call) start(currentStage.dataset.call);
  };
  document.addEventListener('DOMContentLoaded', window.initTelemedicineStage);
})();
