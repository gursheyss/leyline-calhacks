"use client";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export default function SignInButton() {
  const [session, setSession] = useState<Session | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "email profile openid https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels",
      },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (session) {
    return (
      <Button onClick={handleSignOut} variant="outline" size="sm">
        Sign out
      </Button>
    );
  }

  return (
    <Button onClick={handleSignIn} variant="outline" size="sm">
      <SiGoogle className="h-4 w-4" />
      Sign in with Google
    </Button>
  );
}
