"use client";
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import CharacterForm from '@/components/CharacterForm';
import SignInForm from './(auth)/signin/page';
import SignOutButton from '@/components/SignOutButton';

export default function Home() {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return <div>Loading...</div>; // Or a loading spinner
  }

  if (!user) {
    return <SignInForm />;
  }

  return (
    <main className="container mx-auto p-4">
      <div className="flex justify-end mb-4">
        <SignOutButton />
      </div>
      <CharacterForm />
    </main>
  );
}