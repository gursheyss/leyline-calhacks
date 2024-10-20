import { db } from "@/lib/db";
import { emails } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { cn } from "@/lib/utils";
import { Paperclip, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
            <div className="mb-6 p-4 bg-purple-50 dark:bg-blue-900/30 rounded-lg">
              <h2 className="flex items-center text-lg font-semibold mb-2 text-purple-700 dark:text-blue-300">
                <Sparkles className="h-5 w-5 mr-2" />
                Summary
              </h2>
              <p className="text-sm text-purple-600 dark:text-blue-200">
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

        {emailWithAttachments.processedAttachments &&
          emailWithAttachments.processedAttachments.length > 0 && (
            <div className="mb-4">
              <h2 className="text-lg font-semibold mb-2 dark:text-white">
                Processed Attachments:
              </h2>
              <ul className="space-y-2">
                {emailWithAttachments.processedAttachments.map((url, index) => (
                  <li key={index} className="flex items-center">
                    <Paperclip className="h-4 w-4 mr-2 text-gray-500" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                    >
                      Processed File {index + 1}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
      <div className="flex flex-col space-y-4">
        <div
          className={cn(
            "min-w-64 overflow-hidden rounded-2xl p-4 max-w-64",
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
        <AddContextForm />
      </div>
    </div>
  );
}

const AddContextForm = () => {
  return (
    <div
      className={cn(
        "flex flex-col space-y-2 p-4 rounded-2xl",
        "bg-gray-100 [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05)]",
        "dark:bg-gray-800/50 dark:backdrop-blur-sm dark:[border:1px_solid_rgba(255,255,255,.1)]"
      )}
    >
      <Textarea
        id="context"
        className="min-h-[100px]"
        placeholder="my license plate number is .."
      />
      <Button className="bg-gradient-to-br from-[#A02BE4] via-transparent to-[#4F46E5] flex items-center justify-center gap-2 w-full group">
        <SparkleIcon />
        <span>Add Context</span>
      </Button>
    </div>
  );
};

const SparkleIcon = ({ isAnimated = false }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className="w-4 h-4"
    >
      <defs>
        <style>
          {`
            @keyframes sparkle {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(0.9); }
            }
            .sparkle {
              fill: white;
              transform-origin: center;
            }
            .group:hover .sparkle-1, .sparkle-1.animated { animation: sparkle 1.5s infinite; }
            .group:hover .sparkle-2, .sparkle-2.animated { animation: sparkle 1.5s infinite 0.5s; }
          `}
        </style>
      </defs>
      <path
        d="M384 255.625C384 249.625 380.625 244 375.125 241.25L262.625 184.875L206.25 72.125C200.875 61.25 183.125 61.25 177.75 72.125L121.375 184.875L8.875 241.25C3.375 244 0 249.625 0 255.625C0 261.75 3.375 267.25 8.875 270L121.375 326.375L177.75 439.125C180.375 444.5 185.999 448 192 448C197.999 448 203.625 444.5 206.25 439.125L262.625 326.375L375.125 270C380.625 267.25 384 261.75 384 255.625Z"
        className={`sparkle sparkle-1 ${isAnimated ? "animated" : ""}`}
      />
      <path
        d="M324.375 103.125L384 128L408.875 187.625C410.25 190.25 413 192 416 192S421.75 190.25 423.125 187.625L448 128L507.625 103.125C510.25 101.75 512 99 512 96S510.25 90.25 507.625 88.875L448 64L423.125 4.375C421.75 1.75 419 0 416 0S410.25 1.75 408.875 4.375L384 64L324.375 88.875C321.75 90.25 320 93 320 96S321.75 101.75 324.375 103.125ZM507.625 408.875L448 384L423.125 324.375C421.75 321.75 419 320 416 320S410.25 321.75 408.875 324.375L384 384L324.375 408.875C321.75 410.25 320 413 320 416S321.75 421.75 324.375 423.125L384 448L408.875 507.625C410.25 510.25 413 512 416 512S421.75 510.25 423.125 507.625L448 448L507.625 423.125C510.25 421.75 512 419 512 416S510.25 410.25 507.625 408.875Z"
        className={`sparkle sparkle-2 ${isAnimated ? "animated" : ""}`}
      />
    </svg>
  );
};
