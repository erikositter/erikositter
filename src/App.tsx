import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Contract, ActivityReport, NapCheck, UserRole, NapCheckItem, ChildProfile } from './types';
import { LogIn, LogOut, FileText, ClipboardList, Bed, Plus, Check, User as UserIcon, ChevronRight, Save } from 'lucide-react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setHasError(true);
      setError(e.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-4">
        <h2 className="text-red-800 font-bold mb-2">エラーが発生しました</h2>
        <p className="text-red-600 text-sm">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

const Header = ({ user, onLogout }: { user: UserProfile | null, onLogout: () => void }) => (
  <header className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
      <h1 className="text-xl font-semibold tracking-tight text-stone-900">BabyShare</h1>
    </div>
    {user && (
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-stone-900">{user.displayName}</p>
          <p className="text-xs text-stone-500 uppercase tracking-wider">{user.role === 'parent' ? '保護者' : 'シッター'}</p>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
          title="ログアウト"
        >
          <LogOut size={20} />
        </button>
      </div>
    )}
  </header>
);

// --- Main App ---

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'contract' | 'report' | 'nap' | 'profile'>('report');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [activeContract, setActiveContract] = useState<Contract | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        if (profileDoc.exists()) {
          setUserProfile(profileDoc.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firebase configuration error: Client is offline.");
        }
      }
    }
    testConnection();
  }, []);

  // Contracts Listener
  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, 'contracts'),
      where(userProfile.role === 'parent' ? 'parentId' : 'sitterId', '==', userProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Contract));
      setContracts(docs);
      if (docs.length > 0 && !activeContract) {
        setActiveContract(docs[0]);
      }
    }, (error) => {
      console.error("Firestore Error (Contracts):", error);
    });

    return unsubscribe;
  }, [userProfile]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleRoleSelect = async (role: UserRole) => {
    if (!firebaseUser) return;
    const profile: UserProfile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || 'User',
      role,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', firebaseUser.uid), profile);
    setUserProfile(profile);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <UserIcon size={32} />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">BabyShareへようこそ</h1>
          <p className="text-stone-500 mb-8">ベビーシッターと保護者のための安全な情報共有プラットフォームです。</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-stone-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-stone-800 transition-all shadow-sm"
          >
            <LogIn size={20} />
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          <h2 className="text-xl font-bold text-stone-900 mb-6 text-center">あなたの役割を選択してください</h2>
          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => handleRoleSelect('parent')}
              className="flex items-center justify-between p-4 border-2 border-stone-100 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
            >
              <div className="text-left">
                <p className="font-bold text-stone-900">保護者</p>
                <p className="text-sm text-stone-500">シッターを探し、報告を受け取ります</p>
              </div>
              <ChevronRight className="text-stone-300 group-hover:text-emerald-500" />
            </button>
            <button 
              onClick={() => handleRoleSelect('sitter')}
              className="flex items-center justify-between p-4 border-2 border-stone-100 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
            >
              <div className="text-left">
                <p className="font-bold text-stone-900">ベビーシッター</p>
                <p className="text-sm text-stone-500">活動を報告し、状況を共有します</p>
              </div>
              <ChevronRight className="text-stone-300 group-hover:text-emerald-500" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
        <Header user={userProfile} onLogout={handleLogout} />
        
        <main className="max-w-4xl mx-auto p-4 sm:p-6">
          {/* Contract Selector if multiple */}
          {contracts.length > 1 && (
            <div className="mb-6">
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">アクティブな契約</label>
              <select 
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={activeContract?.id}
                onChange={(e) => setActiveContract(contracts.find(c => c.id === e.target.value) || null)}
              >
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>
                    {userProfile.role === 'parent' ? `シッター: ${c.sitterId}` : `保護者: ${c.parentId}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {contracts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 shadow-sm">
              <div className="w-16 h-16 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-stone-900">契約がありません</h3>
              <p className="text-stone-500 mt-2">まだ有効な契約が登録されていません。</p>
              {userProfile.role === 'sitter' && (
                <button 
                  onClick={async () => {
                    const parentId = prompt("保護者のUIDを入力してください:");
                    if (parentId) {
                      await addDoc(collection(db, 'contracts'), {
                        parentId,
                        sitterId: userProfile.uid,
                        status: 'active',
                        content: '標準契約書',
                        createdAt: new Date().toISOString()
                      });
                    }
                  }}
                  className="mt-6 px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition shadow-sm"
                >
                  新しい契約を作成
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex bg-stone-200/50 p-1 rounded-xl mb-6">
                <button 
                  onClick={() => setActiveTab('report')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    activeTab === 'report' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  )}
                >
                  <ClipboardList size={18} />
                  <span>活動報告</span>
                </button>
                <button 
                  onClick={() => setActiveTab('nap')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    activeTab === 'nap' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  )}
                >
                  <Bed size={18} />
                  <span>午睡チェック</span>
                </button>
                <button 
                  onClick={() => setActiveTab('profile')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    activeTab === 'profile' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  )}
                >
                  <UserIcon size={18} />
                  <span>個人記録</span>
                </button>
                <button 
                  onClick={() => setActiveTab('contract')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    activeTab === 'contract' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  )}
                >
                  <FileText size={18} />
                  <span>契約書</span>
                </button>
              </div>

              {/* Content Area */}
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'report' && activeContract && (
                  <ActivityReportSection contract={activeContract} userProfile={userProfile} />
                )}
                {activeTab === 'nap' && activeContract && (
                  <NapCheckSection contract={activeContract} userProfile={userProfile} />
                )}
                {activeTab === 'profile' && activeContract && (
                  <ChildProfileSection contract={activeContract} userProfile={userProfile} />
                )}
                {activeTab === 'contract' && activeContract && (
                  <ContractSection contract={activeContract} />
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- Section Components ---

function ActivityReportSection({ contract, userProfile }: { contract: Contract, userProfile: UserProfile }) {
  const [reports, setReports] = useState<ActivityReport[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newReport, setNewReport] = useState<{
    timeline: { time: string, content: string, type: 'activity' | 'meal' | 'sleep' | 'other' }[],
    summary: string,
    mood: string
  }>({
    timeline: [{ time: format(new Date(), 'HH:mm'), content: '', type: 'activity' }],
    summary: '',
    mood: '普通'
  });

  useEffect(() => {
    const q = query(
      collection(db, 'activityReports'),
      where('contractId', '==', contract.id)
    );
    return onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActivityReport)).sort((a, b) => b.date.localeCompare(a.date)));
    });
  }, [contract.id]);

  const addTimelineItem = () => {
    setNewReport({
      ...newReport,
      timeline: [...newReport.timeline, { time: format(new Date(), 'HH:mm'), content: '', type: 'activity' }]
    });
  };

  const removeTimelineItem = (index: number) => {
    setNewReport({
      ...newReport,
      timeline: newReport.timeline.filter((_, i) => i !== index)
    });
  };

  const updateTimelineItem = (index: number, field: string, value: string) => {
    const updated = [...newReport.timeline];
    updated[index] = { ...updated[index], [field]: value };
    setNewReport({ ...newReport, timeline: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'activityReports'), {
      contractId: contract.id,
      sitterId: contract.sitterId,
      parentId: contract.parentId,
      date: format(new Date(), 'yyyy-MM-dd'),
      ...newReport,
      createdAt: new Date().toISOString()
    });
    setIsAdding(false);
    setNewReport({ 
      timeline: [{ time: format(new Date(), 'HH:mm'), content: '', type: 'activity' }], 
      summary: '', 
      mood: '普通' 
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-stone-900">活動報告一覧</h3>
        {userProfile.role === 'sitter' && !isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition shadow-sm"
          >
            <Plus size={18} />
            報告を作成
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest">タイムライン</label>
              <button 
                type="button" 
                onClick={addTimelineItem}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus size={14} /> 行を追加
              </button>
            </div>
            
            <div className="space-y-3">
              {newReport.timeline.map((item, index) => (
                <div key={index} className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2 duration-200">
                  <input 
                    type="time"
                    required
                    className="w-24 bg-stone-50 border border-stone-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={item.time}
                    onChange={e => updateTimelineItem(index, 'time', e.target.value)}
                  />
                  <select 
                    className="w-24 bg-stone-50 border border-stone-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={item.type}
                    onChange={e => updateTimelineItem(index, 'type', e.target.value)}
                  >
                    <option value="activity">遊び</option>
                    <option value="meal">食事</option>
                    <option value="sleep">睡眠</option>
                    <option value="other">その他</option>
                  </select>
                  <input 
                    type="text"
                    required
                    placeholder="内容を入力..."
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={item.content}
                    onChange={e => updateTimelineItem(index, 'content', e.target.value)}
                  />
                  {newReport.timeline.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeTimelineItem(index)}
                      className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                    >
                      <Plus size={16} className="rotate-45" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">まとめ・備考</label>
              <textarea 
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none min-h-[80px]"
                placeholder="全体的な様子など..."
                value={newReport.summary}
                onChange={e => setNewReport({...newReport, summary: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">本日の機嫌</label>
              <select 
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={newReport.mood}
                onChange={e => setNewReport({...newReport, mood: e.target.value})}
              >
                <option>とても良い</option>
                <option>良い</option>
                <option>普通</option>
                <option>少しぐずった</option>
                <option>泣くことが多かった</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition shadow-sm">
              報告を保存
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 border border-stone-200 rounded-xl font-medium text-stone-600 hover:bg-stone-50 transition">
              キャンセル
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {reports.length === 0 ? (
          <p className="text-center text-stone-400 py-12">報告はまだありません</p>
        ) : (
          reports.map(report => (
            <div key={report.id} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="font-bold text-stone-900 text-lg">{format(new Date(report.date), 'yyyy年MM月dd日')}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold uppercase tracking-wider">機嫌: {report.mood}</span>
                  </div>
                </div>
              </div>

              <div className="relative pl-4 border-l-2 border-stone-100 space-y-6 ml-2">
                {report.timeline?.map((item, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[25px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-emerald-500"></div>
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                      <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded w-fit">{item.time}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">
                          {item.type === 'activity' && '遊び'}
                          {item.type === 'meal' && '食事'}
                          {item.type === 'sleep' && '睡眠'}
                          {item.type === 'other' && 'その他'}
                        </span>
                        <p className="text-stone-700 font-medium">{item.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {report.summary && (
                <div className="mt-6 pt-6 border-t border-stone-100">
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">まとめ</label>
                  <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">{report.summary}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NapCheckSection({ contract, userProfile }: { contract: Contract, userProfile: UserProfile }) {
  const [napCheck, setNapCheck] = useState<NapCheck | null>(null);
  const [newPosition, setNewPosition] = useState<NapCheckItem['position']>('仰向け');
  const [newNote, setNewNote] = useState('');
  const [newTime, setNewTime] = useState(format(new Date(), 'HH:mm'));
  const [isTimeManual, setIsTimeManual] = useState(false);
  const [timeSinceLast, setTimeSinceLast] = useState<number | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const q = query(
      collection(db, 'napChecks'),
      where('contractId', '==', contract.id),
      where('date', '==', today)
    );
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setNapCheck({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as NapCheck);
      } else {
        setNapCheck(null);
      }
    });
  }, [contract.id, today]);

  // Update "time since last check" every minute and newTime if not manual
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isTimeManual) {
        setNewTime(format(new Date(), 'HH:mm'));
      }
      
      if (napCheck && napCheck.checks.length > 0) {
        const lastCheck = napCheck.checks[napCheck.checks.length - 1];
        const [hours, mins] = lastCheck.time.split(':').map(Number);
        const lastDate = new Date();
        lastDate.setHours(hours, mins, 0, 0);
        const diff = Math.floor((new Date().getTime() - lastDate.getTime()) / 60000);
        setTimeSinceLast(diff);
      } else {
        setTimeSinceLast(null);
      }
    }, 10000); // Check every 10s for responsiveness
    return () => clearInterval(timer);
  }, [napCheck]);

  const addCheck = async () => {
    const newCheck: NapCheckItem = {
      time: newTime,
      position: newPosition,
      note: newNote
    };

    if (napCheck) {
      await updateDoc(doc(db, 'napChecks', napCheck.id), {
        checks: [...napCheck.checks, newCheck]
      });
    } else {
      await addDoc(collection(db, 'napChecks'), {
        contractId: contract.id,
        sitterId: contract.sitterId,
        parentId: contract.parentId,
        date: today,
        checks: [newCheck],
        createdAt: new Date().toISOString()
      });
    }
    setNewNote('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-lg font-bold text-stone-900">午睡チェック表</h3>
          <p className="text-xs text-stone-500 mt-1">{format(new Date(), 'yyyy年MM月dd日')}</p>
        </div>
        {timeSinceLast !== null && (
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse",
            timeSinceLast >= 5 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
          )}>
            前回のチェックから {timeSinceLast} 分経過
          </div>
        )}
      </div>

      {userProfile.role === 'sitter' && (
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">記録時間</label>
              <div className="flex gap-2">
                <input 
                  type="time"
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={newTime}
                  onChange={e => {
                    setNewTime(e.target.value);
                    setIsTimeManual(true);
                  }}
                />
                <button 
                  onClick={() => {
                    setNewTime(format(new Date(), 'HH:mm'));
                    setIsTimeManual(false);
                  }}
                  className="px-3 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-200 transition"
                  title="現在時刻にリセット"
                >
                  現在
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">体の向き</label>
              <div className="grid grid-cols-2 gap-2">
                {(['仰向け', 'うつ伏せ', '右向き', '左向き'] as const).map(pos => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setNewPosition(pos)}
                    className={cn(
                      "py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                      newPosition === pos 
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" 
                        : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                    )}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">備考（任意）</label>
              <textarea 
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-h-[80px]"
                placeholder="咳、鼻水、汗など..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
            </div>
          </div>
          <button 
            onClick={addCheck}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition shadow-sm"
          >
            <Check size={20} />
            チェックを記録（5分おき推奨）
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="px-6 py-3 text-xs font-bold text-stone-400 uppercase tracking-widest">時間</th>
              <th className="px-6 py-3 text-xs font-bold text-stone-400 uppercase tracking-widest">体の向き</th>
              <th className="px-6 py-3 text-xs font-bold text-stone-400 uppercase tracking-widest">備考</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {!napCheck || napCheck.checks.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-stone-400 text-sm">本日のデータはありません</td>
              </tr>
            ) : (
              [...napCheck.checks].reverse().map((check, i) => (
                <tr key={i} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono font-bold text-stone-900">{check.time}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                      check.position === 'うつ伏せ' ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                    )}>
                      {check.position}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-500">{check.note || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 bg-stone-100 rounded-xl text-xs text-stone-500 leading-relaxed">
        <p className="font-bold mb-1">安全管理のポイント</p>
        <p>乳幼児の突然死症候群（SIDS）予防のため、5分おきに「顔色」「呼吸」「体の向き」を確認します。特に「うつ伏せ」は危険なため、速やかに仰向けに戻してください。</p>
      </div>
    </div>
  );
}

function ContractSection({ contract }: { contract: Contract }) {
  return (
    <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-xl font-bold text-stone-900">ベビーシッター利用契約書</h3>
          <p className="text-sm text-stone-500 mt-1">契約ID: {contract.id}</p>
        </div>
        <span className={cn(
          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest",
          contract.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"
        )}>
          {contract.status === 'active' ? '有効' : contract.status}
        </span>
      </div>

      <div className="prose prose-stone max-w-none text-stone-700 text-sm leading-relaxed space-y-6">
        <section>
          <h4 className="font-bold text-stone-900 mb-2 border-b border-stone-100 pb-1">第1条（目的）</h4>
          <p>本契約は、保護者（以下「甲」）がベビーシッター（以下「乙」）に対し、児童の保育業務を委託し、乙がこれを受託することに関し、必要な事項を定めることを目的とします。</p>
        </section>

        <section>
          <h4 className="font-bold text-stone-900 mb-2 border-b border-stone-100 pb-1">第2条（業務内容）</h4>
          <p>乙は、甲の指定する場所において、児童の安全を第一に考え、適切な保育、食事の補助、遊びの提供、および必要に応じた生活習慣の補助を行います。</p>
        </section>

        <section>
          <h4 className="font-bold text-stone-900 mb-2 border-b border-stone-100 pb-1">第3条（報告義務）</h4>
          <p>乙は、業務終了後速やかに、本アプリ「BabyShare」を通じて、当日の児童の様子、活動内容、健康状態等を甲に報告するものとします。また、午睡中は定期的な安全確認を行い、その記録を共有します。</p>
        </section>

        <section>
          <h4 className="font-bold text-stone-900 mb-2 border-b border-stone-100 pb-1">第4条（守秘義務）</h4>
          <p>乙は、本業務を通じて知り得た甲および児童の個人情報、家庭内の事情等について、第三者に漏洩してはなりません。本契約終了後も同様とします。</p>
        </section>

        <div className="pt-8 border-t border-stone-100 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">保護者 (甲)</p>
            <p className="font-mono text-stone-600">{contract.parentId}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">シッター (乙)</p>
            <p className="font-mono text-stone-600">{contract.sitterId}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChildProfileSection({ contract, userProfile }: { contract: Contract, userProfile: UserProfile }) {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ChildProfile>(contract.childProfile || {
    name: '',
    birthday: '',
    gender: '男の子',
    allergies: '',
    notes: ''
  });

  const handleSave = async () => {
    await updateDoc(doc(db, 'contracts', contract.id), {
      childProfile: profile
    });
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-xl font-bold text-stone-900">お子様の個人記録</h3>
        {userProfile.role === 'parent' && !isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 text-emerald-600 font-bold text-sm hover:text-emerald-700"
          >
            編集する
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">お名前</label>
              <input 
                type="text"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={profile.name}
                onChange={e => setProfile({...profile, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">生年月日</label>
              <input 
                type="date"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={profile.birthday}
                onChange={e => setProfile({...profile, birthday: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">性別</label>
              <select 
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={profile.gender}
                onChange={e => setProfile({...profile, gender: e.target.value as any})}
              >
                <option>男の子</option>
                <option>女の子</option>
                <option>その他</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">アレルギー情報</label>
            <input 
              type="text"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="卵、牛乳など（なければ「なし」）"
              value={profile.allergies}
              onChange={e => setProfile({...profile, allergies: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">特記事項・配慮事項</label>
            <textarea 
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none min-h-[120px]"
              placeholder="好きな遊び、寝かしつけのコツなど..."
              value={profile.notes}
              onChange={e => setProfile({...profile, notes: e.target.value})}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition shadow-sm"
            >
              <Save size={20} />
              保存する
            </button>
            <button 
              onClick={() => setIsEditing(false)}
              className="px-8 py-3 border border-stone-200 rounded-xl font-medium text-stone-600 hover:bg-stone-50 transition"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">お名前</label>
              <p className="text-lg font-bold text-stone-900">{profile.name || '未設定'}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">生年月日</label>
              <p className="text-lg font-bold text-stone-900">{profile.birthday ? format(new Date(profile.birthday), 'yyyy年MM月dd日') : '未設定'}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">性別</label>
              <p className="text-lg font-bold text-stone-900">{profile.gender}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-8 pt-8 border-t border-stone-100">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">アレルギー情報</label>
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                <p className="text-red-700 font-medium">{profile.allergies || '未登録'}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">特記事項・配慮事項</label>
              <div className="bg-stone-50 p-4 rounded-xl min-h-[100px]">
                <p className="text-stone-700 whitespace-pre-wrap">{profile.notes || '特になし'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
