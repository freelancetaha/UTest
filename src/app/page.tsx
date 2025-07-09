"use client";

import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: 32 }}>
      <h1>University of Sindh Entry Test Preparation</h1>
      <p>Welcome! Practice MCQs for your entry test. Select a subject to begin.</p>
      <Link href="/practice">
        <button style={{ marginTop: 24, padding: '12px 24px', fontSize: 18 }}>Start Practicing</button>
      </Link>
      </main>
  );
}
