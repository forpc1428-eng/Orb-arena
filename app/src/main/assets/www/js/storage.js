// ORB ARENA — saving, share codes, files and the Android bridge.

const KEY = 'orb-arena-v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage may be unavailable */ }
}

// Share code: ORB1:<base64 of JSON>, unicode-safe.
export function toShareCode(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'ORB1:' + btoa(bin);
}

export function fromShareCode(text) {
  const t = String(text || '').trim();
  if (t.startsWith('{')) return JSON.parse(t);
  const m = t.match(/ORB1:([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error('Not an ORB code or JSON.');
  const bin = atob(m[1]);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const isAndroid = () => typeof window.AndroidBridge !== 'undefined';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Saves a file: Android → Downloads folder; browser → download link.
export async function saveFile(name, blob) {
  if (isAndroid()) {
    const b64 = await blobToBase64(blob);
    const id = window.AndroidBridge.saveStart(name, blob.type || 'application/octet-stream');
    const CH = 512 * 1024;
    for (let i = 0; i < b64.length; i += CH) window.AndroidBridge.saveChunk(id, b64.slice(i, i + CH));
    const where = window.AndroidBridge.saveEnd(id);
    return where || 'Downloads';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'your downloads';
}

export function vibrate(ms) {
  try {
    if (isAndroid() && window.AndroidBridge.vibrate) window.AndroidBridge.vibrate(ms);
    else if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) { /* ignore */ }
}

export async function copyText(text) {
  try {
    if (isAndroid() && window.AndroidBridge.copy) { window.AndroidBridge.copy(text); return true; }
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
}
