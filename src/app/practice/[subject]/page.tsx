"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { SignedIn, SignedOut, RedirectToSignIn, useUser } from '@clerk/nextjs';
import { db } from '@/firebase';
import { addDoc, collection, serverTimestamp, onSnapshot, query, orderBy, doc, getDoc, where, getDocs } from 'firebase/firestore';

export default function SubjectPracticePage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoaded } = useUser();
  const testId = params.subject as string;
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number|null)[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [testName, setTestName] = useState('');
  const [testMaxScore, setTestMaxScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch questions and test time limit
  useEffect(() => {
    if (!testId) return;
    setLoading(true);
    const testDocRef = doc(db, 'tests', testId);
    getDoc(testDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTestName(data.name || '');
        setTimeLeft(data.timeLimit ? data.timeLimit * 60 : 30 * 60); // default 30 min
        setTestMaxScore(typeof data.maxScore === 'number' ? data.maxScore : null);
      }
    });
    const q = query(collection(db, 'tests', testId, 'questions'), orderBy('question'));
    const unsub = onSnapshot(q, (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [testId]);

  // Check if user already attempted this test
  useEffect(() => {
    if (!user || !testId) return;
    const checkAttempt = async () => {
      const q = query(collection(db, 'attempts'), where('userId', '==', user.id), where('testName', '==', testId));
      const snap = await getDocs(q);
      if (!snap.empty) setAlreadyAttempted(true);
    };
    checkAttempt();
  }, [user, testId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || submitting) return;
    if (timeLeft <= 0) {
      handleAutoSubmit();
      return;
    }
    timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timerRef.current!);
  }, [timeLeft, submitting]);

  // Prevent hydration error
  if (!isLoaded || loading) {
    return null;
  }

  if (alreadyAttempted) {
    return <main style={{ padding: 32 }}><h2>You have already taken this test. You cannot attempt it again.</h2></main>;
  }

  if (!questions.length) {
    return <main style={{ padding: 32 }}><h2>No questions found for this test.</h2></main>;
  }

  const handleNext = async () => {
    const newAnswers = [...answers];
    newAnswers[current] = selected;
    setAnswers(newAnswers);
    if (selected === questions[current].answer) {
      setScore(score + 1);
    }
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      setSelected(null);
    } else {
      await handleSubmit(newAnswers);
    }
  };

  const handleSubmit = async (finalAnswers: (number|null)[] = answers) => {
    setSubmitting(true);
    if (user) {
      if (!testMaxScore) {
        alert('This test does not have a max score set. Please contact the admin.');
        setSubmitting(false);
        return;
      }
      await addDoc(collection(db, 'attempts'), {
        userId: user.id,
        testName: testId,
        score: score + (selected === questions[current].answer ? 1 : 0),
        total: questions.length,
        maxScore: testMaxScore,
        answers: finalAnswers,
        timestamp: serverTimestamp(),
      });
    }
    router.push(`/result?score=${score + (selected === questions[current].answer ? 1 : 0)}&total=${questions.length}`);
  };

  const handleAutoSubmit = async () => {
    if (!submitting) {
      const newAnswers = [...answers];
      newAnswers[current] = selected;
      setAnswers(newAnswers);
      setSubmitting(true);
      if (user) {
        if (!testMaxScore) {
          alert('This test does not have a max score set. Please contact the admin.');
          setSubmitting(false);
          return;
        }
        await addDoc(collection(db, 'attempts'), {
          userId: user.id,
          testName: testId,
          score: score + (selected === questions[current].answer ? 1 : 0),
          total: questions.length,
          maxScore: testMaxScore,
          answers: newAnswers,
          timestamp: serverTimestamp(),
        });
      }
      router.push(`/result?score=${score + (selected === questions[current].answer ? 1 : 0)}&total=${questions.length}&timeout=1`);
    }
  };

  const q = questions[current];

  // Format time mm:ss
  const formatTime = (sec: number | null) => {
    if (sec === null) return '--:--';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <SignedIn>
        <main style={{ padding: 32 }}>
          <h2>{testName} Test</h2>
          <div style={{ fontWeight: 'bold', color: timeLeft !== null && timeLeft < 60 ? 'red' : '#2563eb', fontSize: 20, marginBottom: 16 }}>
            Time Left: {formatTime(timeLeft)}
          </div>
          <h3>Question {current + 1} of {questions.length}</h3>
          <p style={{ fontWeight: 'bold' }}>{q.question}</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {q.options.map((opt: string, idx: number) => (
              <li key={idx} style={{ margin: '8px 0' }}>
                <label>
                  <input
                    type="radio"
                    name="option"
                    checked={selected === idx}
                    onChange={() => setSelected(idx)}
                    disabled={submitting || timeLeft === 0}
                  />{' '}
                  {opt}
                </label>
              </li>
            ))}
          </ul>
          <button onClick={handleNext} disabled={selected === null || submitting || timeLeft === 0} style={{ marginTop: 16 }}>
            {current + 1 === questions.length ? 'Finish' : 'Next'}
          </button>
          {timeLeft === 0 && <div style={{ color: 'red', marginTop: 16 }}>Time is up! Your test is being submitted.</div>}
        </main>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
} 