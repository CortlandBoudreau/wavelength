import client from "./client";

export interface Source {
  name: string;
  url?: string;
  rating?: number;
}

export const fetchSources = async (): Promise<Source[]> => {
  const { data } = await client.get<Source[]>("/sources");
  return data;
};

export const rateSource = async (source: string, rating: number): Promise<void> => {
  await client.post("/sources/rate", { source, rating });
};
