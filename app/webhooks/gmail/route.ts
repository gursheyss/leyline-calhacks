import { google } from "googleapis";
import { db } from "@/lib/db";
import { emails, emailPayloads, emailAttachments } from "@/lib/schema";

export const POST = async (request: Request) => {
  const { message } = await request.json();

  const decodedData = Buffer.from(message.data, "base64").toString("utf-8");
  const parsedData = JSON.parse(decodedData);

  console.log("Parsed data:", parsedData);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_AUTH_TOKEN,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 1,
  });

  const messageId = res.data.messages?.[0].id;

  if (messageId) {
    const messageDetails = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
    });

    const { id, snippet, internalDate, payload } = messageDetails.data;

    await db.insert(emails).values({
      id: id as string,
      snippet,
      internalDate: new Date(parseInt(internalDate as string)),
    });

    if (payload) {
      await db.insert(emailPayloads).values({
        emailId: id,
        partId: payload.partId || "",
        mimeType: payload.mimeType || "",
        filename: payload.filename || "",
        headers: payload.headers || {},
        body: payload.body || {},
      });

      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.filename && part.body) {
            await db.insert(emailAttachments).values({
              emailId: id,
              attachmentId: part.body.attachmentId || "",
              filename: part.filename,
              mimeType: part.mimeType || "",
              size: part.body.size || 0,
            });
          }
        }
      }
    }

    console.log("Message saved successfully");
    return Response.json({ message: "Message saved successfully" });
  }

  return Response.json({ message: "No new messages found" });
};
