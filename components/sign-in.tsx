"use client";

import { Button } from "@/components/ui/button";
import { useSession, signIn, signOut } from "@/lib/auth-client";
import { SiGoogle } from "@icons-pack/react-simple-icons";
export function SignInButton() {
  const { data: session } = useSession();

  const handleSignIn = async () => {
    await signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  };

  if (session) {
    return (
      <Button
        onClick={async () => {
          await signOut();
        }}
        variant="outline"
        size="sm"
      >
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
