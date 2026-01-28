import { getToken } from './api';

let inactivityTimer: number | null = null;
let warningTimer: number | null = null;
let lastActivityTime = Date.now();
let onLogout: (() => void) | null = null;
let onWarning: ((secondsLeft: number) => void) | null = null;

// Aktivite event'leri
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click',
  'keydown'
];

/**
 * Son aktivite zamanını güncelle
 */
function updateActivityTime(): void {
  lastActivityTime = Date.now();
}

/**
 * Inactivity timeout'u başlat
 */
export function startInactivityTimeout(
  timeoutMinutes: number = 30,
  warningMinutes: number = 5,
  onTimeout: () => void,
  onWarningCallback?: (secondsLeft: number) => void
): () => void {
  onLogout = onTimeout;
  onWarning = onWarningCallback || null;

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = warningMinutes * 60 * 1000;

  // Aktivite event'lerini dinle
  const activityHandler = () => {
    updateActivityTime();
    resetTimers();
  };

  ACTIVITY_EVENTS.forEach((event) => {
    window.addEventListener(event, activityHandler, { passive: true });
  });

  // Timer'ları başlat
  resetTimers();

  // Cleanup fonksiyonu
  return () => {
    stopInactivityTimeout();
    ACTIVITY_EVENTS.forEach((event) => {
      window.removeEventListener(event, activityHandler);
    });
  };

  function resetTimers(): void {
    // Mevcut timer'ları temizle
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    if (warningTimer) {
      clearTimeout(warningTimer);
    }

    // Token yoksa timer başlatma
    if (!getToken()) {
      return;
    }

    // Warning timer (uyarı vermek için)
    if (onWarning && warningMs < timeoutMs) {
      warningTimer = window.setTimeout(() => {
        const secondsLeft = Math.ceil((timeoutMs - warningMs) / 1000);
        if (onWarning) {
          onWarning(secondsLeft);
        }
      }, timeoutMs - warningMs);
    }

    // Inactivity timer (logout için)
    inactivityTimer = window.setTimeout(() => {
      if (onLogout) {
        onLogout();
      }
    }, timeoutMs);
  }
}

/**
 * Inactivity timeout'u durdur
 */
export function stopInactivityTimeout(): void {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (warningTimer) {
    clearTimeout(warningTimer);
    warningTimer = null;
  }
  onLogout = null;
  onWarning = null;
}

/**
 * Son aktivite zamanını al
 */
export function getLastActivityTime(): number {
  return lastActivityTime;
}

