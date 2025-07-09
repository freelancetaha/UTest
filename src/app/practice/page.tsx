"use client";
import Link from 'next/link';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function PracticePage() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'tests'), orderBy('name'));
    const unsub = onSnapshot(q, (snapshot) => {
      setTests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <>
      <SignedIn>
        <main style={{ padding: 32 }}>
          <h1>Practice Tests</h1>
          {loading && <p>Loading...</p>}
          <ul>
            {tests.map((test) => (
              <li key={test.id} style={{ margin: '16px 0' }}>
                <Link href={`/practice/${test.id}`}>{test.name}</Link>
              </li>
            ))}
          </ul>
          {!loading && tests.length === 0 && <p>No tests available. Please contact the admin.</p>}
        </main>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
} 