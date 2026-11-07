export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const ACTIVITY_KEY = "finance:lastActivity";

export function watchIdleSession(
  onExpire: () => void,
  onActivity: () => Promise<void>,
) {
  let lastActivity = Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now();
  let lastRenewal = 0;
  let expired = false;
  let expiryTimer: ReturnType<typeof setTimeout>;
  let renewalTimer: ReturnType<typeof setTimeout> | undefined;

  const expire = () => {
    if (expired) return;
    expired = true;
    clearTimeout(expiryTimer);
    clearTimeout(renewalTimer);
    onExpire();
  };
  const scheduleExpiry = () => {
    lastActivity = Math.max(
      lastActivity,
      Number(localStorage.getItem(ACTIVITY_KEY)) || 0,
    );
    clearTimeout(expiryTimer);
    const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);
    if (remaining <= 0) expire();
    else expiryTimer = setTimeout(scheduleExpiry, remaining);
  };
  const renew = () => {
    renewalTimer = undefined;
    if (expired) return;
    lastRenewal = Date.now();
    void onActivity();
  };
  const activity = () => {
    if (expired) return;
    lastActivity = Math.max(
      lastActivity,
      Number(localStorage.getItem(ACTIVITY_KEY)) || 0,
    );
    if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
      expire();
      return;
    }
    if (
      document.visibilityState === "hidden" ||
      Date.now() - lastActivity < 1000
    )
      return;
    lastActivity = Date.now();
    localStorage.setItem(ACTIVITY_KEY, String(lastActivity));
    scheduleExpiry();
    // Send a trailing renewal so the final interaction also extends the cookie.
    if (!renewalTimer)
      renewalTimer = setTimeout(
        renew,
        Math.max(0, 60000 - (Date.now() - lastRenewal)),
      );
  };
  const sync = (event: StorageEvent) => {
    if (event.key !== ACTIVITY_KEY && event.key !== null) return;
    if (!event.newValue) {
      expire();
      return;
    }
    lastActivity = Math.max(lastActivity, Number(event.newValue) || 0);
    scheduleExpiry();
  };
  const events = [
    "pointerdown",
    "pointermove",
    "keydown",
    "scroll",
    "touchstart",
    "focus",
    "visibilitychange",
  ];
  events.forEach((event) =>
    window.addEventListener(event, activity, { passive: true }),
  );
  window.addEventListener("storage", sync);
  scheduleExpiry();
  return () => {
    expired = true;
    clearTimeout(expiryTimer);
    clearTimeout(renewalTimer);
    events.forEach((event) => window.removeEventListener(event, activity));
    window.removeEventListener("storage", sync);
  };
}
