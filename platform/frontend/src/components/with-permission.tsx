import type { Role } from "@archestra/shared";
import type { ReactNode } from "react";
import { useRole } from "@/lib/auth.hook";

export function WithRole({
  children,
  requiredMinimalRole,
  requiredExactRole,
}: {
  children: ReactNode;
  requiredMinimalRole?: Role;
  requiredExactRole?: Role;
}) {
  const currentRole = useRole();

  if (requiredExactRole && currentRole === requiredExactRole) {
    return children;
  }

  if (requiredMinimalRole) {
    if (currentRole === "admin") {
      return children;
    }
    if (requiredMinimalRole === currentRole) {
      return children;
    }
  }
  return null;
}
