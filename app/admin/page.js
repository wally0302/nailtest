// app/admin/page.js
'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import liff from '@line/liff';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

// 初始化 Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 防止重複初始化 Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.warn("Firebase already initialized?");
  // 在 Next.js 的快速刷新(Fast Refresh)開發模式下，可能會嘗試重複初始化
  // 可以考慮使用 getApps().length === 0 來判斷是否需要初始化
  // import { getApps } from 'firebase/app';
  // if (getApps().length === 0) { app = initializeApp(firebaseConfig); }
}
const db = getFirestore(app);


export default function Admin() {
  const [userProfile, setUserProfile] = useState(null);
  const [pendingAppointments, setPendingAppointments] = useState([]);
  const [completedAppointments, setCompletedAppointments] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [sortOrder, setSortOrder] = useState('desc'); // 預設降序
  const [loading, setLoading] = useState(true); // 初始設為 true
  const [debugTapCount, setDebugTapCount] = useState(0); // 新增：除錯用的計數器

  // 初始化 LIFF 並獲取用戶資訊
  const initializeLiff = async () => {
    setError(null);
    try {
      console.log("Initializing LIFF...");
      await liff.init({ liffId: '2007124985-JOZyYjrA' }); // 替換成你的 LIFF ID
      console.log("LIFF initialized.");

      if (!liff.isLoggedIn()) {
        console.log("User not logged in. Redirecting to login...");
        setLoading(false);
        liff.login();
        return;
      }

      console.log("User is logged in. Getting profile...");
      const profile = await liff.getProfile();
      console.log("Profile fetched:", profile);
      setUserProfile(profile);
      // Fetch appointments after profile is loaded
      console.log("Fetching appointments...");
      fetchAppointments();

    } catch (error) {
      console.error('LIFF Initialization or Profile Fetch Failed:', error);
      setError('無法載入用戶資訊或初始化失敗，請重新整理頁面。');
      setLoading(false);
    }
  };

  // 從 Firestore 抓取預約資料
  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    console.log(`Workspaceing appointments with sort order: ${sortOrder}`); // Log current sort order perspective
    try {
      const baseConditions = [where('nailArtistId', '==', 'artist_001')]; // TODO: Make dynamic?

      const pendingQuery = query(collection(db, 'appointments'), ...baseConditions, where('status', '==', 'pending'));
      const completedQuery = query(collection(db, 'appointments'), ...baseConditions, where('status', '==', 'completed'));

      const [pendingSnapshot, completedSnapshot] = await Promise.all([
          getDocs(pendingQuery),
          getDocs(completedQuery)
      ]);

      const pendingList = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const completedList = completedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`Workspaceed ${pendingList.length} pending, ${completedList.length} completed.`);

      // Client-side sorting function
      const sortByDate = (list, order) => {
        // console.log(`Sorting list with ${list.length} items, order: ${order}`); // Verbose logging if needed
        return [...list].sort((a, b) => {
          const dateA = new Date(a.date?.split('/').join('-'));
          const dateB = new Date(b.date?.split('/').join('-'));
          if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
          if (isNaN(dateA.getTime())) return 1;
          if (isNaN(dateB.getTime())) return -1;
          return order === 'desc' ? dateB - dateA : dateA - dateB;
        });
      };

      setPendingAppointments(sortByDate(pendingList, sortOrder));
      setCompletedAppointments(sortByDate(completedList, sortOrder));
      console.log("Appointments state updated after fetch.");

    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      setError('無法載入預約資料，請稍後再試。');
    } finally {
      setLoading(false);
      console.log("Finished fetching/processing appointments.");
    }
  };

  // 將預約狀態從 pending 更改為 completed
  const completeAppointment = async (appointmentId) => {
    if (!appointmentId) return;
    console.log(`Completing appointment ID: ${appointmentId}`);
    // Optional: Add specific loading state for this button
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, { status: 'completed' });
      console.log("Appointment status updated in Firestore.");
      alert('預約已標記為已完成！');
      // Re-fetch data to reflect the change
      fetchAppointments(); // Consider local update for better UX later
    } catch (error) {
      console.error('Failed to update appointment status:', error);
      alert('無法更新預約狀態，請稍後再試。');
    }
  };

  // 切換排序順序（客戶端排序）
  const toggleSortOrder = () => {
     console.log('--- Toggle Sort Button Clicked ---');
     setDebugTapCount(prev => prev + 1); // **增加計數器**
     const newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
     console.log(`Changing sortOrder state from ${sortOrder} to ${newSortOrder}`);
     setSortOrder(newSortOrder); // **更新排序狀態**

     // 排序函數 (與 fetchAppointments 中使用的相同)
     const sortByDate = (list, order) => {
        console.log(`Re-sorting ${list.length} items based on new order: ${order}`);
        return [...list].sort((a, b) => {
          const dateA = new Date(a.date?.split('/').join('-'));
          const dateB = new Date(b.date?.split('/').join('-'));
          if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
          if (isNaN(dateA.getTime())) return 1;
          if (isNaN(dateB.getTime())) return -1;
          return order === 'desc' ? dateB - dateA : dateA - dateB;
        });
      };

     // **直接基於前一個狀態來更新排序後的列表狀態**
     console.log("Updating pendingAppointments state...");
     setPendingAppointments(prev => {
         const sorted = sortByDate([...prev], newSortOrder); // 使用函數式更新確保基於最新狀態
         console.log("Pending list sorted. First item date (if any):", sorted[0]?.date);
         return sorted;
     });
     console.log("Updating completedAppointments state...");
     setCompletedAppointments(prev => {
         const sorted = sortByDate([...prev], newSortOrder);
         console.log("Completed list sorted. First item date (if any):", sorted[0]?.date);
         return sorted;
     });
     console.log('--- Sort Toggle Finished ---');
   };

  // 格式化日期 (YYYY/MM/DD -> YYYY年M月D日)
  const formatDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return '無效日期';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '格式錯誤';
    const year = Number(parts[0]); const month = Number(parts[1]); const day = Number(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) return '日期解析錯誤';
    return `${year}年${month}月${day}日`;
  };

  // Effect hook for initialization
  useEffect(() => {
    initializeLiff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount

  // --- JSX Structure ---
  return (
    <div className="flex min-h-screen flex-col items-center p-4 bg-pink-50 font-sans">
      <Head>
        <title>美甲師後台 | LINE 美甲</title>
        <meta name="description" content="美甲師後台管理頁面" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="max-w-md w-full bg-white rounded-lg shadow-xl p-6 my-8 relative"> {/* Added relative for potential future absolute positioning */}
        <h1 className="text-3xl font-bold text-center text-pink-600 mb-6">美甲師後台</h1>

        {/* User Profile Section */}
        {!loading && userProfile ? (
          <div className="text-center mb-6 border-b pb-4">
            <img
              src={userProfile.pictureUrl || '/default-avatar.png'} alt="頭貼"
              className="w-20 h-20 rounded-full mx-auto mb-2 border-2 border-pink-200"
              onError={(e) => { e.target.onerror = null; e.target.src='/default-avatar.png'; }}
            />
            <p className="text-xl font-semibold text-gray-800">歡迎，{userProfile.displayName || '使用者'}！</p>
          </div>
        ) : loading ? (
          <div className="text-center mb-6 pb-4">
             <div className="animate-pulse flex flex-col items-center space-y-2">
                <div className="w-20 h-20 rounded-full bg-gray-300"></div><div className="h-4 bg-gray-300 rounded w-3/4"></div>
             </div><p className="text-center text-gray-600 mt-2">正在載入用戶資訊...</p>
          </div>
        ) : null }

        {/* Display Initialization Error */}
        {error && !userProfile && (
             <p className="text-center text-red-600 bg-red-100 p-3 rounded border border-red-300 mb-4">{error}</p>
        )}


        {/* --- 除錯資訊顯示區塊 --- */}
        <div className="my-4 p-3 border-2 border-dashed border-red-500 bg-red-50 text-red-800 text-xs rounded-md shadow-inner">
           <p className="font-bold mb-1 text-sm">[除錯資訊]</p>
           <p>按鈕點擊次數: <span className="font-semibold text-lg">{debugTapCount}</span></p>
           <p>目前排序順序 (State): <span className="font-semibold">{sortOrder}</span></p>
           <p>待處理數量 (State): <span className="font-semibold">{pendingAppointments.length}</span></p>
           {/* 顯示第一筆資料的日期，注意要檢查列表是否為空 */}
           <p>第一筆待處理日期 (若有): <span className="font-semibold">{pendingAppointments[0]?.date || 'N/A'}</span></p>
           <p>第一筆已完成日期 (若有): <span className="font-semibold">{completedAppointments[0]?.date || 'N/A'}</span></p>
        </div>
        {/* --- 除錯資訊結束 --- */}


        {/* Show Tabs and Content only if user profile exists */}
        {userProfile && (
          <>
            {/* Tab Navigation */}
            <div className="flex justify-center mb-6 border-b">
              <button
                className={`flex-1 py-3 text-center font-medium transition-colors border-b-4 ${ activeTab === 'pending' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`}
                onClick={() => setActiveTab('pending')} >
                待處理 ({!loading ? pendingAppointments.length : '...'})
              </button>
              <button
                className={`flex-1 py-3 text-center font-medium transition-colors border-b-4 ${ activeTab === 'completed' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`}
                onClick={() => setActiveTab('completed')} >
                已完成 ({!loading ? completedAppointments.length : '...'})
              </button>
            </div>

            {/* Sort Button */}
            <div className="flex justify-end mb-4">
              <button
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 active:bg-indigo-700 transition-colors text-sm shadow disabled:opacity-50"
                onPointerUp={toggleSortOrder} // 保持使用 onPointerUp
                disabled={loading || (!pendingAppointments.length && !completedAppointments.length)} >
                按日期排序 ({sortOrder === 'desc' ? '最新優先' : '最早優先'})
              </button>
            </div>

            {/* Appointments List Section */}
            <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">
              {activeTab === 'pending' ? '待處理預約' : '已完成預約'}
            </h2>

            {/* Loading Indicator */}
            {loading && ( <div className="flex justify-center items-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div><p className="ml-3 text-gray-600">載入中...</p></div> )}

            {/* Error Display for Fetching */}
            {!loading && error && activeTab === 'pending' && (<p className="text-center text-red-600 bg-red-100 p-3 rounded border border-red-300">{error}</p>)}
            {!loading && error && activeTab === 'completed' && (<p className="text-center text-red-600 bg-red-100 p-3 rounded border border-red-300">{error}</p>)}


            {/* Pending Appointments List */}
            {!loading && !error && activeTab === 'pending' && (
              pendingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {pendingAppointments.map((appointment) => (
                    <div key={appointment.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
                      {/* ... (內容同前，顯示姓名、日期、時間等) ... */}
                      <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-sm">
                         <span className="font-medium text-gray-600 col-span-1">姓名:</span><span className="text-gray-900 col-span-2">{appointment.name || '-'}</span>
                         <span className="font-medium text-gray-600 col-span-1">日期:</span><span className="text-gray-900 col-span-2">{formatDate(appointment.date)}</span>
                         <span className="font-medium text-gray-600 col-span-1">時間:</span><span className="text-gray-900 col-span-2">{appointment.time || '-'}</span>
                         <span className="font-medium text-gray-600 col-span-1">聯絡:</span><span className="text-gray-900 col-span-2 break-words">{appointment.contact || '-'}</span>
                         <span className="font-medium text-gray-600 col-span-1">狀態:</span><span className="col-span-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-yellow-500">待處理</span></span>
                      </div>
                      {appointment.imageUrl && ( <div className="mt-3 pt-3 border-t border-gray-100"><span className="font-medium text-gray-600 text-sm block mb-1">參考圖:</span><img src={appointment.imageUrl} alt="預約參考圖" className="w-full max-h-60 object-contain rounded border border-gray-200 bg-gray-50" loading="lazy"/></div> )}
                      <button className="mt-4 w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 transition-colors text-sm shadow" onClick={() => completeAppointment(appointment.id)} >標記為已完成</button>
                    </div>
                  ))}
                </div>
              ) : ( <p className="text-center text-gray-500 py-6">目前沒有待處理的預約。</p> )
            )}

            {/* Completed Appointments List */}
            {!loading && !error && activeTab === 'completed' && (
              completedAppointments.length > 0 ? (
                <div className="space-y-4">
                  {completedAppointments.map((appointment) => (
                    <div key={appointment.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 opacity-80">
                      {/* ... (內容同前，顯示姓名、日期、時間等) ... */}
                       <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-sm">
                         <span className="font-medium text-gray-500 col-span-1">姓名:</span><span className="text-gray-700 col-span-2">{appointment.name || '-'}</span>
                         <span className="font-medium text-gray-500 col-span-1">日期:</span><span className="text-gray-700 col-span-2">{formatDate(appointment.date)}</span>
                         <span className="font-medium text-gray-500 col-span-1">時間:</span><span className="text-gray-700 col-span-2">{appointment.time || '-'}</span>
                         <span className="font-medium text-gray-500 col-span-1">聯絡:</span><span className="text-gray-700 col-span-2 break-words">{appointment.contact || '-'}</span>
                         <span className="font-medium text-gray-500 col-span-1">狀態:</span><span className="col-span-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-green-500">已完成</span></span>
                      </div>
                      {appointment.imageUrl && ( <div className="mt-3 pt-3 border-t border-gray-100"><span className="font-medium text-gray-500 text-sm block mb-1">參考圖:</span><img src={appointment.imageUrl} alt="預約參考圖" className="w-full max-h-60 object-contain rounded border border-gray-200 bg-gray-100" loading="lazy"/></div> )}
                    </div>
                  ))}
                </div>
              ) : ( <p className="text-center text-gray-500 py-6">目前沒有已完成的預約。</p> )
            )}
          </>
        )}
      </main>
    </div>
  );
}