import { apiClient } from "./client";

interface LoginResponse {
  token: string;
}

/** POST /login (spec 4.2 §5). Resolves to the raw JWT; throws ApiError on failure. */
export const login = async (email: string, password: string): Promise<string> => {
  const response = await apiClient.post<LoginResponse>("/login", { email, password });
  return response.data.token;
};
