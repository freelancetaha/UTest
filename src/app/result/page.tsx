"use client";
import { useSearchParams } from 'next/navigation';

export default function ResultPage() {
  const searchParams = useSearchParams();
  const score = searchParams.get('score');
  const total = searchParams.get('total');

  return (
    <main style={{ padding: 32 }}>
      <h1>Test Result</h1>
      <p>Your Score: <b>{score}</b> out of <b>{total}</b></p>
      <a href="/practice">Try another test</a>
    </main>
  );
} 