'use client';

import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { app, db, auth } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  if (!app || !db || !auth) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Card className="w-[400px]">
            <CardHeader>
              <CardTitle>Configuration Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Firebase is not configured. Please add your credentials to the .env file.</p>
            </CardContent>
          </Card>
        </div>
      )
  }

  const handleGoogleSignIn = async () => {
    if (!auth || !db) {
      toast({ variant: 'destructive', title: 'Configuration Error', description: 'Firebase is not properly configured.' });
      return;
    }
    const provider = new GoogleAuthProvider();
    setIsSubmitting(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore, if not, create a document
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          email: user.email,
          role: 'viewer'
        });
      }

      toast({ title: 'Signed In with Google', description: 'Redirecting to homepage...' });
      router.push('/');
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
            <CardTitle>Welcome to Brew News</CardTitle>
            <CardDescription>Sign in with your Google account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button variant="outline" onClick={handleGoogleSignIn} className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.5 172.9 60.5l-67 67C314.6 98.4 282.4 80 248 80c-82.6 0-150.2 67.6-150.2 150.2s67.6 150.2 150.2 150.2c90.2 0 131.3-62.7 136.5-95.2H248v-65.4h239.1c1.2 6.5 2.9 12.9 2.9 19.8z"></path></svg>}
            Sign In with Google
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
