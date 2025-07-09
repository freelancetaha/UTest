"use client";
import { useEffect, useState, useRef } from 'react';
import { db } from '@/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUser } from '@clerk/nextjs';
import { collection as fsCollection, onSnapshot as fsOnSnapshot } from 'firebase/firestore';

export default function NewsPage() {
  const { user, isLoaded } = useUser();
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [following, setFollowing] = useState<{ [key: string]: boolean }>({});
  const [likes, setLikes] = useState<{ [key: string]: number }>({});
  const [liked, setLiked] = useState<{ [key: string]: boolean }>({});
  const [newPostIds, setNewPostIds] = useState<string[]>([]);
  const [likeFlash, setLikeFlash] = useState<{ [key: string]: boolean }>({});
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const newDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Find truly new post IDs
      const currentIds = news.map(n => n.id);
      const incomingIds = newDocs.map(n => n.id);
      const trulyNew = incomingIds.filter(id => !currentIds.includes(id));
      if (trulyNew.length > 0) {
        setNewPostIds(ids => [...ids, ...trulyNew]);
        setTimeout(() => {
          setNewPostIds(ids => ids.filter(id => !trulyNew.includes(id)));
        }, 5000);
      }
      setNews(newDocs);
      setLoading(false);
    });
    return () => unsub();
  }, [news]);

  // Check following state for all news authors
  useEffect(() => {
    if (!user || !isLoaded || news.length === 0) return;
    const checkFollowing = async () => {
      const newFollowing: { [key: string]: boolean } = {};
      for (const item of news) {
        if (item.authorId && item.authorId !== user.id) {
          const followingRef = doc(db, 'users', user.id, 'following', item.authorId);
          const followingSnap = await getDoc(followingRef);
          newFollowing[item.authorId] = followingSnap.exists();
        }
      }
      setFollowing(newFollowing);
    };
    checkFollowing();
  }, [user, isLoaded, news]);

  // Fetch likes for all posts
  useEffect(() => {
    if (news.length === 0) return;
    const unsubscribes: (() => void)[] = [];
    news.forEach((item) => {
      if (!item.id) return;
      const likesCol = fsCollection(db, 'news', item.id, 'likes');
      const unsub = fsOnSnapshot(likesCol, (snapshot) => {
        setLikes(l => {
          const prev = l[item.id] || 0;
          const next = snapshot.size;
          if (prev !== next) {
            setLikeFlash(f => ({ ...f, [item.id]: true }));
            setTimeout(() => setLikeFlash(f => ({ ...f, [item.id]: false })), 700);
          }
          return { ...l, [item.id]: next };
        });
        if (user) {
          setLiked(lk => ({ ...lk, [item.id]: !!snapshot.docs.find(doc => doc.id === user.id) }));
        }
        console.log('likes updated', item.id, snapshot.size);
      });
      unsubscribes.push(unsub);
    });
    return () => { unsubscribes.forEach(unsub => unsub()); };
  }, [news, user]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() && !content.trim() && !mediaFile) {
      setError("Please enter some content or select a media file.");
      return;
    }
    setPosting(true);

    // Optimistically add the post
    const tempId = `temp-${Date.now()}`;
    const optimisticPost = {
      id: tempId,
      title: title.trim(),
      content: content.trim(),
      timestamp: new Date(),
      author: user?.fullName || user?.primaryEmailAddress?.emailAddress || "User",
      authorImage: user?.imageUrl || "",
      authorId: user?.id || "",
      mediaUrl: mediaPreview || "",
      mediaType: mediaFile ? mediaFile.type : "",
      pending: true
    };
    setNews(prev => [optimisticPost, ...prev]);

    // Clear form and preview instantly
    setTitle("");
    setContent("");
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Upload to Firestore as before
    let mediaUrl = "";
    try {
      if (mediaFile) {
        const storage = getStorage();
        const newsId = `${Date.now()}_${mediaFile.name}`;
        const storageRef = ref(storage, `news-media/${newsId}`);
        await uploadBytes(storageRef, mediaFile);
        mediaUrl = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, 'news'), {
        title: optimisticPost.title,
        content: optimisticPost.content,
        timestamp: serverTimestamp(),
        author: optimisticPost.author,
        authorImage: optimisticPost.authorImage,
        authorId: optimisticPost.authorId,
        mediaUrl,
        mediaType: optimisticPost.mediaType
      });
    } catch (err) {
      setError("Failed to post news.");
    }
    setPosting(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        setError('Only JPG, JPEG, PNG, GIF, or WEBP images are allowed.');
        setMediaFile(null);
        setMediaPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setMediaPreview(URL.createObjectURL(file));
    } else {
      setMediaPreview(null);
    }
    setError("");
    setMediaFile(file);
  };

  const handleFollow = async (targetUserId: string) => {
    if (!user || !targetUserId) return;
    // Add to following
    await setDoc(doc(db, 'users', user.id, 'following', targetUserId), { followedAt: new Date().toISOString() });
    // Add to followers
    await setDoc(doc(db, 'users', targetUserId, 'followers', user.id), { followedAt: new Date().toISOString() });
    setFollowing(f => ({ ...f, [targetUserId]: true }));
  };

  const handleUnfollow = async (targetUserId: string) => {
    if (!user || !targetUserId) return;
    // Remove from following
    await deleteDoc(doc(db, 'users', user.id, 'following', targetUserId));
    // Remove from followers
    await deleteDoc(doc(db, 'users', targetUserId, 'followers', user.id));
    setFollowing(f => ({ ...f, [targetUserId]: false }));
  };

  const handleLike = async (postId: string) => {
    if (!user || !postId) return;
    await setDoc(doc(db, 'news', postId, 'likes', user.id), { likedAt: new Date().toISOString() });
  };

  const handleUnlike = async (postId: string) => {
    if (!user || !postId) return;
    await deleteDoc(doc(db, 'news', postId, 'likes', user.id));
  };

  return (
    <>
      {user && (
        <div className="card" style={{ maxWidth: 700, margin: '32px auto 0 auto', boxShadow: '0 2px 12px rgba(37,99,235,0.08)', border: '1px solid #e0e7ef', borderRadius: 16, padding: 20 }}>
          <form onSubmit={handlePost} style={{ margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img src={user?.imageUrl} alt="Profile" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              <input
                type="text"
                placeholder={`What's on your mind, ${user?.firstName || user?.fullName || ''}?`}
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 20, padding: '12px 18px', fontSize: 16, outline: 'none' }}
                disabled={posting}
              />
            </div>
            <textarea
              placeholder="Share details..."
              value={content}
              onChange={e => setContent(e.target.value)}
              style={{ width: '100%', minHeight: 60, borderRadius: 12, border: '1px solid #e0e7ef', padding: 12, fontSize: 15, marginBottom: 10, background: '#f8fafc', resize: 'vertical' }}
              disabled={posting}
            />
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={posting}
            />
            {mediaPreview && (
              <div style={{ margin: '10px 0' }}>
                <img src={mediaPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 18 }}>
                <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#10b981', fontWeight: 600, fontSize: 15, cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                  <span style={{ fontSize: 20 }}>🖼️</span> Photo
                </button>
              </div>
              <button type="submit" disabled={posting} style={{ background: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 15, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.08)' }}>
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
            {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
          </form>
        </div>
      )}
      <main style={{ padding: 32, maxWidth: 700, margin: '0 auto' }}>
        <h1 style={{ color: '#2563eb', marginBottom: 24 }}>News & Announcements</h1>
        {loading && <div>Loading news...</div>}
        {news.length === 0 && !loading && <p>No news yet.</p>}
        <div className="news-list" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {news.map((item) => (
            <div key={item.id} className={`card news-card${item.pending ? ' pending' : ''}${newPostIds.includes(item.id) ? ' new' : ''}`} style={{ boxShadow: '0 2px 12px rgba(37,99,235,0.08)', border: '1px solid #e0e7ef', borderRadius: 16, padding: 24, position: 'relative' }}>
              <div className="news-header" style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                {item.authorImage && (
                  <a href={`/profile/${item.authorId || ''}`} style={{ textDecoration: 'none' }}>
                    <img src={item.authorImage} alt="Profile" className="news-author-img" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', marginRight: 12 }} />
                  </a>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <a href={`/profile/${item.authorId || ''}`} style={{ color: '#2563eb', fontWeight: 600, fontSize: 16, textDecoration: 'none', display: 'inline-block' }}>
                    {item.author}
                  </a>
                  {user?.id && item.authorId && (
                    following[item.authorId] ? (
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#10b981',
                          fontSize: 13,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                          marginLeft: 0
                        }}
                        onClick={() => handleUnfollow(item.authorId)}
                      >
                        Following
                      </button>
                    ) : (
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: 13,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                          marginLeft: 0
                        }}
                        onClick={() => handleFollow(item.authorId)}
                      >
                        Follow
                      </button>
                    )
                  )}
                </div>
                <div className="news-date" style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>{item.timestamp?.toDate?.().toLocaleString?.() || ''}</div>
              </div>
              <div className="news-title" style={{ fontWeight: 600, fontSize: 20, color: '#1d4ed8', marginBottom: 8 }}>{item.title}</div>
              <div
                className="news-content"
                style={{
                  color: '#222',
                  marginBottom: 8,
                  wordBreak: 'break-word',
                  position: 'relative',
                  zIndex: 1,
                  pointerEvents: 'auto'
                }}
                dangerouslySetInnerHTML={{ __html: linkify(item.content) }}
              />
              {item.mediaUrl && item.mediaType?.startsWith('image') && (
                <img src={item.mediaUrl} alt="media" className="news-media-img" style={{ maxWidth: '100%', borderRadius: 12, margin: '12px 0' }} />
              )}
              {item.mediaUrl && item.mediaType?.startsWith('video') && (
                <video src={item.mediaUrl} controls className="news-media-video" style={{ maxWidth: '100%', borderRadius: 12, margin: '12px 0' }} />
              )}
              {item.mediaUrl && item.mediaType?.startsWith('audio') && (
                <audio src={item.mediaUrl} controls className="news-media-audio" style={{ width: '100%', margin: '12px 0' }} />
              )}
              {/* Like button and count directly below media */}
              <div className="like-btn-container" style={{ display: 'flex', alignItems: 'center', fontSize: 16, padding: '6px 0', marginTop: 8 }}>
                {user?.id && item.authorId ? (
                  liked[item.id] ? (
                    <button
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', marginRight: 8 }}
                      onClick={() => handleUnlike(item.id)}
                    >
                      ♥ Liked
                    </button>
                  ) : (
                    <button
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 14, cursor: 'pointer', marginRight: 8 }}
                      onClick={() => handleLike(item.id)}
                    >
                      ♡ Like
                    </button>
                  )
                ) : null}
                <span style={{ color: '#888', fontSize: 13 }} className={likeFlash[item.id] ? 'like-flash' : ''}>{likes[item.id] || 0} {likes[item.id] === 1 ? 'like' : 'likes'}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
      {/* Responsive style for like button container and news cards */}
      <style>{`
        @media (min-width: 601px) {
          .like-btn-container {
            position: static !important;
            left: unset !important;
            bottom: unset !important;
            margin-top: 8px !important;
          }
        }
        @media (max-width: 600px) {
          main {
            padding: 4vw !important;
          }
          .news-list {
            gap: 12px !important;
          }
          .news-card {
            padding: 12px 8px !important;
            border-radius: 12px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04) !important;
            min-width: 0 !important;
          }
          .news-header {
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
            margin-bottom: 6px !important;
          }
          .news-author-img {
            width: 32px !important;
            height: 32px !important;
            margin-right: 8px !important;
          }
          .news-title {
            font-size: 17px !important;
            font-weight: 700 !important;
            margin-bottom: 4px !important;
            color: #1d4ed8 !important;
          }
          .news-content {
            font-size: 15px !important;
            margin-bottom: 6px !important;
            color: #222 !important;
          }
          .news-date {
            font-size: 11px !important;
            color: #888 !important;
            margin-left: auto !important;
          }
          .news-media-img, .news-media-video {
            width: 100% !important;
            max-height: 160px !important;
            object-fit: cover !important;
            border-radius: 8px !important;
            margin: 8px 0 !important;
          }
          .news-media-audio {
            width: 100% !important;
            margin: 8px 0 !important;
          }
          .like-btn-container {
            position: static !important;
            display: flex !important;
            justify-content: flex-end !important;
            align-items: center !important;
            margin-top: 6px !important;
            font-size: 15px !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .like-btn-container button {
            font-size: 16px !important;
            padding: 6px 14px !important;
            min-width: 44px !important;
            border-radius: 6px !important;
          }
          form textarea {
            font-size: 14px !important;
            padding: 8px !important;
            min-height: 36px !important;
          }
        }
        @media (max-width: 400px) {
          .news-title { font-size: 15px !important; }
          .news-content { font-size: 13px !important; }
          .news-header { gap: 4px !important; }
          .news-author-img { width: 26px !important; height: 26px !important; }
        }
        .news-card.new {
          animation: highlightNew 1s ease;
          background: #e0f2fe !important;
        }
        @keyframes highlightNew {
          from { background: #bae6fd; }
          to { background: #e0f2fe; }
        }
        .like-flash {
          animation: likeFlashAnim 0.7s;
          color: #f59e42 !important;
          font-weight: bold;
        }
        @keyframes likeFlashAnim {
          0% { color: #f59e42; background: #fffbe7; }
          60% { color: #f59e42; background: #fffbe7; }
          100% { color: #888; background: none; }
        }
        .news-card.pending {
          opacity: 0.6;
          filter: blur(1px);
        }
        .news-content {
          pointer-events: auto !important;
        }
      `}</style>
    </>
  );
}

function linkify(text: string) {
  const urlRegex = /((https?:\/\/[^\s]+))/g;
  return text.replace(
    urlRegex,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;word-break:break-all;pointer-events:auto;text-decoration:underline;">${url}</a>`
  );
} 