'use client';

import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const SignOutButton = () => {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/"); // Use replace for redirect
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return <Button onClick={handleSignOut}><LogOut/> Sign Out</Button>;
};

export default SignOutButton;