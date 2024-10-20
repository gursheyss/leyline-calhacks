import { db } from "@/lib/db";
import { emails } from "@/lib/schema";
import { eq } from "drizzle-orm";

export default async function Page({ params }: { params: { id: string } }) {
  const emailWithAttachments = await db.query.emails.findFirst({
    where: eq(emails.id, params.id),
    with: {
      attachments: true,
    },
  });

  if (!emailWithAttachments) {
    return <div>Email not found</div>;
  }

  return (
    <div>
      <h1>{emailWithAttachments.subject}</h1>
      <p>From: {emailWithAttachments.sender}</p>
      <p>Date: {emailWithAttachments.internalDate?.toLocaleString()}</p>
      <h2>Attachments:</h2>
      <ul>
        {emailWithAttachments.attachments.map((attachment) => (
          <li key={attachment.id}>{attachment.filename}</li>
        ))}
      </ul>
    </div>
  );
}
