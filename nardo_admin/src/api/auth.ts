import { apiRequest } from "./http";

export type AdminMe = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_emoji?: string | null;
  is_super?: boolean;
};

export async function fetchMe(): Promise<AdminMe> {
  return await apiRequest<AdminMe>("GET", "/api/auth/me");
}
