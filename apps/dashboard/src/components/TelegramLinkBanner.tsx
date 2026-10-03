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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-sm text-green-800">
          <span className="font-medium">Telegram connected.</span>{" "}
          <span className="text-green-700">
            This account is linked to Telegram ID {user.telegramId}.
          </span>
        </p>
        <button
          type="button"
          onClick={handleUnlink}
          disabled={submitting}
          className="text-sm font-medium text-green-700 underline hover:text-green-900 disabled:opacity-50"
        >
          {submitting ? "Working..." : "Unlink"}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-amber-900">
            Connect your Telegram account
          </p>
          <p className="mt-1 text-sm text-amber-800">
            This step is optional. Linking your Telegram account lets you use
            the Finance Tracker bot alongside this dashboard, so you can stay on
            top of your wallets wherever you are.{" "}
            {botUsername ? (
              <>
                Search for{" "}
                <code className="rounded bg-amber-100 px-1 font-semibold">
                  @{botUsername}
                </code>{" "}
                in Telegram and send{" "}
                <code className="rounded bg-amber-100 px-1">/wallets</code>{" "}
                &mdash; it replies with your Telegram ID. Enter that ID below to
                finish linking.
              </>
            ) : (
              <>
                Search for the Finance Tracker bot in Telegram and send{" "}
                <code className="rounded bg-amber-100 px-1">/wallets</code>{" "}
                &mdash; it replies with your Telegram ID. Enter that ID below to
                finish linking.
              </>
            )}
          </p>
        </div>

        <form onSubmit={handleLink} className="flex items-center gap-2">
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
            className="w-40 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            disabled={submitting || !value.trim()}
            className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Linking..." : "Link"}
          </button>
        </form>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
