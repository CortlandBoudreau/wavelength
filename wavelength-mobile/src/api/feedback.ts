import client from "./client";

export type FeedbackType = "bug" | "feature" | "general";

export const submitFeedback = async (type: FeedbackType, message: string): Promise<void> => {
  await client.post("/feedback", { type, message });
};
