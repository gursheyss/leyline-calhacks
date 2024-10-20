import { gmail_v1, google } from "googleapis";
import { db } from "@/lib/db";
import { emails, emailPayloads, emailAttachments } from "@/lib/schema";
import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

export const POST = async (request: Request) => {
  const { message } = await request.json();

  const decodedData = Buffer.from(message.data, "base64").toString("utf-8");
  const parsedData = JSON.parse(decodedData);

  console.log("Parsed data:", parsedData);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  try {
    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
      throw new Error("Failed to obtain access token");
    }
    oauth2Client.setCredentials({ access_token: token });
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return Response.json(
      { message: "Error refreshing access token" },
      { status: 500 }
    );
  }

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 1,
  });

  const messageId = res.data.messages?.[0].id;

  if (messageId) {
    try {
      const messageDetails = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
      });

      const { id, snippet, internalDate, payload } = messageDetails.data;

      await db.insert(emails).values({
        id: id as string,
        snippet,
        internalDate: new Date(parseInt(internalDate as string)),
        sender: payload?.headers?.find((header) => header.name === "From")
          ?.value,
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
              let attachmentData = part.body.data || "";

              if (part.body.attachmentId) {
                try {
                  const attachment = await gmail.users.messages.attachments.get(
                    {
                      userId: "me",
                      messageId: id as string,
                      id: part.body.attachmentId,
                    }
                  );

                  if (
                    attachment.data &&
                    typeof attachment.data.data === "string"
                  ) {
                    attachmentData = attachment.data.data;
                  }
                } catch (error) {
                  console.error(
                    `Error fetching attachment ${part.filename}:`,
                    error
                  );
                }
              }

              await db.insert(emailAttachments).values({
                emailId: id as string,
                attachmentId: part.body.attachmentId || "",
                filename: part.filename,
                mimeType: part.mimeType || "",
                size: part.body.size || 0,
                data: attachmentData,
              });
            }
          }
        }
      }

      console.log("Message saved successfully");
      return Response.json(
        { message: "Message saved successfully" },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error saving message:", error);
      return Response.json(
        { message: "Error processing message, but webhook received" },
        { status: 200 }
      );
    }
  }

  return Response.json({ message: "No new messages found" }, { status: 200 });
};
