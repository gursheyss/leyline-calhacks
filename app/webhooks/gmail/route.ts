import { gmail_v1, google } from "googleapis";
import { db } from "@/lib/db";
import {
  emails,
  emailPayloads,
  emailAttachments,
  emailActions,
  profiles,
} from "@/lib/schema";
import { groq } from "@ai-sdk/groq";
import { generateObject, generateText, tool } from "ai";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { PDFDocument, PDFTextField } from "pdf-lib";
import { createClient } from "@/utils/supabase/server";

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

  const receiverHeader =
    payload.headers?.find((header) => header.name === "To")?.value || "";
  const receiverEmail =
    receiverHeader.match(/[^<\s]+(?=>)/)?.[0] || receiverHeader;

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
      Focus on the main points, key information, and especially any action points or required responses in the email.
      `,
      prompt: `
      Email subject: ${subject}
      Email body: ${messageText}
      Attachments: ${attachments
        .map((a) => `${a.filename} (ID: ${a.attachmentId})`)
        .join(", ")}
      Please provide a concise summary of this email in 1-2 sentences, highlighting any action points or required responses.
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
          execute: async ({ attachmentId }) => {
            const attachment = attachments.find(
              (a) => a.attachmentId === attachmentId
            );

            if (attachment && attachment.mimeType === "application/pdf") {
              try {
                console.log("Trying to fill form");
                const userData = await db
                  .select({
                    userData: profiles.userData,
                  })
                  .from(profiles)
                  .where(eq(profiles.email, receiverEmail));

                const pdfBuffer = Buffer.from(attachment.data, "base64");
                const pdfDoc = await PDFDocument.load(pdfBuffer);

                const form = pdfDoc.getForm();
                const fields = form.getFields();

                const fieldInfo = fields.map((field) => {
                  if (field instanceof PDFTextField) {
                    return {
                      name: field.getName(),
                      maxLength: field.getMaxLength(),
                    };
                  }
                  return { name: field.getName() };
                });

                const fieldMappings = await generateObject({
                  model: groq("llama-3.1-8b-instant"),
                  schema: z.object({
                    mappings: z.record(z.string(), z.string()),
                  }),
                  system:
                    "You are an expert at mapping user data to form fields.",
                  prompt: `
                    Given the following user data and form fields, create a mapping of form field names to user data properties.
                    Use the most appropriate user data for each form field.
                    
                    This is the user data you are supposed to map: ${JSON.stringify(
                      userData[0]
                    )}
                    
                    These are the form fields you are supposed to map to, including their maximum lengths where applicable: 
                    ${JSON.stringify(fieldInfo)}

                    Your job is to construct and return a JSON object where the keys are from the form fields and the values are the mappings from the user data.
                    Take into account the maximum length constraints when suggesting mappings.
                  `,
                });

                if (!fieldMappings.object) {
                  throw new Error("Failed to generate field mappings");
                }

                console.log("field mappings", fieldMappings.object.mappings);
                console.log("user data", userData[0]);

                for (const [fieldName, userDataProp] of Object.entries(
                  fieldMappings.object.mappings
                )) {
                  const field = form.getField(fieldName);
                  if (field instanceof PDFTextField) {
                    const maxLength = field.getMaxLength();
                    let value =
                      userData[0].userData[userDataProp as string] || "";

                    if (maxLength !== undefined && value.length > maxLength) {
                      value = value.substring(0, maxLength);
                    }

                    field.setText(value);
                  }
                }

                console.log("Saving filled PDF");
                const pdfBytes = await pdfDoc.save();
                const fileName = `filled_${attachment.filename}`;

                console.log("Creating Supabase client");
                const supabaseClient = createClient();

                console.log("Uploading to Supabase");
                const { data, error } = await supabaseClient.storage
                  .from("forms")
                  .upload(fileName, pdfBytes, {
                    contentType: "application/pdf",
                    upsert: true,
                  });

                if (error) {
                  console.error("Error uploading to Supabase:", error);
                  return `Error saving filled form: ${error.message}`;
                }

                console.log("Upload successful, data:", data);

                console.log("Getting public URL");
                const {
                  data: { publicUrl },
                } = supabaseClient.storage.from("forms").getPublicUrl(fileName);

                console.log("Filled form public URL:", publicUrl);
                return `Form filled and saved. URL: ${publicUrl}`;
              } catch (error) {
                console.error("Error processing PDF attachment:", error);
                return `Error processing PDF attachment: ${error.message}`;
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
    await db
      .update(emails)
      .set({
        status: "stale",
      })
      .where(eq(emails.id, id));
  }
};
