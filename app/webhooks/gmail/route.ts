import { gmail_v1, google } from "googleapis";
import { db } from "@/lib/db";
import {
  emails,
  emailPayloads,
  emailAttachments,
  emailActions,
} from "@/lib/schema";
import { groq } from "@ai-sdk/groq";
import { generateText, tool } from "ai";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";

export const POST = async () => {
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
        format: "full",
      });

      const { id, snippet, internalDate, payload } = messageDetails.data;

      const decodeBase64 = (data: string) =>
        Buffer.from(data, "base64").toString("utf-8");

      const extractText = (part: gmail_v1.Schema$MessagePart): string => {
        if (part.mimeType === "text/plain" && part.body?.data) {
          return decodeBase64(part.body.data);
        }
        if (part.parts) {
          return part.parts.map(extractText).join("\n");
        }
        return "";
      };

      const messageText = payload ? extractText(payload) : "";

      await db.insert(emails).values({
        id: id as string,
        snippet,
        internalDate: new Date(parseInt(internalDate as string)),
        sender: payload?.headers?.find((header) => header.name === "From")
          ?.value,
        subject: payload?.headers?.find((header) => header.name === "Subject")
          ?.value,
        messageText: messageText,
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
                    part.body.data = attachmentData;
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

      if (payload && id) {
        determineCOA(payload, id);
      }

      return Response.json(
        { message: "Message saved successfully" },
        { status: 200 }
      );
    } catch (error) {
      return Response.json(
        { message: "Error processing message, but webhook received" },
        { status: 200 }
      );
    }
  }

  return Response.json({ message: "No new messages found" }, { status: 200 });
};

const determineCOA = async (
  payload: gmail_v1.Schema$MessagePart,
  id: string
) => {
  const subject =
    payload.headers?.find((header) => header.name === "Subject")?.value || "";

  const extractText = (part: gmail_v1.Schema$MessagePart): string => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.parts) {
      return part.parts.map(extractText).join("\n");
    }
    return "";
  };

  const messageText = extractText(payload);

  const attachments =
    payload.parts
      ?.filter((part) => part.filename && part.body)
      .map((part) => ({
        filename: part.filename || "",
        mimeType: part.mimeType || "",
        data: part.body?.data || "",
        attachmentId: part.body?.attachmentId || "",
      })) || [];

  await db
    .update(emails)
    .set({
      status: "processing",
    })
    .where(eq(emails.id, id));

  try {
    const summaryResult = await generateText({
      model: groq("llama-3.1-70b-versatile"),
      system: `
      You are an email summarizer. Your task is to provide a concise summary of the email content in 1-2 sentences.
      Focus on the main points and key information in the email.
      `,
      prompt: `
      Email subject: ${subject}
      Email body: ${messageText}
      Attachments: ${attachments
        .map((a) => `${a.filename} (ID: ${a.attachmentId})`)
        .join(", ")}
      Please provide a concise summary of this email in 1-2 sentences.
      `,
    });

    await generateText({
      model: groq("llama-3.1-70b-versatile"),
      tools: {
        fillOutForm: tool({
          description: "Fill out a form based on an email attachment",
          parameters: z.object({
            attachmentId: z
              .string()
              .describe("The ID of the attachment containing the form"),
            formFields: z
              .array(z.string())
              .describe("List of form fields to fill out"),
          }),
          execute: async ({ attachmentId, formFields }) => {
            const attachment = attachments.find(
              (a) => a.attachmentId === attachmentId
            );

            if (attachment && attachment.mimeType === "application/pdf") {
              try {
                const pdfBuffer = Buffer.from(attachment.data, "base64");
                const pdfDoc = await PDFDocument.load(pdfBuffer);

                const form = pdfDoc.getForm();
                const fields = form.getFields();

                const extractedFields = fields.map((field) => field.getName());

                return `Extracted fields: ${extractedFields.join(", ")}`;
              } catch (error) {
                console.error("Error parsing PDF:", error);
                return "Error parsing PDF attachment";
              }
            } else {
              return "Attachment not found or not a PDF";
            }
          },
        }),
      },
      maxSteps: 2,
      system: `
      You are an email assistant that decides which action to take based on the email content.
      If the email content contains a form, or contains a file that references a form or needing to fill it out, use the fillOutForm tool.
      If no specific action is needed or if there's no valid tool to call, strictly return a brief description of why no action is needed.
      Never use brave_search or the internet.
      `,
      prompt: `
      Email subject: ${subject}
      Email body: ${messageText}
      Attachments: ${attachments
        .map((a) => `${a.filename} (ID: ${a.attachmentId})`)
        .join(", ")}
      From this email, determine which action to take.
      If the email doesn't need any specific action or if there's no valid tool to call, provide a brief explanation of why no action is needed.
      `,
      toolChoice: "auto",
      async onStepFinish({ text }) {
        await db
          .insert(emailActions)
          .values({
            emailId: id,
            action: [text],
          })
          .onConflictDoUpdate({
            target: emailActions.emailId,
            set: {
              action: sql`array_append(${emailActions.action}, ${text})`,
            },
          });
      },
    });

    await db
      .update(emails)
      .set({
        status: "done",
        summary: summaryResult.text,
      })
      .where(eq(emails.id, id));
  } catch (error) {
    console.error("Error processing email:", error);

    await db
      .update(emails)
      .set({
        status: "stale",
      })
      .where(eq(emails.id, id));
  }
};
