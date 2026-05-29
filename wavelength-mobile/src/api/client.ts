import axios from "axios";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api";

const client = axios.create({ baseURL: API_URL });

// Attach Bearer token to every request
client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("token");
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// Surface 4xx/5xx as proper Error objects with the server's message
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverMsg = error?.response?.data?.error;
    if (serverMsg) {
      error.message = serverMsg;
    }
    return Promise.reject(error);
  }
);

export default client;
