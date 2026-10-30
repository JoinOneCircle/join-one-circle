/** A navigation preference only. Never use this value to grant record access. */
export function pilotSignupRole(value: unknown): "school" | "family" | undefined {
  return value === "school" || value === "family" ? value : undefined;
}

export function signupRoleForDestination(destination: string, requestedRole: unknown) {
  return destination.startsWith("/invite/") ? "family" as const : pilotSignupRole(requestedRole);
}
