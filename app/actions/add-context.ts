"use server";

import { db } from "@/lib/db";
import { profiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";

export async function addContext(
  email: string,
  currentUserData: Record<string, string>,
  newContext: string
) {
  try {
    const updatedUserData = await generateObject({
      model: groq("llama-3.1-8b-instant"),
      schema: z.record(z.string(), z.string()),
      system: "You are an expert at updating user data based on new context.",
      prompt: `
        Given the following current user data and new context, update the user data appropriately.
        Current user data: ${JSON.stringify(currentUserData)}
        New context: ${newContext}

        Rules:
        1. Add new key-value pairs for new information.
        2. Update existing values if the new context provides more accurate or recent information.
        3. Do not remove any existing key-value pairs.
        4. Use concise keys and values.

        Return the updated user data as a JSON object.
      `,
    });

    await db
      .update(profiles)
      .set({ userData: updatedUserData })
      .where(eq(profiles.email, email));

    return { success: true, updatedUserData };
  } catch (error) {
    console.error("Error updating user data:", error);
    return { success: false, error: "Failed to update user data" };
  }
}
