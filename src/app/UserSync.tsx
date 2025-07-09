"use client";
import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { db } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function UserSync() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;
    const syncUser = async () => {
      const userRef = doc(db, 'users', user.id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          id: user.id,
          name: user.fullName || '',
          email: user.primaryEmailAddress?.emailAddress || '',
          imageUrl: user.imageUrl || '',
          createdAt: new Date().toISOString(),
        });
      }
    };
    syncUser();
  }, [user, isLoaded]);

  return null;
} 