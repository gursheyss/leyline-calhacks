import { google } from "googleapis";

export const POST = async (request: Request) => {
  const { message } = await request.json();

  const decodedData = Buffer.from(message.data, "base64").toString("utf-8");
  const parsedData = JSON.parse(decodedData);

  console.log("Parsed data:", parsedData);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: process.env.GMAIL_ACCESS_TOKEN,
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

    console.log("Message content:", messageDetails.data);
    return Response.json({ message: "Message retrieved successfully" });
  }

  return Response.json({ message: "No new messages found" });
};
