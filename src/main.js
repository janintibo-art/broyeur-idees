import './style.css';
import { initScene, grindThought } from './scene.js';
import { voiceSupported, startVoice, stopVoice, isListening } from './voice.js';

const canvas = document.getElementById('stage');
const input = document.getElementById('thought');
const grindBtn = document.getElementById('grind');
const micBtn = document.getElementById('mic');
const countEl = document.getElementById('count');
const hintEl = document.getElementById('hint');

initScene(canvas);

// --- compteur de pensees broyees (memorise sur l'appareil) ---
let count = parseInt(localStorage.getItem('broyees') || '0', 10);
countEl.textContent = count;

function broyer() {
  const text = input.value.trim();
  if (!text) {
    input.parentElement.classList.add('shake');
    setTimeout(() => input.parentElement.classList.remove('shake'), 300);
    return;
  }
  grindThought(text);
  count++;
  countEl.textContent = count;
  localStorage.setItem('broyees', String(count));
  input.value = '';
  if (navigator.vibrate) navigator.vibrate(40);
}

grindBtn.addEventListener('click', broyer);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); broyer(); }
});

// --- micro ---
if (!voiceSupported()) {
  micBtn.disabled = true;
  micBtn.title = 'Micro indisponible ici';
} else {
  micBtn.addEventListener('click', async () => {
    if (isListening()) {
      await stopVoice();
      micBtn.classList.remove('listening');
      return;
    }
    micBtn.classList.add('listening');
    hintEl.textContent = 'Je t\u2019\u00e9coute\u2026 dis ta pens\u00e9e.';
    await startVoice({
      onPartial: (t) => { input.value = t; },
      onState: (s) => {
        if (s === 'listening') {
          micBtn.classList.add('listening');
        } else {
          micBtn.classList.remove('listening');
          hintEl.textContent = 'Appuie sur BROYER quand c\u2019est pr\u00eat.';
        }
      }
    });
  });
}
