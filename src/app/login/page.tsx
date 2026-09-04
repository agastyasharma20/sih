import { Suspense } from 'react';
import Link from 'next/link';
import { LoginForm } from '@/components/LoginForm';
import { Brand } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata = { title: 'Sign in · PIEMR Hackathon' };

/**
 * One login page for every role. It carries no role selector and no hint
 * of which tiers exist — the role is resolved server-side after the
 * credentials check and decides only where you land.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden bg-sih-navy lg:block">
        <div className="hero-mesh absolute inset-0 animate-gradient-pan opacity-80" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="[&_p]:!text-white [&_p+p]:!text-piemr-200">
            <Brand />
          </div>
          <div>
            <h2 className="max-w-sm text-3xl font-black leading-tight text-white">
              The internal round that decides PIEMR&apos;s Smart India Hackathon roster.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
              Sign in to register your team, manage your submission, or run the event.
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between">
            <div className="lg:hidden">
              <Brand />
            </div>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>

          <h1 className="mt-8 text-2xl font-bold tracking-tight lg:mt-0">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Use your institutional email address.
          </p>

          <Suspense fallback={<div className="mt-8 h-64" />}>
            <LoginForm />
          </Suspense>

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            <Link href="/" className="hover:text-piemr-600">
              ← Back to the event page
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
