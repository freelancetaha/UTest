"use client";
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { db } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  setDoc
} from 'firebase/firestore';

const COMMON_SUBJECTS = [
  "English",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "General Knowledge",
  "Islamic Studies",
  "Pakistan Studies",
  "Urdu"
];

export default function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const [tests, setTests] = useState<any[]>([]);
  const [testName, setTestName] = useState("");
  const [testTimeLimit, setTestTimeLimit] = useState(30); // default 30 minutes
  const [testMaxScore, setTestMaxScore] = useState(100); // default 100
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState(0);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminVerified, setAdminVerified] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [error, setError] = useState("");
  const [addingSubjects, setAddingSubjects] = useState(false);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [users, setUsers] = useState<any>({});

  // Fetch tests and questions from Firestore
  useEffect(() => {
    const q = query(collection(db, 'tests'), orderBy('name'));
    const unsub = onSnapshot(q, async (snapshot) => {
      const testArr: any[] = [];
      for (const docSnap of snapshot.docs) {
        const testId = docSnap.id;
        const testData = docSnap.data();
        // Fetch questions subcollection
        const questionsSnap = await getDocs(collection(db, 'tests', testId, 'questions'));
        const questions = questionsSnap.docs.map(qd => ({ id: qd.id, ...qd.data() }));
        testArr.push({ id: testId, ...testData, questions });
      }
      setTests(testArr);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch all attempts and users for admin review
  useEffect(() => {
    const q = query(collection(db, 'attempts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, async (snapshot) => {
      setAttempts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    // Fetch all users
    const usersQ = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(usersQ, (snapshot) => {
      const userMap: any = {};
      snapshot.docs.forEach(doc => { userMap[doc.id] = doc.data(); });
      setUsers(userMap);
    });
    return () => { unsub(); unsubUsers(); };
  }, []);

  if (!isLoaded) {
    return null; // Prevent hydration error
  }

  // If not verified as admin, show email prompt
  if (!adminVerified) {
    return (
      <main style={{ padding: 32, maxWidth: 400, margin: '0 auto' }}>
        <h1>Admin Access</h1>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (user && adminEmailInput.trim().toLowerCase() === user.primaryEmailAddress?.emailAddress?.toLowerCase()) {
              setAdminVerified(true);
              setError("");
            } else {
              setError("Email does not match your signed-in account.");
            }
          }}
          className="card"
        >
          <label htmlFor="admin-email">Enter Admin Email:</label>
          <input
            id="admin-email"
            type="email"
            value={adminEmailInput}
            onChange={e => setAdminEmailInput(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 12 }}
          />
          <button type="submit">Verify</button>
          {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        </form>
      </main>
    );
  }

  const handleCreateTest = async () => {
    if (!testName.trim()) return;
    await addDoc(collection(db, 'tests'), { name: testName.trim(), timeLimit: testTimeLimit, maxScore: testMaxScore });
    setTestName("");
    setTestTimeLimit(30);
    setTestMaxScore(100);
  };

  const handleAddCommonSubjects = async () => {
    setAddingSubjects(true);
    for (const subject of COMMON_SUBJECTS) {
      // Only add if not already present
      if (!tests.some(t => t.name.toLowerCase() === subject.toLowerCase())) {
        await addDoc(collection(db, 'tests'), { name: subject });
      }
    }
    setAddingSubjects(false);
  };

  const handleAddQuestion = async () => {
    if (!selectedTest) return;
    if (!question.trim() || options.some(opt => !opt.trim())) return;
    await addDoc(collection(db, 'tests', selectedTest, 'questions'), {
      question,
      options,
      answer
    });
    setQuestion("");
    setOptions(["", "", "", ""]);
    setAnswer(0);
  };

  const handleDeleteTest = async (testId: string, testName?: string) => {
    if (!window.confirm(`Are you sure you want to delete the test "${testName || ''}"? This will remove all its questions permanently.`)) return;
    // Delete all questions in the test
    const questionsSnap = await getDocs(collection(db, 'tests', testId, 'questions'));
    for (const qDoc of questionsSnap.docs) {
      await deleteDoc(doc(db, 'tests', testId, 'questions', qDoc.id));
    }
    // Delete the test itself
    await deleteDoc(doc(db, 'tests', testId));
  };

  const handleDeleteAttempt = async (attemptId: string) => {
    if (!window.confirm('Are you sure you want to delete this attempt? This action cannot be undone.')) return;
    await deleteDoc(doc(db, 'attempts', attemptId));
  };

  return (
    <main style={{ padding: 32, maxWidth: 700, margin: '0 auto' }}>
      <h1>Admin Dashboard</h1>
      <section style={{ marginBottom: 32 }}>
        <h2>Create New Test</h2>
        <input
          type="text"
          placeholder="Test/Subject Name"
          value={testName}
          onChange={e => setTestName(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          type="number"
          min={1}
          max={180}
          value={testTimeLimit}
          onChange={e => setTestTimeLimit(Number(e.target.value))}
          style={{ width: 80, marginRight: 8 }}
          placeholder="Time (min)"
        />
        <input
          type="number"
          min={1}
          max={1000}
          value={testMaxScore}
          onChange={e => setTestMaxScore(Number(e.target.value))}
          style={{ width: 100, marginRight: 8 }}
          placeholder="Max Score"
        />
        <button onClick={handleCreateTest}>Create Test</button>
        <button onClick={handleAddCommonSubjects} style={{ marginLeft: 16 }} disabled={addingSubjects}>
          {addingSubjects ? 'Adding Subjects...' : 'Add Common University Subjects'}
        </button>
      </section>
      <section style={{ marginBottom: 32 }}>
        <h2>Add Question to Test</h2>
        <select value={selectedTest ?? ''} onChange={e => setSelectedTest(e.target.value === '' ? null : e.target.value)}>
          <option value="">Select Test</option>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {selectedTest !== null && (
          <div style={{ marginTop: 16 }}>
            <input
              type="text"
              placeholder="Question"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              style={{ width: '100%', marginBottom: 8 }}
            />
            {options.map((opt, idx) => (
              <div key={idx} style={{ marginBottom: 4 }}>
                <input
                  type="text"
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={e => {
                    const newOpts = [...options];
                    newOpts[idx] = e.target.value;
                    setOptions(newOpts);
                  }}
                  style={{ marginRight: 8 }}
                />
                <label>
                  <input
                    type="radio"
                    name="answer"
                    checked={answer === idx}
                    onChange={() => setAnswer(idx)}
                  /> Correct
                </label>
              </div>
            ))}
            <button onClick={handleAddQuestion} style={{ marginTop: 8 }}>Add Question</button>
          </div>
        )}
      </section>
      <section>
        <h2>All Tests & Questions</h2>
        {loading && <p>Loading...</p>}
        {tests.length === 0 && !loading && <p>No tests created yet.</p>}
        {tests.map((t) => (
          <div key={t.id} style={{ marginBottom: 24, border: '1px solid #eee', padding: 16, borderRadius: 8 }}>
            <h3>{t.name}</h3>
            <div style={{ color: '#888', fontSize: 14, marginBottom: 8 }}>Time: {t.timeLimit} min | Max Score: {t.maxScore ?? t.questions.length}</div>
            <button onClick={() => handleDeleteTest(t.id, t.name)} style={{ background: '#ef4444', color: '#fff', marginBottom: 12, borderRadius: 6, padding: '6px 16px', border: 'none', cursor: 'pointer' }}>Delete Test</button>
            {t.questions.length === 0 && <p>No questions yet.</p>}
            <ol>
              {t.questions.map((q: any, qidx: number) => (
                <li key={q.id} style={{ marginBottom: 8 }}>
                  <b>{q.question}</b>
                  <ul>
                    {q.options.map((opt: string, oidx: number) => (
                      <li key={oidx} style={{ color: q.answer === oidx ? 'green' : undefined }}>{opt}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>
      <section>
        <h2 style={{ color: '#2563eb', marginBottom: 20 }}>All User Attempts</h2>
        {attempts.length === 0 && <p>No attempts yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {attempts.map((a) => (
          <div key={a.id} className="card" style={{ marginBottom: 0, boxShadow: '0 2px 12px rgba(37,99,235,0.08)', border: '1px solid #e0e7ef', borderRadius: 16, padding: 24 }}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 18, color: '#2563eb' }}>{users[a.userId]?.name || a.userId}</div>
                <div style={{ color: '#888', fontSize: 14 }}>{users[a.userId]?.email || ''}</div>
                <div style={{ color: '#888', fontSize: 14, marginTop: 2 }}>Test: <b>{a.testName}</b></div>
                <div style={{ color: '#888', fontSize: 14, marginTop: 2 }}>Attempted: {a.timestamp?.toDate?.().toLocaleString?.() || ''}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ background: '#e0e7ef', color: '#2563eb', borderRadius: 8, padding: '4px 12px', fontWeight: 600, fontSize: 15 }}>Auto Score: {a.score} / {a.maxScore ?? a.total}</span>
                <span style={{ background: '#f3f4f6', color: '#1d4ed8', borderRadius: 8, padding: '4px 12px', fontWeight: 600, fontSize: 15 }}>Admin Score: {typeof a.adminScore === 'number' ? `${a.adminScore} / ${a.maxScore ?? a.total}` : 'Not set'}</span>
              </div>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const adminScore = Number((form.elements.namedItem('adminScore') as HTMLInputElement).value);
              if (!isNaN(adminScore)) {
                await setDoc(doc(db, 'attempts', a.id), { ...a, adminScore }, { merge: true });
              }
            }} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                name="adminScore"
                min={0}
                max={a.maxScore ?? a.total}
                defaultValue={a.adminScore ?? ''}
                placeholder="Admin Score"
                style={{ width: 100, borderRadius: 8, border: '1px solid #d1d5db', padding: '8px 12px', fontSize: 15 }}
              />
              <button type="submit" style={{ background: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 15, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.08)' }}>Set Admin Score</button>
            </form>
            <div style={{ marginTop: 18 }}>
              <b style={{ color: '#2563eb' }}>Answers:</b>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {a.answers && a.answers.map((ans: number|null, idx: number) => {
                  const q = questionsForTest(a.testName, tests)[idx];
                  const isCorrect = ans !== null && q && q.answer === ans;
                  return (
                    <li key={idx} style={{ marginBottom: 12, background: isCorrect ? '#e0fce0' : '#fee2e2', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontWeight: 600, color: isCorrect ? '#059669' : '#dc2626' }}>Q{idx+1}: {q?.question || ''}</div>
                      <div style={{ color: '#222', marginTop: 2 }}>Your answer: <b>{typeof ans === 'number' ? q?.options[ans] : 'No answer'}</b></div>
                      <div style={{ color: '#888', marginTop: 2 }}>Correct answer: <b>{typeof q?.answer === 'number' ? q?.options[q?.answer] : ''}</b></div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        ))}
        </div>
      </section>
    </main>
  );
}

// Helper to get questions for a test by ID
function questionsForTest(testId: string, tests: any[]) {
  const t = tests.find(t => t.id === testId);
  return t?.questions || [];
} 