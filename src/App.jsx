import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  writeBatch,
  query,
  getDocs
} from 'firebase/firestore';
import { 
  Users, 
  Shuffle, 
  RotateCcw, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';

// --- 1. นำค่า Config จาก Firebase มาใส่ตรงนี้ ---
const firebaseConfig = {
  apiKey: "AIzaSyCAZtfBjDPE6Af5uyUqrlibN4XpPelpobA",
  authDomain: "my-duty-roster-b1ae5.firebaseapp.com",
  projectId: "my-duty-roster-b1ae5",
  storageBucket: "my-duty-roster-b1ae5.firebasestorage.app",
  messagingSenderId: "471447310162",
  appId: "1:471447310162:web:0f422c777a5e34c93c748b",
  measurementId: "G-K0SVEWG6GJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ใช้ Collection ชื่อคงที่สำหรับแอปนี้
const COLLECTION_NAME = 'duty_roster_group_1';

export default function DutyRosterApp() {
  const [user, setUser] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
        setError("ไม่สามารถเชื่อมต่อระบบได้ กรุณารีเฟรชหน้าจอ");
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Data Sync
  useEffect(() => {
    if (!user) return;

    const rosterRef = collection(db, COLLECTION_NAME);

    const unsubscribe = onSnapshot(rosterRef, (snapshot) => {
      const usersData = [];
      let currentUserJoined = false;

      snapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push(data);
        if (data.uid === user.uid) {
          currentUserJoined = true;
        }
      });

      usersData.sort((a, b) => {
        if (a.number !== null && b.number !== null) return a.number - b.number;
        if (a.number !== null) return -1;
        if (b.number !== null) return 1;
        return a.joinedAt - b.joinedAt;
      });

      setParticipants(usersData);
      setIsJoined(currentUserJoined);
      setLoading(false);
    }, (err) => {
      console.error("Snapshot error:", err);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล (ตรวจสอบ Firebase Config)");
    });

    return () => unsubscribe();
  }, [user]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!nameInput.trim() || !user) return;

    try {
      setLoading(true);
      const userRef = doc(db, COLLECTION_NAME, user.uid);
      
      await setDoc(userRef, {
        uid: user.uid,
        name: nameInput.trim(),
        number: null,
        joinedAt: Date.now(),
        avatarColor: Math.floor(Math.random() * 6)
      });
      
      setNameInput('');
    } catch (err) {
      console.error("Join error:", err);
      setError("ไม่สามารถเข้าร่วมได้ (ตรวจสอบ Permission Firestore)");
    } finally {
      setLoading(false);
    }
  };

  const handleDraw = async () => {
    if (!user || drawing) return;
    setDrawing(true);
    setError('');

    try {
      const rosterRef = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(query(rosterRef));
      
      const takenNumbers = new Set();
      let myCurrentData = null;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.number !== null) {
          takenNumbers.add(data.number);
        }
        if (data.uid === user.uid) {
          myCurrentData = data;
        }
      });

      if (!myCurrentData) throw new Error("User not found");
      if (myCurrentData.number !== null) {
        setError("คุณจับฉลากไปแล้ว");
        setDrawing(false);
        return;
      }

      const maxSlots = Math.max(6, participants.length);
      const availableNumbers = [];
      for (let i = 1; i <= maxSlots; i++) {
        if (!takenNumbers.has(i)) {
          availableNumbers.push(i);
        }
      }

      if (availableNumbers.length === 0) {
        setError("สลากหมดแล้ว!");
        setDrawing(false);
        return;
      }

      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const drawnNumber = availableNumbers[randomIndex];

      const userRef = doc(db, COLLECTION_NAME, user.uid);
      await setDoc(userRef, { ...myCurrentData, number: drawnNumber }, { merge: true });

    } catch (err) {
      console.error("Drawing error:", err);
      setError("เกิดข้อผิดพลาดในการจับฉลาก");
    } finally {
      setDrawing(false);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
       // Fallback logic handled in UI mostly, but modern browsers support clipboard API
    });
  };

  const getAvatarColor = (index) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 
      'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'
    ];
    return colors[index % colors.length];
  };

  if (loading && participants.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin text-blue-600">
          <RotateCcw size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans text-slate-800">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center relative">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Shuffle className="w-6 h-6" />
            จับฉลากเข้าเวร
          </h1>
          <p className="text-blue-100 text-sm mt-1">ระบบสุ่มลำดับออนไลน์ ({participants.length} คน)</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 text-sm flex items-center gap-2 px-6">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {!isJoined ? (
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="inline-block p-4 bg-blue-50 rounded-full mb-3 text-blue-600">
                <Users size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">ยินดีต้อนรับ!</h2>
              <p className="text-slate-500 text-sm">กรุณาใส่ชื่อของคุณเพื่อเข้าร่วมห้อง</p>
            </div>
            <form onSubmit={handleJoin} className="space-y-4">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="ชื่อเล่น หรือ ชื่อจริง"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                maxLength={20}
              />
              <button
                type="submit"
                disabled={!nameInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg transition shadow-md"
              >
                เข้าร่วม
              </button>
            </form>
          </div>
        ) : (
          <div className="p-6">
            {participants.map((p) => {
              if (p.uid === user.uid) {
                return (
                  <div key={p.uid} className="mb-8 p-6 bg-blue-50 rounded-xl border border-blue-100 text-center">
                    <h3 className="text-lg font-semibold text-blue-900 mb-1">สวัสดี, {p.name}</h3>
                    {p.number === null ? (
                      <div className="mt-4">
                        <p className="text-sm text-blue-600 mb-4">ยังไม่ได้จับลำดับ</p>
                        <button
                          onClick={handleDraw}
                          disabled={drawing}
                          className={`
                            px-8 py-3 rounded-full font-bold text-lg shadow-lg transform transition active:scale-95
                            ${drawing 
                              ? 'bg-slate-400 cursor-not-allowed text-white' 
                              : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:shadow-orange-500/30 hover:-translate-y-1'
                            }
                          `}
                        >
                          {drawing ? 'กำลังสุ่ม...' : '?? กดจับฉลาก'}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 animate-in fade-in zoom-in duration-500">
                        <p className="text-sm text-slate-500 mb-2">ลำดับของคุณคือ</p>
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-inner border-4 border-blue-200">
                           <span className="text-5xl font-black text-blue-600">{p.number}</span>
                        </div>
                        <p className="text-xs text-green-600 mt-3 font-medium flex items-center justify-center gap-1">
                          <CheckCircle size={14} /> บันทึกแล้ว
                        </p>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })}

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
                ผลการจับฉลาก ({participants.filter(p => p.number !== null).length}/{participants.length})
              </h4>
              {participants.length === 0 ? (
                 <p className="text-center text-slate-400 py-4">รอผู้เข้าร่วม...</p>
              ) : (
                participants.map((p) => {
                  const isMe = p.uid === user?.uid;
                  return (
                    <div 
                      key={p.uid} 
                      className={`
                        flex items-center justify-between p-3 rounded-lg border transition-all
                        ${isMe ? 'bg-white border-blue-400 shadow-sm ring-1 ring-blue-100' : 'bg-white border-slate-100'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(p.avatarColor || 0)}`}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className={`font-medium ${isMe ? 'text-blue-700' : 'text-slate-700'}`}>
                            {p.name} {isMe && '(คุณ)'}
                          </span>
                          {p.number === null ? (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock size={10} /> รอจับ...
                            </span>
                          ) : (
                            <span className="text-xs text-green-500 flex items-center gap-1">เรียบร้อย</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {p.number !== null ? (
                          <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl
                            ${p.number === 1 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}
                          `}>
                            {p.number}
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                            <span className="text-slate-300 text-xl">?</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400 mb-2">ส่งลิงก์หน้านี้ให้เพื่อน</p>
              <div 
                onClick={handleCopyLink}
                className="mx-auto max-w-xs flex items-center justify-between gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 cursor-pointer rounded-lg border border-slate-200 transition group"
              >
                <span className="text-xs text-slate-500 truncate font-mono flex-1 text-left">
                  {window.location.href}
                </span>
                <span className="text-slate-500 group-hover:text-blue-600">
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </span>
              </div>
              {copied && <p className="text-xs text-green-500 mt-1">คัดลอกลิงก์แล้ว!</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}