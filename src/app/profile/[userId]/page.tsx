"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

export default function UserProfilePage() {
  const { userId } = useParams();
  const [userNews, setUserNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState({ author: "", authorImage: "" });

  useEffect(() => {
    async function fetchUserNews() {
      setLoading(true);
      const q = query(
        collection(db, "news"),
        where("authorId", "==", userId),
        orderBy("timestamp", "desc")
      );
      const querySnapshot = await getDocs(q);
      const newsArr = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUserNews(newsArr);
      if (newsArr.length > 0) {
        setUserInfo({
          author: newsArr[0].author,
          authorImage: newsArr[0].authorImage,
        });
      }
      setLoading(false);
    }
    if (userId) fetchUserNews();
  }, [userId]);

  return (
    <div style={{ maxWidth: 700, margin: "32px auto 0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        {userInfo.authorImage && (
          <img src={userInfo.authorImage} alt="Profile" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
        )}
        <div>
          <h2 style={{ margin: 0, color: "#2563eb" }}>{userInfo.author}</h2>
          <span style={{ color: "#888" }}>@{userId}</span>
        </div>
      </div>
      <h3 style={{ color: "#2563eb" }}>Posts</h3>
      {loading && <div>Loading...</div>}
      {!loading && userNews.length === 0 && <div>No posts yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {userNews.map((item) => (
          <div key={item.id} className="card" style={{ boxShadow: '0 2px 12px rgba(37,99,235,0.08)', border: '1px solid #e0e7ef', borderRadius: 16, padding: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 20, color: '#1d4ed8', marginBottom: 8 }}>{item.title}</div>
            <div style={{ color: '#222', marginBottom: 8 }}>{item.content}</div>
            {item.mediaUrl && item.mediaType?.startsWith('image') && (
              <img src={item.mediaUrl} alt="media" style={{ maxWidth: '100%', borderRadius: 12, margin: '12px 0' }} />
            )}
            {item.mediaUrl && item.mediaType?.startsWith('video') && (
              <video src={item.mediaUrl} controls style={{ maxWidth: '100%', borderRadius: 12, margin: '12px 0' }} />
            )}
            {item.mediaUrl && item.mediaType?.startsWith('audio') && (
              <audio src={item.mediaUrl} controls style={{ width: '100%', margin: '12px 0' }} />
            )}
            <div style={{ color: '#888', fontSize: 13 }}>{item.timestamp?.toDate?.().toLocaleString?.() || ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
} 