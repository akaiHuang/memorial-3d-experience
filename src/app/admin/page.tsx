"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import type { Memory } from '@/types';
import { Download, Lock, RefreshCw, X, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

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
      const q = query(collection(db, "memories"), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      const data: Memory[] = [];
      querySnapshot.forEach((doc) => {
        const memory = { id: doc.id, ...doc.data() } as Memory;
        if (!memory.deleted) {
          data.push(memory);
        }
      });
      setMemories(data);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("讀取資料失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
    setDeletePassword('');
  };

  const confirmDelete = async () => {
    if (deletePassword === '1234' && deleteId) {
      try {
        await updateDoc(doc(db, "memories", deleteId), {
          deleted: true,
          deletedAt: Date.now()
        });
        setMemories(prev => prev.filter(m => m.id !== deleteId));
        setShowDeleteModal(false);
        setDeleteId(null);
        setDeletePassword('');
      } catch (error) {
        console.error("Error deleting memory:", error);
        alert("刪除失敗");
      }
    } else {
      alert('密碼錯誤');
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Check if it matches standard Taiwan mobile format (09xx-xxx-xxx)
    if (cleaned.length === 10 && cleaned.startsWith('09')) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const sanitizeFileName = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ');
  };

  const getFileExtension = (contentType: string, fallback: string) => {
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'jpg'; // webp 會轉成 jpg
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('mp4')) return 'm4a';
    if (contentType.includes('ogg')) return 'ogg';
    if (contentType.includes('webm')) return 'webm';
    return fallback;
  };

  // 將圖片轉換為 JPG 格式
  const convertToJpg = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Cannot get canvas context'));
          return;
        }
        // 白色背景（處理透明圖片）
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (jpgBlob) => {
            if (jpgBlob) {
              resolve(jpgBlob);
            } else {
              reject(new Error('Failed to convert to JPG'));
            }
          },
          'image/jpeg',
          0.92 // 92% 品質
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(blob);
    });
  };

  const buildDocContent = (text: string) => {
    const safeText = escapeHtml(text || '');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p style="white-space: pre-wrap;">${safeText}</p></body></html>`;
  };

  const downloadMemoriesZip = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const usedFolderNames = new Set<string>();

      const tasks = memories.map(async (memory) => {
        const rawAuthor = memory.author || '未署名';
        const baseName = sanitizeFileName(rawAuthor) || '未署名';
        let folderName = baseName;
        let suffix = 1;
        while (usedFolderNames.has(folderName)) {
          suffix += 1;
          folderName = `${baseName}_${suffix}`;
        }
        usedFolderNames.add(folderName);

        const folder = zip.folder(folderName);
        if (!folder) return;

        const docText =
          memory.type === 'photo'
            ? (memory.description || '')
            : memory.type === 'text'
              ? (memory.content || '')
              : '（音訊投稿）';
        folder.file(`${baseName}.doc`, buildDocContent(docText));

        if (memory.type === 'photo' || memory.type === 'audio') {
          try {
            const response = await fetch(memory.content);
            let blob = await response.blob();
            const fallbackExt = memory.type === 'photo' ? 'jpg' : 'webm';
            let ext = getFileExtension(blob.type, fallbackExt);
            
            // 如果是圖片且不是 jpg，轉換為 jpg
            if (memory.type === 'photo' && (blob.type.includes('webp') || blob.type.includes('png'))) {
              try {
                blob = await convertToJpg(blob);
                ext = 'jpg';
              } catch (convertErr) {
                console.error(`Failed to convert image for ${memory.id}`, convertErr);
              }
            }
            
            folder.file(`${baseName}.${ext}`, blob);
          } catch (err) {
            console.error(`Failed to download asset for ${memory.id}`, err);
          }
        }
      });

      await Promise.all(tasks);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `say_memories_${new Date().toISOString().slice(0,10)}.zip`);
    } catch (error) {
      console.error("Error creating zip:", error);
      alert("下載失敗");
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadCSV = () => {
    // Define headers
    const headers = [
      "編號",
      "時間",
      "類型",
      "姓名",
      "電話",
      "Email",
      "內容/描述",
      "檔案連結",
      "狀態"
    ];

    // Convert data to CSV rows
    const rows = memories.map((m, index) => [
      index + 1,
      new Date(m.timestamp).toLocaleString('zh-TW'),
      m.type === 'photo' ? '照片' : m.type === 'audio' ? '聲音' : '文字',
      `"${(m.author || '').replace(/"/g, '""')}"`,
      `"${formatPhoneNumber(m.phone || '').replace(/"/g, '""')}"`,
      `"${(m.email || '').replace(/"/g, '""')}"`,
      `"${(m.type === 'photo' ? m.description || '' : m.content || '').replace(/"/g, '""')}"`,
      m.type !== 'text' ? m.content : '',
      m.deleted ? '已刪除' : '正常'
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Add BOM for Excel compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `say_memories_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-[100px]" />
        </div>

        <form onSubmit={handleLogin} className="relative z-10 w-full max-w-md p-10 rounded-3xl border border-white/10 space-y-8 backdrop-blur-xl bg-white/5 shadow-2xl">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
              <Lock className="text-white/80" size={28} />
            </div>
            <h1 className="text-2xl text-white font-light tracking-[0.1em]">管理員登入</h1>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入密碼"
                className="w-full bg-black/20 border border-white/10 rounded-full px-6 py-4 text-white text-center tracking-[0.5em] outline-none focus:border-white/30 focus:bg-black/40 transition-all placeholder:tracking-widest placeholder:text-white/20"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-white text-black py-4 rounded-full tracking-[0.1em] hover:bg-white/90 transition-all font-light text-s shadow-lg shadow-white/5"
            >
              登入
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-light tracking-widest">投稿資料管理</h1>
          <div className="flex gap-4 flex-wrap justify-center">
            <a
              href="/admin/rsvp"
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-s tracking-wide border border-zinc-600"
            >
              報名管理
            </a>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-s tracking-wide"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              重新整理
            </button>
            <button
              onClick={downloadMemoriesZip}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-s tracking-wide disabled:opacity-50"
            >
              <Download size={16} className={isDownloading ? 'animate-pulse' : ''} />
              {isDownloading ? '打包中...' : '下載投稿 ZIP'}
            </button>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors text-s tracking-wide"
            >
              <Download size={16} />
              匯出 CSV
            </button>
          </div>
        </header>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto border border-white/10 rounded-xl bg-zinc-900/50">
          <table className="w-full text-s text-left">
            <thead className="text-xs text-white-400 uppercase bg-zinc-900/80 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">編號</th>
                <th className="px-6 py-4 whitespace-nowrap">時間</th>
                <th className="px-6 py-4 whitespace-nowrap">姓名</th>
                <th className="px-6 py-4 whitespace-nowrap">聯絡方式</th>
                <th className="px-6 py-4 whitespace-nowrap">類型</th>
                <th className="px-6 py-4 min-w-[300px]">內容</th>
                <th className="px-6 py-4 whitespace-nowrap">狀態</th>
                <th className="px-6 py-4 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {memories.map((memory, index) => (
                <tr key={memory.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-white-500 font-mono text-xs">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white-400">
                    {new Date(memory.timestamp).toLocaleString('zh-TW')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {memory.author}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap space-y-1">
                    {memory.phone && (
                      <div className="text-xs text-white-300">
                        <span className="text-white-500 mr-2">TEL</span>
                        {formatPhoneNumber(memory.phone)}
                      </div>
                    )}
                    {memory.email && (
                      <div className="text-xs text-white-300">
                        <span className="text-white-500 mr-2">MAIL</span>
                        {memory.email}
                      </div>
                    )}
                    {!memory.phone && !memory.email && <span className="text-white-600">-</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs ${
                      memory.type === 'photo' ? 'bg-blue-500/20 text-blue-300' :
                      memory.type === 'audio' ? 'bg-purple-500/20 text-purple-300' :
                      'bg-green-500/20 text-green-300'
                    }`}>
                      {memory.type === 'photo' ? '照片' : memory.type === 'audio' ? '聲音' : '文字'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      {memory.type === 'photo' && (
                        <div className="flex items-start gap-3">
                          <button 
                            onClick={() => setSelectedImage(memory.content)}
                            className="shrink-0 w-16 h-16 bg-black rounded border border-white/10 overflow-hidden hover:opacity-80 transition-opacity cursor-zoom-in"
                          >
                            <img src={memory.content} alt="thumbnail" className="w-full h-full object-cover" />
                          </button>
                          <p className="text-white-300 line-clamp-3">{memory.description}</p>
                        </div>
                      )}
                      {memory.type === 'text' && (
                        <p className="text-white-300 line-clamp-3">{memory.content}</p>
                      )}
                      {memory.type === 'audio' && (
                        <div className="flex items-center gap-2">
                          <audio controls src={memory.content} className="h-8 w-48" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {memory.deleted ? (
                      <span className="text-red-500 text-xs">已刪除</span>
                    ) : (
                      <span className="text-green-500 text-xs">正常</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(memory.id)}
                      className="p-2 text-white-400 hover:text-red-500 transition-colors"
                      title="刪除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {memories.map((memory, index) => (
            <div key={memory.id} className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-white-500">#{index + 1}</span>
                    <span className="font-medium text-white">{memory.author}</span>
                    <span className={`px-2 py-0.5 rounded text-[13px] ${
                      memory.type === 'photo' ? 'bg-blue-500/20 text-blue-300' :
                      memory.type === 'audio' ? 'bg-purple-500/20 text-purple-300' :
                      'bg-green-500/20 text-green-300'
                    }`}>
                      {memory.type === 'photo' ? '照片' : memory.type === 'audio' ? '聲音' : '文字'}
                    </span>
                  </div>
                  <div className="text-xs text-white-400">
                    {new Date(memory.timestamp).toLocaleString('zh-TW')}
                  </div>
                </div>
                {memory.deleted ? (
                  <span className="text-red-500 text-xs">已刪除</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-xs">正常</span>
                    <button
                      onClick={() => handleDelete(memory.id)}
                      className="p-1 text-white-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 bg-black/20 rounded-lg p-3">
                {memory.type === 'photo' && (
                  <div className="space-y-2">
                    <button 
                      onClick={() => setSelectedImage(memory.content)}
                      className="block w-full aspect-video bg-black rounded border border-white/10 overflow-hidden"
                    >
                      <img src={memory.content} alt="thumbnail" className="w-full h-full object-cover" />
                    </button>
                    <p className="text-s text-white-300">{memory.description}</p>
                  </div>
                )}
                {memory.type === 'text' && (
                  <p className="text-s text-white-300">{memory.content}</p>
                )}
                {memory.type === 'audio' && (
                  <audio controls src={memory.content} className="w-full h-8" />
                )}
              </div>

              <div className="text-xs border-t border-white/5 pt-3">
                <span className="text-white-500">聯絡方式</span>
                <div className="text-white-300 mt-2">
                  {memory.phone && <div>{formatPhoneNumber(memory.phone)}</div>}
                  {memory.email && <div className="truncate">{memory.email}</div>}
                  {!memory.phone && !memory.email && <div>-</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors z-10 bg-black/50 rounded-full"
            >
              <X size={24} />
            </button>
            <img src={selectedImage} alt="Full size" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl w-full max-w-md p-8 space-y-6 relative backdrop-blur-xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-light tracking-widest text-white">確認刪除</h3>
              <p className="text-s text-white-400 tracking-wide">此動作無法復原，請輸入密碼確認。</p>
            </div>
            
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="請輸入密碼"
              className="w-full bg-black/40 border border-white/10 rounded-full px-6 py-3 text-white text-center tracking-[0.5em] outline-none focus:border-white/30 transition-all placeholder:tracking-widest placeholder:text-white/20"
              autoFocus
            />

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-3 border border-white/10 rounded-full text-s tracking-widest text-white-400 hover:bg-white/5 transition-all"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="w-full py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-s tracking-widest hover:bg-red-500/20 transition-all"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
