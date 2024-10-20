"use server";

import { db } from "@/lib/db";
import { profiles } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function getUserProfile(email: string) {
  try {
    const userProfile = await db.query.profiles.findFirst({
      where: eq(profiles.email, email),
    });
    return userProfile;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}
