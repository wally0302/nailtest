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
  const [loading, setLoading] = useState(false); // 新增載入狀態

  // 初始化 LIFF 並獲取用戶資訊
  const initializeLiff = async () => {
    try {
      // TODO: Consider moving LIFF ID to environment variable
      await liff.init({ liffId: '2007124985-JOZyYjrA' });

      if (!liff.isLoggedIn()) {
        liff.login();
        return; // Stop execution until login completes and page reloads
      }

      const profile = await liff.getProfile();
      setUserProfile(profile);
      // Fetch appointments only after confirming login and getting profile
      fetchAppointments();
    } catch (error) {
      console.error('LIFF Initialization Failed:', error);
      setError('無法載入用戶資訊或初始化失敗，請重新整理頁面或稍後再試。');
      // Optionally display a more user-friendly message instead of alert
      // alert('無法載入用戶資訊，請稍後再試');
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
          // Use a more robust parsing method if necessary, but YYYY-MM-DD is generally reliable
          const dateA = new Date(a.date?.split('/').join('-')); // Add optional chaining for safety
          const dateB = new Date(b.date?.split('/').join('-'));

          // Handle invalid dates gracefully
          if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
          if (isNaN(dateA.getTime())) return 1; // Put invalid dates at the end
          if (isNaN(dateB.getTime())) return -1; // Put invalid dates at the end

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
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, {
        status: 'completed',
      });

      // Re-fetch data to reflect the change immediately
      // Or update state locally for better performance:
      // setPendingAppointments(prev => prev.filter(app => app.id !== appointmentId));
      // setCompletedAppointments(prev => [...prev, updatedAppointmentData]); // Need the full data here
      // Fetching is simpler for now
      await fetchAppointments();

      alert('預約已標記為已完成！');
    } catch (error) {
      console.error('Failed to update appointment status:', error);
      alert('無法更新預約狀態，請稍後再試。');
    }
  };

  // 切換排序順序（客戶端排序）
  const toggleSortOrder = () => {
    const newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newSortOrder);

    // Client-side sorting function (reusable or define here)
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

    // Re-sort existing data in state
    setPendingAppointments(prev => sortByDate(prev, newSortOrder));
    setCompletedAppointments(prev => sortByDate(prev, newSortOrder));
  };

  // 格式化日期 (YYYY/MM/DD -> YYYY年M月D日)
  const formatDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return '無效日期';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '格式錯誤';
    // Use Number() for slightly cleaner parsing than parseInt() here
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return '無效日期';

    return `${year}年${month}月${day}日`;
  };

  // 登出功能
  const handleLogout = () => {
    if (liff.isLoggedIn()) {
      liff.logout();
      // Optional: Redirect or clear state immediately
      setUserProfile(null);
      setPendingAppointments([]);
      setCompletedAppointments([]);
      // Reloading might be necessary if login flow relies on it
      window.location.reload();
    } else {
       // Handle case where logout is clicked but user isn't logged in (e.g., during init error)
       console.warn("Logout attempted but LIFF reports not logged in.");
       window.location.reload(); // Still reload to potentially retry init
    }
  };

  // Effect hook for initialization
  useEffect(() => {
    initializeLiff();
    // fetchAppointments is now called inside initializeLiff after profile is confirmed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs once on mount

  // --- JSX Structure ---
  return (
    <div className="flex min-h-screen flex-col items-center p-4 bg-pink-50 font-sans"> {/* Added font-sans for consistency */}
      <Head>
        <title>美甲師後台 | LINE 美甲</title>
        <meta name="description" content="美甲師後台管理頁面" />
        {/* Consider adding viewport meta tag for mobile responsiveness */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="max-w-md w-full bg-white rounded-lg shadow-xl p-6 my-8"> {/* Increased shadow */}
        <h1 className="text-3xl font-bold text-center text-pink-600 mb-6">美甲師後台</h1>

        {/* User Profile Section */}
        {userProfile ? (
          <div className="text-center mb-6 border-b pb-4"> {/* Added border */}
            <img
              src={userProfile.pictureUrl || '/default-avatar.png'} // Provide a fallback avatar
              alt="頭貼"
              className="w-20 h-20 rounded-full mx-auto mb-2 border-2 border-pink-200" // Slightly larger, added border
              onError={(e) => { e.target.onerror = null; e.target.src='/default-avatar.png'; }} // Handle image load error
            />
            <p className="text-xl font-semibold text-gray-800">
              歡迎，{userProfile.displayName || '使用者'}！ {/* Fallback name */}
            </p>
            {/* Optional: Display User ID for debugging */}
            {/* <p className="text-xs text-gray-500 mt-1">User ID: {userProfile.userId}</p> */}
          </div>
        ) : !error && ( // Only show loading if no error occurred during init
          <div className="text-center mb-6 pb-4">
             <div className="animate-pulse flex flex-col items-center space-y-2"> {/* Loading Skeleton */}
                <div className="w-20 h-20 rounded-full bg-gray-300"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
             </div>
             <p className="text-center text-gray-600 mt-2">正在載入用戶資訊...</p>
          </div>
        )}

        {/* Display Initialization Error */}
        {error && !userProfile && (
             <p className="text-center text-red-600 bg-red-100 p-3 rounded border border-red-300 mb-4">{error}</p>
        )}


        {/* Navigation Buttons - Only show if logged in */}
        {userProfile && (
            <div className="flex justify-between items-center mb-6">
              {/* Link to customer page might need different logic depending on setup */}
              {/* <a href="/" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                前往預約頁
              </a> */}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm transition-colors"
              >
                登出
              </button>
            </div>
        )}


        {/* Show Tabs and Content only if logged in successfully */}
        {userProfile && (
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
                待處理 ({pendingAppointments.length}) {/* Show count */}
              </button>
              <button
                className={`flex-1 py-3 text-center font-medium transition-colors border-b-4 ${
                  activeTab === 'completed'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('completed')}
              >
                已完成 ({completedAppointments.length}) {/* Show count */}
              </button>
            </div>

            {/* Sort Button */}
            <div className="flex justify-end mb-4">
              <button
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 active:bg-indigo-700 transition-colors text-sm shadow" // Changed color, added shadow
                onClick={toggleSortOrder} // *** Only onClick is used here ***
                disabled={loading} // Disable button while loading
              >
                按日期排序 ({sortOrder === 'desc' ? '最新優先' : '最早優先'}) {/* Changed text slightly */}
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
                    <div key={appointment.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow"> {/* Lighter background, added hover effect */}
                      {/* Simplified layout using grid for better alignment */}
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
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-yellow-500">
                                待處理
                            </span>
                         </span>
                      </div>

                      {appointment.imageUrl && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <span className="font-medium text-gray-600 text-sm block mb-1">參考圖:</span>
                          <img
                            src={appointment.imageUrl}
                            alt="預約參考圖"
                            className="w-full max-h-60 object-contain rounded border border-gray-200 bg-gray-50" // Max height, background
                            loading="lazy" // Lazy load images
                          />
                        </div>
                      )}
                      <button
                        className="mt-4 w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 transition-colors text-sm shadow"
                        onClick={() => completeAppointment(appointment.id)}
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
                    <div key={appointment.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 opacity-80"> {/* Slightly dimmed */}
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
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-green-500">
                                已完成
                            </span>
                         </span>
                      </div>
                      {appointment.imageUrl && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                           <span className="font-medium text-gray-500 text-sm block mb-1">參考圖:</span>
                           <img
                            src={appointment.imageUrl}
                            alt="預約參考圖"
                            className="w-full max-h-60 object-contain rounded border border-gray-200 bg-gray-100"
                            loading="lazy"
                          />
                        </div>
                      )}
                      {/* No action button for completed items usually */}
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

      {/* Optional Footer */}
      {/* <footer className="text-center text-xs text-gray-500 mt-4 pb-4">
        © {new Date().getFullYear()} LINE 美甲預約
      </footer> */}
    </div>
  );
}