import type { Role } from "@/shared/lib/lists";

/**
 * A swiper is a target user when the role they had at swipe time is in the product's
 * target-role list (spec/03 §5.12). No question is asked. No role means not a target user.
 */
export function isTargetUser(role: Role | undefined, targetRoles: readonly Role[]): boolean {
  return role !== undefined && targetRoles.includes(role);
}
