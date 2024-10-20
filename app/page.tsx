import { EmailList } from "@/components/emails";
import { db } from "@/lib/db";
import { emails } from "@/lib/schema";
import { desc } from "drizzle-orm";

export default async function Home() {
  const initialEmailList = await db
    .select()
    .from(emails)
    .orderBy(desc(emails.internalDate))
    .limit(50);

  return <EmailList className="max-w-5xl" initialEmails={initialEmailList} />;
}
