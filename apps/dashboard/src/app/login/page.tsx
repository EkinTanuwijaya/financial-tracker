"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import FinanceIcon from "@/components/FinanceIcon";
import GoogleSignIn from "@/components/GoogleSignIn";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const signIn = async (authenticate: () => Promise<void>) => {
    setError("");
    setIsLoading(true);
    try {
      await authenticate();
      router.replace("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[#f5f6f1] lg:grid-cols-[1fr_1.1fr]">
      <section className="relative flex flex-col overflow-hidden bg-[#18382d] px-7 py-8 text-white sm:px-12 lg:px-16 lg:py-12">
        <Link
          href="/"
          className="flex w-fit items-center gap-3 text-2xl font-semibold tracking-tight"
        >
          <span className="brand-mark">
            <FinanceIcon name="reports" />
          </span>
          Finance<span className="sr-only"> Tracker home</span>
        </Link>
        <div className="mx-auto hidden w-full max-w-md py-10 lg:my-auto lg:block lg:py-16">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-[#c0d9ac]">
            A little more clarity.
          </p>
          <h1 className="text-4xl font-medium leading-[1.15] tracking-tight sm:text-5xl">
            Your money.
            <br />A clearer picture.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#b5cbbb]">
            Bring your wallets, everyday spending, and bigger goals into one
            calm space.
          </p>
          <div className="mt-10 hidden rounded-2xl border border-white/15 bg-white/[0.06] p-6 sm:block">
            <div className="flex items-center justify-between text-xs text-[#b5cbbb]">
              <span>Your financial picture</span>
              <FinanceIcon name="spark" className="text-[#d5edac]" />
            </div>
            <p className="mt-5 text-xl font-medium tracking-tight">
              Small habits. Steady progress.
            </p>
            <div className="mt-7 flex h-20 items-end gap-3" aria-hidden="true">
              {[30, 45, 38, 60, 52, 75, 90].map((height, index) => (
                <span
                  key={index}
                  className={`flex-1 rounded-t-md ${index === 6 ? "bg-[#d5edac]" : "bg-[#89ad83]/40"}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <p className="mt-4 text-xs text-[#b5cbbb]">
              Track today. Plan for tomorrow.
            </p>
          </div>
        </div>
        <p className="hidden text-xs text-[#9bb3a4] lg:block">
          Less guesswork. More peace of mind.
        </p>
      </section>

      <section className="flex min-w-0 items-center justify-center px-6 py-12 sm:px-12 lg:py-16">
        <div className="min-w-0 w-full max-w-sm">
          <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#dce4d5] bg-[#eaf0df] text-[#245b45]">
            <FinanceIcon name="wallet" width={24} height={24} />
          </span>
          <h2 className="text-3xl font-semibold tracking-tight">
            Welcome back
          </h2>
          <p className="mb-8 mt-3 text-sm leading-6 text-[#737c73]">
            Sign in for a little more clarity on your money.
          </p>
          {error && (
            <div
              id="login-error"
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          <GoogleSignIn
            disabled={isLoading}
            onCredential={(credential) =>
              signIn(() => loginWithGoogle(credential))
            }
          />
          <div className="my-6 flex items-center gap-4 text-xs text-[#737c73]">
            <span className="h-px flex-1 bg-[#dfe4d8]" />
            or sign in with email
            <span className="h-px flex-1 bg-[#dfe4d8]" />
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void signIn(() => login(email, password));
            }}
            aria-describedby={error ? "login-error" : undefined}
          >
            <fieldset disabled={isLoading} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="block w-full rounded-xl border border-[#dce1d5] bg-white px-4 py-3 text-sm placeholder:text-[#989f95] focus:border-[#245b45] focus:outline-none focus:ring-2 focus:ring-[#245b45]/15"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="block w-full rounded-xl border border-[#dce1d5] bg-white py-3 pl-4 pr-16 text-sm placeholder:text-[#989f95] focus:border-[#245b45] focus:outline-none focus:ring-2 focus:ring-[#245b45]/15"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-1 rounded-lg px-3 text-xs font-medium text-[#245b45]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#245b45] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#194632] disabled:opacity-60"
              >
                {isLoading ? "Signing in..." : "Sign in"}
                <FinanceIcon name="arrow" width={17} height={17} />
              </button>
            </fieldset>
          </form>
          <p className="mt-7 text-center text-sm text-[#737c73]">
            New here?{" "}
            <Link
              href="/register"
              className="font-semibold text-[#245b45] underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </p>
          <p className="mt-10 border-t border-[#dfe4d8] pt-6 text-center text-xs leading-5 text-[#737c73]">
            Your next chapter starts with a clearer picture.
          </p>
        </div>
      </section>
    </main>
  );
}
