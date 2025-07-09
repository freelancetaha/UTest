"use client";
import { useEffect, useState, useRef } from 'react';
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { collection as fsCollection, query as fsQuery, where as fsWhere, orderBy as fsOrderBy, onSnapshot as fsOnSnapshot } from 'firebase/firestore';
import { storage } from '../../firebase';
import { ref as storageRef, deleteObject } from 'firebase/storage';

export default function UserDashboard() {
  const { user, isLoaded } = useUser();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newsPosts, setNewsPosts] = useState<any[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    // Fetch attempts
    const q = query(
      collection(db, 'attempts'),
      where('userId', '==', user.id),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setAttempts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching attempts:', error);
      setLoading(false);
    });
    // Fetch user's news posts
    const newsQ = fsQuery(
      fsCollection(db, 'news'),
      fsWhere('author', '==', user.fullName || user.primaryEmailAddress?.emailAddress || 'User'),
      fsOrderBy('timestamp', 'desc')
    );
    const unsubNews = fsOnSnapshot(newsQ, (snapshot) => {
      setNewsPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    // Fetch followers count
    const followersCol = collection(db, 'users', user.id, 'followers');
    const unsubFollowers = onSnapshot(followersCol, (snapshot) => {
      setFollowersCount(snapshot.size);
    });
    return () => {
      unsub();
      unsubNews();
      unsubFollowers();
    };
  }, [user]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    if (menuOpenId) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId]);

  const startEdit = (post: any) => {
    setEditingPostId(post.id);
    setEditTitle(post.title);
    setEditContent(post.content);
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setEditTitle("");
    setEditContent("");
  };

  const saveEdit = async (post: any) => {
    setEditLoading(true);
    try {
      await updateDoc(doc(db, 'news', post.id), {
        title: editTitle,
        content: editContent,
      });
      setEditingPostId(null);
    } catch (err) {
      alert('Failed to update post.');
    }
    setEditLoading(false);
  };

  const deletePost = async (post: any) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    setDeleteLoading(post.id);
    try {
      await deleteDoc(doc(db, 'news', post.id));
      if (post.mediaUrl) {
        const mediaRef = storageRef(storage, post.mediaUrl);
        try { await deleteObject(mediaRef); } catch {}
      }
    } catch (err) {
      alert('Failed to delete post.');
    }
    setDeleteLoading(null);
  };

  if (!isLoaded) {
    return null; // Prevent hydration error
  }

  if (loading) {
    return (
      <main style={{ padding: 32, maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="spinner" style={{ width: 48, height: 48, border: '6px solid #e0e7ef', borderTop: '6px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <div style={{ color: '#2563eb', fontWeight: 600, fontSize: 18 }}>Loading your attempts...</div>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  // Calculate total scores
  const totalScore = attempts.reduce((sum, a) => sum + (a.score || 0), 0);
  const totalAdminScore = attempts.reduce((sum, a) => sum + (typeof a.adminScore === 'number' ? a.adminScore : 0), 0);
  const totalMaxScore = attempts.reduce((sum, a) => sum + (a.maxScore ?? a.total ?? 0), 0);

  return (
    <>
      <SignedIn>
        <main style={{ padding: 32, maxWidth: 700, margin: '0 auto' }}>
          <h1>Dashboard</h1>
          <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
            <div style={{ fontSize: 18, color: '#2563eb' }}>
              Followers: <b>{followersCount}</b>
            </div>
            <div style={{ fontSize: 18, color: '#2563eb' }}>
              Total Score: <b>{totalScore}</b>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            {user && user.imageUrl && (
              <img src={user.imageUrl} alt="Profile" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
            )}
            <div>
              <div><b>Name:</b> {user?.fullName || 'N/A'}</div>
              <div><b>Email:</b> {user?.primaryEmailAddress?.emailAddress || 'N/A'}</div>
            </div>
          </div>
          {/* User's News Posts */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ color: '#2563eb', fontSize: 20, marginBottom: 12 }}>Your News Posts</h2>
            {newsPosts.length === 0 && <div style={{ color: '#888' }}>You haven't posted any news yet.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {newsPosts.map((item) => (
                <div key={item.id} className="card" style={{ boxShadow: '0 2px 12px rgba(37,99,235,0.08)', border: '1px solid #e0e7ef', borderRadius: 16, padding: 20, position: 'relative' }}>
                  {/* 3-dot menu */}
                  <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#888', padding: 0 }}
                      aria-label="Post menu"
                    >
                      &#8942;
                    </button>
                    {menuOpenId === item.id && (
                      <div ref={menuRef} style={{ position: 'absolute', top: 28, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minWidth: 100, zIndex: 10 }}>
                        <button onClick={() => { setMenuOpenId(null); startEdit(item); }} style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '10px 16px', textAlign: 'left', color: '#2563eb', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => { setMenuOpenId(null); deletePost(item); }} disabled={deleteLoading === item.id} style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '10px 16px', textAlign: 'left', color: '#ef4444', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>{deleteLoading === item.id ? 'Deleting...' : 'Delete'}</button>
                      </div>
                    )}
                  </div>
                  {/* Post header and content */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    {item.authorImage && (
                      <img src={item.authorImage} alt="Profile" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', marginRight: 10 }} />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: '#2563eb' }}>{item.author}</span>
                      <span style={{ color: '#888', fontSize: 12 }}>{item.timestamp?.toDate?.()?.toISOString().replace('T', ' ').slice(0, 19) || ''}</span>
                    </div>
                  </div>
                  {editingPostId === item.id ? (
                    <>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        style={{ width: '100%', fontWeight: 600, fontSize: 17, color: '#1d4ed8', marginBottom: 6, borderRadius: 6, border: '1px solid #e0e7ef', padding: 6 }}
                        disabled={editLoading}
                      />
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        style={{ width: '100%', color: '#222', marginBottom: 6, borderRadius: 6, border: '1px solid #e0e7ef', padding: 6, minHeight: 40 }}
                        disabled={editLoading}
                      />
                      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                        <button onClick={() => saveEdit(item)} disabled={editLoading} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                        <button onClick={cancelEdit} disabled={editLoading} style={{ background: '#e5e7eb', color: '#222', border: 'none', borderRadius: 6, padding: '6px 16px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, fontSize: 17, color: '#1d4ed8', marginBottom: 6 }}>{item.title}</div>
                      <div style={{ color: '#222', marginBottom: 6 }}>{item.content}</div>
                      {item.mediaUrl && (
                        item.mediaType?.startsWith('image') ? (
                          <img src={item.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 10, margin: '10px 0' }} />
                        ) : item.mediaType?.startsWith('video') ? (
                          <video src={item.mediaUrl} controls style={{ maxWidth: '100%', borderRadius: 10, margin: '10px 0' }} />
                        ) : null
                      )}
                      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        {/* Edit/Delete now in 3-dot menu */}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
} 