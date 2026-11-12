"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import FinanceIcon from "@/components/FinanceIcon";
import GoogleSignIn from "@/components/GoogleSignIn";

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const createAccount = async (authenticate: () => Promise<void>) => {
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
          : "Registration failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[#f5f6f1] lg:grid-cols-[1fr_1.1fr]">
      <section className="relative flex flex-col overflow-hidden bg-[#18382d] px-7 py-4 text-white sm:px-12 lg:px-16 lg:py-12">
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
            A fresh start.
            <br />A clearer picture.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#b5cbbb]">
            Make room for better money habits. Keep your wallets, spending, and
            plans together from day one.
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

      <section className="flex min-w-0 items-center justify-center px-6 py-6 sm:px-12 lg:py-8">
        <div className="min-w-0 w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">
            Create your account
          </h2>
          <p className="mb-4 mt-2 text-sm leading-6 text-[#737c73]">
            Start building a clearer picture of your money.
          </p>
          {error && (
            <div
              id="register-error"
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          <GoogleSignIn
            disabled={isLoading}
            onCredential={(credential) =>
              createAccount(() => loginWithGoogle(credential))
            }
          />
          <div className="my-4 flex items-center gap-4 text-xs text-[#737c73]">
            <span className="h-px flex-1 bg-[#dfe4d8]" />
            or sign up with email
            <span className="h-px flex-1 bg-[#dfe4d8]" />
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              if (password !== confirmPassword) {
                setError("Passwords do not match");
                return;
              }
              if (password.length < 8) {
                setError("Password must be at least 8 characters");
                return;
              }
              void createAccount(() => register(email, password, name));
            }}
            aria-describedby={error ? "register-error" : undefined}
          >
            <fieldset disabled={isLoading} className="space-y-3">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium"
                >
                  Name{" "}
                  <span className="font-normal text-[#737c73]">(optional)</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="block w-full rounded-xl border border-[#dce1d5] bg-white px-4 py-3 text-sm placeholder:text-[#989f95] focus:border-[#245b45] focus:outline-none focus:ring-2 focus:ring-[#245b45]/15"
                  placeholder="Your name"
                />
              </div>
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
                    autoComplete="new-password"
                    aria-describedby="password-help"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="block w-full rounded-xl border border-[#dce1d5] bg-white py-3 pl-4 pr-16 text-sm placeholder:text-[#989f95] focus:border-[#245b45] focus:outline-none focus:ring-2 focus:ring-[#245b45]/15"
                    placeholder="Create a password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    aria-controls="password confirmPassword"
                    className="absolute inset-y-0 right-1 rounded-lg px-3 text-xs font-medium text-[#245b45]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <p id="password-help" className="mt-1.5 text-xs text-[#737c73]">
                  Use at least 8 characters.
                </p>
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="block w-full rounded-xl border border-[#dce1d5] bg-white px-4 py-3 text-sm placeholder:text-[#989f95] focus:border-[#245b45] focus:outline-none focus:ring-2 focus:ring-[#245b45]/15"
                  placeholder="Enter your password again"
                />
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#245b45] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#194632] disabled:opacity-60"
              >
                {isLoading ? "Creating account..." : "Create account"}
                <FinanceIcon name="arrow" width={17} height={17} />
              </button>
            </fieldset>
          </form>
          <p className="mt-4 text-center text-sm text-[#737c73]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#245b45] underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
