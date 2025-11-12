import type { Role } from "@archestra/shared";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "./clients/auth/auth-client";

const DEFAULT_ROLE: Role = "member";

const fetchActiveMemberRole = async () => {
  try {
    const response = await fetch(
      "/api/auth/organization/get-active-member-role",
      {
        credentials: "include",
      },
    );

    if (!response.ok) {
      const error = new Error(
        `Unable to fetch role (status ${response.status})`,
      );
      console.warn(error.message);
      return DEFAULT_ROLE;
    }

    const data = await response.json();
    return (data.role ?? DEFAULT_ROLE) as Role;
  } catch (error) {
    console.warn("Failed to resolve active member role", error);
    return DEFAULT_ROLE;
  }
};

export function useIsAuthenticated() {
  const session = authClient.useSession();
  return session.data?.user != null;
}

export function useRole() {
  const session = authClient.useSession();
  const sessionRole = session.data?.user?.role as Role | undefined;
  const hasSessionUser = Boolean(session.data?.user);
  const { data: fetchedRole } = useQuery({
    queryKey: ["active-member-role"],
    queryFn: fetchActiveMemberRole,
    enabled: hasSessionUser && !sessionRole,
    staleTime: 5 * 60 * 1000,
  });

  return (sessionRole ?? fetchedRole ?? DEFAULT_ROLE) as Role;
}
