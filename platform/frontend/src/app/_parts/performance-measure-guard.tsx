"use client";

import { useEffect } from "react";

const NEGATIVE_TIMESTAMP_MSG = "negative time stamp";

/**
 * Next.js/React (and some extensions) use the Performance API for dev-only instrumentation.
 * When certain routes redirect immediately, Chrome occasionally reports
 * "Failed to execute 'measure' on 'Performance': '<mark>' cannot have a negative time stamp."
 * This guard swallows those benign errors so they don't crash the UI in development.
 */
export function PerformanceMeasureGuard() {
  useEffect(() => {
    if (
      typeof performance === "undefined" ||
      typeof performance.measure !== "function"
    ) {
      return;
    }

    const originalMeasure = performance.measure.bind(performance);
    const suppressedMarks = new Set<string>();

    const safeMeasure: typeof performance.measure = ((
      markName: string,
      startMarkOrOptions?: string | PerformanceMeasureOptions,
      endMark?: string,
    ) => {
      try {
        return originalMeasure(
          markName,
          startMarkOrOptions as string | PerformanceMeasureOptions | undefined,
          endMark,
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          typeof error.message === "string" &&
          error.message.includes(NEGATIVE_TIMESTAMP_MSG)
        ) {
          if (!suppressedMarks.has(markName)) {
            suppressedMarks.add(markName);
            console.warn(
              `[Archestra] Ignoring benign performance.measure error for "${markName}".`,
              error,
            );
          }
          return undefined as unknown as PerformanceMeasure;
        }
        throw error;
      }
    }) as typeof performance.measure;

    performance.measure = safeMeasure;

    return () => {
      performance.measure = originalMeasure;
    };
  }, []);

  return null;
}
