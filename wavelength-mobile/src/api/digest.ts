import client from "./client";

export const sendDigest = async (): Promise<{ message: string }> => {
  const { data } = await client.post<{ message: string }>("/digest/send");
  return data;
};
