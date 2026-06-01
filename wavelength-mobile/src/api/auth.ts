import client from "./client";

export interface User {
  id: string;
  email: string;
  name: string;
  interests: string[];
  hashtag_includes: string[];
  hashtag_excludes: string[];
  subscription_tier: "free" | "trial" | "pro" | "lifetime";
  subscription_expires_at: string | null;
  email_verified: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const { data } = await client.post<AuthResponse>("/auth/login", { email, password });
  return data;
};

export const register = async (
  email: string,
  name: string,
  password: string
): Promise<AuthResponse> => {
  const { data } = await client.post<AuthResponse>("/auth/register", {
    email,
    name,
    password,
  });
  return data;
};

export const getMe = async (): Promise<User> => {
  const { data } = await client.get<User>("/auth/me");
  return data;
};

export const updateProfile = async (
  updates: Partial<Pick<User, "interests" | "hashtag_includes" | "hashtag_excludes">>
): Promise<User> => {
  const { data } = await client.patch<User>("/auth/profile", updates);
  return data;
};

export const forgotPassword = async (email: string): Promise<void> => {
  await client.post("/auth/forgot-password", { email });
};

export const resetPassword = async (
  email: string,
  otp: string,
  password: string
): Promise<void> => {
  await client.post("/auth/reset-password", { email, otp, password });
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  await client.patch("/auth/password", { currentPassword, newPassword });
};

export const deleteAccount = async (password: string): Promise<void> => {
  await client.delete("/auth/account", { data: { password } });
};

export const sendVerificationEmail = async (): Promise<void> => {
  await client.post("/auth/send-verification");
};

export const verifyEmail = async (otp: string): Promise<void> => {
  await client.post("/auth/verify-email", { otp });
};
