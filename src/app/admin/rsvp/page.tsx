"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Download, Lock, RefreshCw, Trash2, Users, Mic } from 'lucide-react';

interface RSVPRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  attendeeCount: number;
  note: string;
  timestamp: number;
  deleted?: boolean;
}

interface StoryRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  relationship: string;
  relationshipOther: string;
  timestamp: number;
  deleted?: boolean;
}

export default function RSVPAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'rsvp' | 'story'>('rsvp');
  const [rsvpRecords, setRsvpRecords] = useState<RSVPRecord[]>([]);
  const [storyRecords, setStoryRecords] = useState<StoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1234') {
      setIsAuthenticated(true);
      fetchData();
    } else {
      alert('密碼錯誤');
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch RSVP records
      const rsvpQuery = query(collection(db, "rsvp"), orderBy("timestamp", "desc"));
      const rsvpSnapshot = await getDocs(rsvpQuery);
      const rsvpData: RSVPRecord[] = [];
      rsvpSnapshot.forEach((doc) => {
        const record = { id: doc.id, ...doc.data() } as RSVPRecord;
        if (!record.deleted) {
          rsvpData.push(record);
        }
      });
      setRsvpRecords(rsvpData);

      // Fetch Story sharing records
      const storyQuery = query(collection(db, "story-sharing"), orderBy("timestamp", "desc"));
      const storySnapshot = await getDocs(storyQuery);
      const storyData: StoryRecord[] = [];
      storySnapshot.forEach((doc) => {
        const record = { id: doc.id, ...doc.data() } as StoryRecord;
        if (!record.deleted) {
          storyData.push(record);
        }
      });
      setStoryRecords(storyData);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("讀取資料失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRSVP = async (id: string) => {
    if (!confirm('確定要刪除此報名記錄嗎？')) return;
    try {
      await updateDoc(doc(db, "rsvp", id), {
        deleted: true,
        deletedAt: Date.now()
      });
      setRsvpRecords(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error("Error deleting:", error);
      alert("刪除失敗");
    }
  };

  const handleDeleteStory = async (id: string) => {
    if (!confirm('確定要刪除此故事分享記錄嗎？')) return;
    try {
      await updateDoc(doc(db, "story-sharing", id), {
        deleted: true,
        deletedAt: Date.now()
      });
      setStoryRecords(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error("Error deleting:", error);
      alert("刪除失敗");
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10 && cleaned.startsWith('09')) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const getRelationshipLabel = (rel: string) => {
    const labels: Record<string, string> = {
      student: '學生',
      friend: '朋友',
      colleague: '同事',
      classmate: '同學',
      other: '其他',
    };
    return labels[rel] || rel;
  };

  const downloadRSVPCSV = () => {
    const headers = ["編號", "時間", "姓名", "電話", "Email", "出席人數", "備註"];
    const rows = rsvpRecords.map((r, index) => [
      index + 1,
      new Date(r.timestamp).toLocaleString('zh-TW'),
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${formatPhoneNumber(r.phone || '').replace(/"/g, '""')}"`,
      `"${(r.email || '').replace(/"/g, '""')}"`,
      r.attendeeCount || 1,
      `"${(r.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rsvp_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadStoryCSV = () => {
    const headers = ["編號", "時間", "姓名", "電話", "Email", "與游老師關係", "其他說明"];
    const rows = storyRecords.map((r, index) => [
      index + 1,
      new Date(r.timestamp).toLocaleString('zh-TW'),
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${formatPhoneNumber(r.phone || '').replace(/"/g, '""')}"`,
      `"${(r.email || '').replace(/"/g, '""')}"`,
      `"${getRelationshipLabel(r.relationship)}"`,
      `"${(r.relationshipOther || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `story_sharing_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate total attendees
  const totalAttendees = rsvpRecords.reduce((sum, r) => sum + (r.attendeeCount || 1), 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f5f3f0] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-md p-10 rounded-3xl border border-black/10 space-y-8 bg-white shadow-xl">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto border border-black/10">
              <Lock className="text-black/60" size={28} />
            </div>
            <h1 className="text-2xl text-black/80 font-light tracking-[0.1em]">報名管理</h1>
          </div>
          
          <div className="space-y-6">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              className="w-full bg-black/5 border border-black/10 rounded-full px-6 py-4 text-black/80 text-center tracking-[0.5em] outline-none focus:border-black/30 transition-all placeholder:tracking-widest placeholder:text-black/30"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-black/80 text-white py-4 rounded-full tracking-[0.1em] hover:bg-black/70 transition-all font-light"
            >
              登入
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-black/80 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-light tracking-[0.1em]">追思會報名管理</h1>
            <p className="text-black/50 text-sm mt-1">1/24 游瑛樟老師追思會</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/admin"
              className="px-4 py-2 text-sm border border-black/20 rounded-full hover:bg-black/5 transition-all"
            >
              投稿管理
            </a>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 border border-black/20 rounded-full hover:bg-black/5 transition-all"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-black/5">
          <p className="text-black/50 text-sm">報名人數</p>
          <p className="text-3xl font-light mt-1">{rsvpRecords.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-black/5">
          <p className="text-black/50 text-sm">總出席人數</p>
          <p className="text-3xl font-light mt-1">{totalAttendees}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-black/5">
          <p className="text-black/50 text-sm">故事分享報名</p>
          <p className="text-3xl font-light mt-1">{storyRecords.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-black/5 flex items-center justify-center">
          <a href="/rsvp" target="_blank" className="text-sm text-black/60 hover:text-black transition-all">
            前往報名頁 →
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('rsvp')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm transition-all ${
              activeTab === 'rsvp' 
                ? 'bg-black/80 text-white' 
                : 'bg-white border border-black/10 text-black/60 hover:bg-black/5'
            }`}
          >
            <Users size={16} />
            出席報名 ({rsvpRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('story')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm transition-all ${
              activeTab === 'story' 
                ? 'bg-black/80 text-white' 
                : 'bg-white border border-black/10 text-black/60 hover:bg-black/5'
            }`}
          >
            <Mic size={16} />
            故事分享 ({storyRecords.length})
          </button>
        </div>
      </div>

      {/* RSVP Table */}
      {activeTab === 'rsvp' && (
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-end mb-4">
            <button
              onClick={downloadRSVPCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-full text-sm hover:bg-black/5 transition-all"
            >
              <Download size={16} />
              下載 CSV
            </button>
          </div>
          
          <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">時間</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">姓名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">電話</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">人數</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">備註</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {rsvpRecords.map((record, index) => (
                    <tr key={record.id} className="hover:bg-black/[0.02]">
                      <td className="px-4 py-4 text-sm text-black/40">{index + 1}</td>
                      <td className="px-4 py-4 text-sm text-black/60">
                        {new Date(record.timestamp).toLocaleString('zh-TW', { 
                          month: 'numeric', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium">{record.name}</td>
                      <td className="px-4 py-4 text-sm text-black/60">{formatPhoneNumber(record.phone)}</td>
                      <td className="px-4 py-4 text-sm text-black/60">{record.email || '-'}</td>
                      <td className="px-4 py-4 text-sm text-center">{record.attendeeCount || 1}</td>
                      <td className="px-4 py-4 text-sm text-black/60 max-w-[200px] truncate">{record.note || '-'}</td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleDeleteRSVP(record.id)}
                          className="p-2 text-black/30 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rsvpRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-black/40">
                        尚無報名記錄
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Story Sharing Table */}
      {activeTab === 'story' && (
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-end mb-4">
            <button
              onClick={downloadStoryCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-full text-sm hover:bg-black/5 transition-all"
            >
              <Download size={16} />
              下載 CSV
            </button>
          </div>
          
          <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">時間</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">姓名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">電話</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider">與游老師關係</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black/50 tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {storyRecords.map((record, index) => (
                    <tr key={record.id} className="hover:bg-black/[0.02]">
                      <td className="px-4 py-4 text-sm text-black/40">{index + 1}</td>
                      <td className="px-4 py-4 text-sm text-black/60">
                        {new Date(record.timestamp).toLocaleString('zh-TW', { 
                          month: 'numeric', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium">{record.name}</td>
                      <td className="px-4 py-4 text-sm text-black/60">{formatPhoneNumber(record.phone)}</td>
                      <td className="px-4 py-4 text-sm text-black/60">{record.email || '-'}</td>
                      <td className="px-4 py-4 text-sm">
                        {getRelationshipLabel(record.relationship)}
                        {record.relationshipOther && (
                          <span className="text-black/40 ml-1">({record.relationshipOther})</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleDeleteStory(record.id)}
                          className="p-2 text-black/30 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {storyRecords.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-black/40">
                        尚無故事分享報名
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
