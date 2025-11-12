"use client";

import {
  ApiKeysCard,
  DeleteAccountCard,
  SecuritySettingsCards,
} from "@daveyplate/better-auth-ui";
import { Suspense } from "react";
import { ErrorBoundary } from "@/app/_parts/error-boundary";
import { LoadingSpinner } from "@/components/loading";

export default function AccountSettingsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Account Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your authentication settings, API keys, and user preferences.
            </p>
          </div>

          <div className="space-y-6">
            <SecuritySettingsCards />
            <ApiKeysCard />
            <DeleteAccountCard />
          </div>
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}
