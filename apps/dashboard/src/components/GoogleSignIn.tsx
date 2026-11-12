"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type GoogleIdentity = {
  initialize: (options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => void;
};

export default function GoogleSignIn({
  onCredential,
  disabled = false,
}: {
  onCredential: (credential: string) => Promise<void>;
  disabled?: boolean;
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const busy = useRef(disabled);
  callback.current = onCredential;
  busy.current = disabled;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready || !clientId || !container.current) return;
    const google = (
      window as Window & { google?: { accounts: { id: GoogleIdentity } } }
    ).google;
    if (!google) {
      setFailed(true);
      return;
    }
    google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => {
        if (!busy.current) void callback.current(credential);
      },
    });
    const renderButton = () => {
      if (!container.current) return;
      container.current.replaceChildren();
      google.accounts.id.renderButton(container.current, {
        theme: "outline",
        // Google disables account personalization for medium buttons.
        size: "medium",
        text: "signin_with",
        shape: "pill",
        width: Math.min(container.current.clientWidth, 400),
      });
    };
    renderButton();
    window.addEventListener("resize", renderButton);
    return () => window.removeEventListener("resize", renderButton);
  }, [ready, clientId]);

  if (!clientId || failed) {
    return (
      <p className="text-center text-xs text-gray-500" role="status">
        {failed
          ? "Google sign-in could not load. Use email or reload to try again."
          : "Google sign-in is not available yet. Use email below."}
      </p>
    );
  }
  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onReady={() => setReady(true)}
        onError={() => setFailed(true)}
      />
      {!ready && (
        <p role="status" className="text-center text-sm text-gray-500">
          Loading Google sign-in...
        </p>
      )}
      <div
        ref={container}
        aria-busy={disabled}
        className={`flex min-h-11 min-w-0 w-full justify-center overflow-hidden ${disabled ? "pointer-events-none opacity-50" : ""}`}
      />
    </>
  );
}
