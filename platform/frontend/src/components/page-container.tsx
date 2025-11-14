import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function PageContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
        className,
      )}
      {...props}
    />
  );
}
