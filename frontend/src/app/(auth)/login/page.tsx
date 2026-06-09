"use client";

import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { useLocale } from "@/providers/LocaleProvider";

export default function LoginPage() {
  const { t } = useLocale();

  return (
    <section className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-normal text-surface-foreground">
          {t("auth.login")}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("auth.signInDescription")}
        </p>
      </div>
      <LoginForm />
      <div className="mt-6">
        <Link
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
          href="/"
        >
          {t("common.backHome")}
        </Link>
      </div>
    </section>
  );
}
