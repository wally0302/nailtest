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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function Admin() {
  const [userProfile, setUserProfile] = useState(null);
  const [pendingAppointments, setPendingAppointments] = useState([]);
  const [completedAppointments, setCompletedAppointments] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [sortOrder, setSortOrder] = useState('desc'); // 預設降序（最近的日期在前）
  const [loading, setLoading] = useState(true); // 初始設為 true

  // 初始化 LIFF 並獲取用戶資訊
  const initializeLiff = async () => {
    setError(null); // Clear previous errors on init
    try {
      // TODO: Consider moving LIFF ID to environment variable
      await liff.init({ liffId: '2007124985-JOZyYjrA' });

      if (!liff.isLoggedIn()) {
        // Not logged in, attempt login. setLoading(false) might be needed if login fails often.
        setLoading(false); // Stop loading indicator if we redirect to login
        liff.login();
        return; // Stop execution until login completes and page reloads
      }

      const profile = await liff.getProfile();
      setUserProfile(profile);
      // Fetch appointments only after confirming login and getting profile
      // setLoading will be handled within fetchAppointments
      fetchAppointments();
    } catch (error) {
      console.error('LIFF Initialization Failed:', error);
      setError('無法載入用戶資訊或初始化失敗，請重新整理頁面或稍後再試。');
      setLoading(false); // Stop loading on error
    }
  };

  // 從 Firestore 抓取預約資料
  const fetchAppointments = async () => {
    setLoading(true); // 開始載入
    setError(null); // Clear previous errors
    try {
      // Define base query conditions
      const baseConditions = [
        where('nailArtistId', '==', 'artist_001') // Consider making artistId dynamic if needed
      ];

      // Fetch pending appointments
      const pendingQuery = query(
        collection(db, 'appointments'),
        ...baseConditions,
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      const pendingList = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch completed appointments
      const completedQuery = query(
        collection(db, 'appointments'),
        ...baseConditions,
        where('status', '==', 'completed')
      );
      const completedSnapshot = await getDocs(completedQuery);
      const completedList = completedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Client-side sorting function (handles potential invalid dates)
      const sortByDate = (list, order) => {
        return [...list].sort((a, b) => {
          const dateA = new Date(a.date?.split('/').join('-'));
          const dateB = new Date(b.date?.split('/').join('-'));
          if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
          if (isNaN(dateA.getTime())) return 1;
          if (isNaN(dateB.getTime())) return -1;
          return order === 'desc' ? dateB - dateA : dateA - dateB;
        });
      };

      // Apply initial sort based on current sortOrder state
      setPendingAppointments(sortByDate(pendingList, sortOrder));
      setCompletedAppointments(sortByDate(completedList, sortOrder));

    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      setError('無法載入預約資料，請檢查網路連線或稍後再試。');
    } finally {
      setLoading(false); // 結束載入
    }
  };

  // 將預約狀態從 pending 更改為 completed
  const completeAppointment = async (appointmentId) => {
    if (!appointmentId) {
      console.error('Invalid appointment ID');
      alert('操作失敗，無效的預約 ID。');
      return;
    }
    // Optional: Add loading state specific to this action
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, {
        status: 'completed',
      });

      // Re-fetch data to reflect the change immediately
      await fetchAppointments(); // Consider local state update for performance

      alert('預約已標記為已完成！');
    } catch (error) {
      console.error('Failed to update appointment status:', error);
      alert('無法更新預約狀態，請稍後再試。');
    }
  };

  // 切換排序順序（客戶端排序）
  // *** 使用 useCallback 確保函數引用穩定，雖然在此場景影響不大，但是好習慣 ***
  // *** 函數內容不變，但會由 onPointerUp 觸發 ***
  const toggleSortOrder = () => {
     console.log('Toggling sort order...'); // 添加日誌以確認函數被調用
    const newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newSortOrder);

    // Client-side sorting function
    const sortByDate = (list, order) => {
        return [...list].sort((a, b) => {
          const dateA = new Date(a.date?.split('/').join('-'));
          const dateB = new Date(b.date?.split('/').join('-'));
          if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
          if (isNaN(dateA.getTime())) return 1;
          if (isNaN(dateB.getTime())) return -1;
          return order === 'desc' ? dateB - dateA : dateA - dateB;
        });
      };

    // Re-sort existing data in state using the new order
    setPendingAppointments(prev => sortByDate(prev, newSortOrder));
    setCompletedAppointments(prev => sortByDate(prev, newSortOrder));
    console.log('Sort order toggled to:', newSortOrder); // 確認狀態更新
  };


  // 格式化日期 (YYYY/MM/DD -> YYYY年M月D日)
  const formatDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return '無效日期';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '格式錯誤';
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return '無效日期';
    return `${year}年${month}月${day}日`;
  };

  // 登出功能已移除 (handleLogout function removed)

  // Effect hook for initialization
  useEffect(() => {
    console.log("Admin page mounted, initializing LIFF...");
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

      <main className="max-w-md w-full bg-white rounded-lg shadow-xl p-6 my-8">
        <h1 className="text-3xl font-bold text-center text-pink-600 mb-6">美甲師後台</h1>

        {/* User Profile Section */}
        {!loading && userProfile ? ( // Show profile only when not loading AND profile exists
          <div className="text-center mb-6 border-b pb-4">
            <img
              src={userProfile.pictureUrl || '/default-avatar.png'}
              alt="頭貼"
              className="w-20 h-20 rounded-full mx-auto mb-2 border-2 border-pink-200"
              onError={(e) => { e.target.onerror = null; e.target.src='/default-avatar.png'; }}
            />
            <p className="text-xl font-semibold text-gray-800">
              歡迎，{userProfile.displayName || '使用者'}！
            </p>
          </div>
        ) : loading ? ( // Show loading skeleton ONLY when loading
          <div className="text-center mb-6 pb-4">
             <div className="animate-pulse flex flex-col items-center space-y-2">
                <div className="w-20 h-20 rounded-full bg-gray-300"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
             </div>
             <p className="text-center text-gray-600 mt-2">正在載入用戶資訊...</p>
          </div>
        ) : null } {/* Don't show profile section if not loading and no profile (e.g., init error before fetch) */}


        {/* Display Initialization Error */}
        {error && !userProfile && ( // Show error only if it occurred and profile wasn't loaded
             <p className="text-center text-red-600 bg-red-100 p-3 rounded border border-red-300 mb-4">{error}</p>
        )}


        {/* 登出按鈕已被移除 */}


        {/* Show Tabs and Content only if logged in successfully */}
        {userProfile && ( // Render main content only if user profile exists
          <>
            {/* Tab Navigation */}
            <div className="flex justify-center mb-6 border-b">
              <button
                className={`flex-1 py-3 text-center font-medium transition-colors border-b-4 ${
                  activeTab === 'pending'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('pending')}
              >
                待處理 ({!loading ? pendingAppointments.length : '...'}) {/* Show count or indicator */}
              </button>
              <button
                className={`flex-1 py-3 text-center font-medium transition-colors border-b-4 ${
                  activeTab === 'completed'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('completed')}
              >
                已完成 ({!loading ? completedAppointments.length : '...'}) {/* Show count or indicator */}
              </button>
            </div>

            {/* Sort Button - 使用 onPointerUp */}
            <div className="flex justify-end mb-4">
              <button
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 active:bg-indigo-700 transition-colors text-sm shadow"
                // *** 改用 onPointerUp ***
                onPointerUp={toggleSortOrder}
                // onClick={toggleSortOrder} // 可以移除或保留 onClick 作為備用，但優先使用 onPointerUp
                disabled={loading || (!pendingAppointments.length && !completedAppointments.length)} // Disable if loading or no data
              >
                按日期排序 ({sortOrder === 'desc' ? '最新優先' : '最早優先'})
              </button>
            </div>

            {/* Appointments List Section */}
            <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">
              {activeTab === 'pending' ? '待處理預約' : '已完成預約'}
            </h2>

            {/* Loading Indicator */}
            {loading && (
              <div className="flex justify-center items-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
                <p className="ml-3 text-gray-600">載入中...</p>
              </div>
            )}

            {/* Error Display for Fetching */}
            {!loading && error && (
              <p className="text-center text-red-600 bg-red-100 p-3 rounded border border-red-300">{error}</p>
            )}

            {/* Pending Appointments List */}
            {!loading && !error && activeTab === 'pending' && (
              pendingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {pendingAppointments.map((appointment) => (
                    <div key={appointment.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-sm">
                         <span className="font-medium text-gray-600 col-span-1">姓名:</span>
                         <span className="text-gray-900 col-span-2">{appointment.name || '-'}</span>
                         <span className="font-medium text-gray-600 col-span-1">日期:</span>
                         <span className="text-gray-900 col-span-2">{formatDate(appointment.date)}</span>
                         <span className="font-medium text-gray-600 col-span-1">時間:</span>
                         <span className="text-gray-900 col-span-2">{appointment.time || '-'}</span>
                         <span className="font-medium text-gray-600 col-span-1">聯絡:</span>
                         <span className="text-gray-900 col-span-2 break-words">{appointment.contact || '-'}</span>
                         <span className="font-medium text-gray-600 col-span-1">狀態:</span>
                         <span className="col-span-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-yellow-500">待處理</span>
                         </span>
                      </div>
                      {appointment.imageUrl && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <span className="font-medium text-gray-600 text-sm block mb-1">參考圖:</span>
                          <img src={appointment.imageUrl} alt="預約參考圖" className="w-full max-h-60 object-contain rounded border border-gray-200 bg-gray-50" loading="lazy" />
                        </div>
                      )}
                      <button
                        className="mt-4 w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 transition-colors text-sm shadow"
                        onClick={() => completeAppointment(appointment.id)} // Mark complete still uses onClick
                      >
                        標記為已完成
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-6">目前沒有待處理的預約。</p>
              )
            )}

            {/* Completed Appointments List */}
            {!loading && !error && activeTab === 'completed' && (
              completedAppointments.length > 0 ? (
                <div className="space-y-4">
                  {completedAppointments.map((appointment) => (
                    <div key={appointment.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 opacity-80">
                       <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-sm">
                         <span className="font-medium text-gray-500 col-span-1">姓名:</span>
                         <span className="text-gray-700 col-span-2">{appointment.name || '-'}</span>
                         <span className="font-medium text-gray-500 col-span-1">日期:</span>
                         <span className="text-gray-700 col-span-2">{formatDate(appointment.date)}</span>
                         <span className="font-medium text-gray-500 col-span-1">時間:</span>
                         <span className="text-gray-700 col-span-2">{appointment.time || '-'}</span>
                         <span className="font-medium text-gray-500 col-span-1">聯絡:</span>
                         <span className="text-gray-700 col-span-2 break-words">{appointment.contact || '-'}</span>
                         <span className="font-medium text-gray-500 col-span-1">狀態:</span>
                         <span className="col-span-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-green-500">已完成</span>
                         </span>
                      </div>
                      {appointment.imageUrl && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                           <span className="font-medium text-gray-500 text-sm block mb-1">參考圖:</span>
                           <img src={appointment.imageUrl} alt="預約參考圖" className="w-full max-h-60 object-contain rounded border border-gray-200 bg-gray-100" loading="lazy" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-6">目前沒有已完成的預約。</p>
              )
            )}
          </>
        )} {/* End of userProfile check for main content */}

      </main>
    </div>
  );
}