"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AnimatedList } from "@/components/ui/animated-list";
import { createClient } from "@/utils/supabase/client";
import { emails } from "@/lib/schema";

const Email = ({ snippet, internalDate }: typeof emails.$inferSelect) => {
  const formatDate = (date: Date | null) => {
    if (!date) return "Unknown date";
    return date.toLocaleString();
  };

  return (
    <figure
      className={cn(
        "relative w-full cursor-pointer overflow-hidden rounded-2xl p-4",
        "transition-all duration-200 ease-in-out hover:scale-[103%]",
        "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        "transform-gpu dark:bg-transparent dark:backdrop-blur-md dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]"
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-500">
          <span className="text-lg">📧</span>
        </div>
        <div className="flex flex-col overflow-hidden">
          <figcaption className="flex flex-row items-center whitespace-pre text-lg font-medium dark:text-white">
            <span className="text-sm sm:text-lg">Email</span>
            <span className="mx-1">·</span>
            <span className="text-xs text-gray-500">
              {formatDate(internalDate)}
            </span>
          </figcaption>
          <p className="text-sm font-normal dark:text-white/60">{snippet}</p>
        </div>
      </div>
    </figure>
  );
};

export function EmailList({
  initialEmails,
  className,
}: {
  initialEmails: (typeof emails.$inferSelect)[];
  className?: string;
}) {
  const [emailData, setEmailData] = useState<(typeof emails.$inferSelect)[]>(
    []
  );
  const supabase = createClient();

  useEffect(() => {
    // Set initial emails only once
    setEmailData(initialEmails);

    const subscription = supabase
      .channel("emails_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "emails",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newEmail = payload.new as typeof emails.$inferSelect;
            setEmailData((prevEmails) => [newEmail, ...prevEmails]);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [initialEmails]);

  return (
    <AnimatedList className={className}>
      {emailData.map((email) => (
        <Email key={email.id} {...email} />
      ))}
    </AnimatedList>
  );
}
