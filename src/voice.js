import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

// Reconnaissance vocale :
//  - dans l'APK (natif) -> plugin Capacitor (fiable sur Android)
//  - dans un navigateur  -> Web Speech API (Chrome, Edge...)

const isNative = (Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) || false;
let webRec = null;
let listening = false;

export function voiceSupported() {
  if (isNative) return true;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isListening() { return listening; }

export async function startVoice({ onPartial, onState } = {}) {
  if (listening) return;

  if (isNative) {
    try {
      await SpeechRecognition.requestPermissions();
      await SpeechRecognition.removeAllListeners();
      SpeechRecognition.addListener('partialResults', (data) => {
        const t = data && data.matches && data.matches[0];
        if (t) onPartial && onPartial(t);
      });
      await SpeechRecognition.start({
        language: 'fr-FR',
        maxResults: 1,
        partialResults: true,
        popup: false
      });
      listening = true;
      onState && onState('listening');
    } catch (e) {
      listening = false;
      onState && onState('error');
    }
    return;
  }

  // --- navigateur ---
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onState && onState('error'); return; }
  webRec = new SR();
  webRec.lang = 'fr-FR';
  webRec.interimResults = true;
  webRec.continuous = false;
  webRec.maxAlternatives = 1;

  let finalText = '';
  webRec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    onPartial && onPartial((finalText + ' ' + interim).trim());
  };
  webRec.onstart = () => { listening = true; onState && onState('listening'); };
  webRec.onerror = () => { listening = false; onState && onState('error'); };
  webRec.onend = () => { listening = false; onState && onState('idle'); };
  try { webRec.start(); } catch (e) { onState && onState('error'); }
}

export async function stopVoice() {
  listening = false;
  if (isNative) {
    try { await SpeechRecognition.stop(); } catch (e) {}
    return;
  }
  try { webRec && webRec.stop(); } catch (e) {}
}
