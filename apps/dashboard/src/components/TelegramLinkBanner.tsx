"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { usersApi, telegramApi, ApiError } from "@/lib/api";

export default function TelegramLinkBanner() {
  const { user, refreshUser } = useAuth();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [botUsername, setBotUsername] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    telegramApi
      .bot()
      .then((info) => {
        if (active) setBotUsername(info.username);
      })
      // A missing bot name is not worth surfacing - the banner still works.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!user) return null;

  const linked = Boolean(user.telegramId);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await usersApi.linkTelegram(value.trim());
      setValue("");
      await refreshUser();
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not link Telegram. Is the backend running?",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    setError("");
    setSubmitting(true);

    try {
      await usersApi.unlinkTelegram();
      await refreshUser();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Could not unlink.");
    } finally {
      setSubmitting(false);
    }
  };

  if (linked) {
    return (
      <div className="telegram-link-controls">
        <p className="telegram-account-id">ID {user.telegramId}</p>
        <button
          type="button"
          onClick={handleUnlink}
          disabled={submitting}
          className="telegram-unlink"
        >
          {submitting ? "Working..." : "Unlink"}
        </button>
        {error && (
          <p className="telegram-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="telegram-link-controls">
      <div>
        <div>
          <p className="telegram-link-help">
            Send <code>/wallets</code> to{" "}
            {botUsername ? (
              <>
                <code>@{botUsername}</code>.
              </>
            ) : (
              <>the Finance Tracker bot in Telegram.</>
            )}{" "}
            Enter the returned Telegram ID below.
          </p>
        </div>

        <form onSubmit={handleLink}>
          <label htmlFor="telegramId" className="sr-only">
            Telegram ID
          </label>
          <input
            id="telegramId"
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            placeholder="123456789"
            className="telegram-id-input"
          />
          <button
            type="submit"
            disabled={submitting || !value.trim()}
            className="telegram-link-button"
          >
            {submitting ? "Linking..." : "Link"}
          </button>
        </form>
      </div>

      {error && (
        <p className="telegram-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
