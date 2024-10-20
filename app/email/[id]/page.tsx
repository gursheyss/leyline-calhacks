import { db } from "@/lib/db";
import { emails } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { cn } from "@/lib/utils";
import { Paperclip, Sparkles } from "lucide-react";

export default async function Page({ params }: { params: { id: string } }) {
  const emailWithAttachments = await db.query.emails.findFirst({
    where: eq(emails.id, params.id),
    with: {
      attachments: true,
      actions: true,
    },
  });

  if (!emailWithAttachments) {
    return <div>Email not found</div>;
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Unknown date";
    const dateObject = new Date(date);
    return dateObject.toLocaleString();
  };

  return (
    <div className="flex flex-row gap-6 p-6 w-full max-w-5xl">
      <div
        className={cn(
          "flex-grow overflow-hidden rounded-2xl p-6",
          "bg-gray-50 [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
          "dark:bg-transparent dark:backdrop-blur-md dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]"
        )}
      >
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-2 dark:text-white">
            {emailWithAttachments.subject}
          </h1>
          <p className="text-sm text-gray-600 dark:text-white/60">
            From: {emailWithAttachments.sender}
          </p>
          <p className="text-sm text-gray-600 dark:text-white/60">
            Date: {formatDate(emailWithAttachments.internalDate)}
          </p>
        </div>
        <div className="mb-4">
          {emailWithAttachments.summary && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <h2 className="flex items-center text-lg font-semibold mb-2 text-blue-700 dark:text-blue-300">
                <Sparkles className="h-5 w-5 mr-2" />
                Summary
              </h2>
              <p className="text-sm text-blue-600 dark:text-blue-200">
                {emailWithAttachments.summary}
              </p>
            </div>
          )}
          <p className="text-gray-800 dark:text-white/80">
            {emailWithAttachments.messageText}
          </p>
        </div>
        {emailWithAttachments.attachments.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2 dark:text-white">
              Attachments:
            </h2>
            <ul className="space-y-2">
              {emailWithAttachments.attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center">
                  <Paperclip className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-white/70">
                    {attachment.filename}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div
        className={cn(
          "min-w-64 overflow-hidden rounded-2xl p-4",
          "bg-gray-100 [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05)]",
          "dark:bg-gray-800/50 dark:backdrop-blur-sm dark:[border:1px_solid_rgba(255,255,255,.1)]"
        )}
      >
        <h2 className="text-lg font-semibold mb-4 dark:text-white">
          Action Log
        </h2>
        <ul className="space-y-2">
          {emailWithAttachments.actions.map((action) => (
            <li
              key={action.id}
              className="text-sm text-gray-700 dark:text-white/70"
            >
              {action.action}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
