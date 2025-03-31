// app/admin/page.js (Refactored with useEffect for sorting)
'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import liff from '@line/liff';
import { initializeApp, getApps } from 'firebase/app'; // Import getApps
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

// --- Firebase Initialization (Improved for HMR/Fast Refresh) ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app;
// Prevent Firebase duplicate initialization in development HMR
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log("Firebase Initialized");
} else {
  app = getApps()[0]; // Use the existing app if already initialized
  // console.log("Firebase Already Initialized, using existing app.");
}
const db = getFirestore(app);
// --- End Firebase Initialization ---


export default function Admin() {
  const [userProfile, setUserProfile] = useState(null);
  // State for displayed (potentially sorted) lists
  const [pendingAppointments, setPendingAppointments] = useState([]);
  const [completedAppointments, setCompletedAppointments] = useState([]);
  // State to store original, unsorted lists fetched from Firebase
  const [originalPending, setOriginalPending] = useState([]);
  const [originalCompleted, setOriginalCompleted] = useState([]);

  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [sortOrder, setSortOrder] = useState('desc'); // Default sort order ('desc' = 最新優先)
  const [loading, setLoading] = useState(true); // Start with loading true

  // --- LIFF Initialization ---
  const initializeLiff = async () => {
    setError(null); // Clear previous errors on init attempt
    setLoading(true); // Ensure loading is true during init
    try {
      console.log("Initializing LIFF...");
      // Ensure liffId is correct and ideally from env variables
      await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID_ADMIN || '2007124985-JOZyYjrA' }); // Use environment variable or fallback
      console.log("LIFF initialized.");

      if (!liff.isLoggedIn()) {
        console.log("User not logged in. Redirecting to login...");
        // Don't setLoading(false) here, page will reload after login anyway
        liff.login(); // Redirects user, script execution might stop here
        return; // Stop further execution in this render
      }

      console.log("User is logged in. Getting profile...");
      const profile = await liff.getProfile();
      console.log("Profile fetched:", profile?.userId); // Log userId for verification
      setUserProfile(profile);

      // Fetch initial appointments data AFTER profile is successfully loaded
      console.log("Fetching initial appointments...");
      fetchAppointments(); // setLoading will be handled within fetchAppointments

    } catch (error) {
      console.error('LIFF Initialization or Profile Fetch Failed:', error);
      setError('無法載入用戶資訊或初始化失敗，請重新整理頁面。');
      setLoading(false); // Stop loading on critical init error
    }
  };

  // --- Fetch Data from Firestore ---
  const fetchAppointments = async () => {
    // Don't reset loading to true if it's already false due to init error
    if (!loading && !error) setLoading(true);
    if (error) setError(null); // Clear previous fetch error if retrying

    console.log("Fetching appointments from Firestore...");
    try {
      // TODO: Replace 'artist_001' with dynamic ID if needed
      const artistId = 'artist_001';
      const baseConditions = [where('nailArtistId', '==', artistId)];

      // Queries for pending and completed appointments
      const pendingQuery = query(collection(db, 'appointments'), ...baseConditions, where('status', '==', 'pending'));
      const completedQuery = query(collection(db, 'appointments'), ...baseConditions, where('status', '==', 'completed'));

      // Fetch both in parallel
      const [pendingSnapshot, completedSnapshot] = await Promise.all([
          getDocs(pendingQuery),
          getDocs(completedQuery)
      ]);

      // Process snapshots into arrays of objects
      const pendingList = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const completedList = completedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`Workspaceed ${pendingList.length} pending, ${completedList.length} completed for artist ${artistId}.`);

      // Store the original, unsorted lists. These will be used by the sorting useEffect.
      setOriginalPending(pendingList);
      setOriginalCompleted(completedList);

      // Note: Initial sort is now handled by the useEffect hook reacting to these state changes.

    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      setError('無法載入預約資料，請稍後再試。');
      // Clear data on error to avoid displaying stale info
      setOriginalPending([]);
      setOriginalCompleted([]);
      setPendingAppointments([]);
      setCompletedAppointments([]);
    } finally {
      // Ensure loading is set to false even if fetch was fast or failed
      setLoading(false);
      console.log("Finished fetching appointments process.");
    }
  };

  // --- Mark Appointment as Completed ---
  const completeAppointment = async (appointmentId) => {
    if (!appointmentId) {
        console.warn("Complete action failed: Invalid appointment ID provided.");
        alert('操作失敗：無效的預約ID。');
        return;
    }
    console.log(`Attempting to complete appointment ID: ${appointmentId}`);
    // TODO: Consider adding a visual loading state to the specific button clicked

    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, { status: 'completed' });
      console.log(`Appointment ${appointmentId} status updated to 'completed' in Firestore.`);
      alert('預約已成功標記為已完成！');

      // Re-fetch all data to reflect the change accurately across original/sorted lists
      // This is simpler than manually moving items between local state arrays.
      fetchAppointments();

    } catch (error) {
      console.error(`Failed to update status for appointment ${appointmentId}:`, error);
      alert('無法更新預約狀態，請稍後再試。');
    }
  };

  // --- Toggle Sort Order Intent ---
  // This function NOW ONLY changes the sortOrder state, triggering the useEffect.
  const toggleSortOrder = () => {
     console.log('--- Toggle Sort Button Clicked ---');
     const newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
     console.log(`Setting sortOrder state from '${sortOrder}' to '${newSortOrder}'`);
     setSortOrder(newSortOrder); // This state change triggers the sorting useEffect
   };

  // --- useEffect for Sorting ---
  // This effect runs whenever sortOrder, originalPending, or originalCompleted changes.
  // It takes the ORIGINAL lists and applies the CURRENT sortOrder to update the DISPLAYED lists.
  useEffect(() => {
    // Prevent running the sort logic before data has been fetched
    // or if original data is empty.
    if (loading || (!originalPending.length && !originalCompleted.length && !error)) {
        console.log("Sorting Effect: Skipped (Loading or no initial data).");
        return;
    }

    console.log(`--- Sorting Effect Triggered --- Order: '${sortOrder}'`);

    // Define the sorting function (can be moved outside component if preferred)
    const sortByDate = (list, order) => {
        console.log(`Sorting ${list.length} items, order: ${order}`);
        if (!list || list.length === 0) return []; // Handle empty list case
        return [...list].sort((a, b) => {
          // Use optional chaining and provide default values for robustness
          const dateStrA = a?.date;
          const dateStrB = b?.date;

          // Parse dates carefully
          const dateA = dateStrA ? new Date(dateStrA.split('/').join('-')) : null;
          const dateB = dateStrB ? new Date(dateStrB.split('/').join('-')) : null;

          // Get time value, handle invalid dates by pushing them to the end (asc) or beginning (desc)
          const timeA = dateA && !isNaN(dateA.getTime()) ? dateA.getTime() : (order === 'desc' ? -Infinity : Infinity);
          const timeB = dateB && !isNaN(dateB.getTime()) ? dateB.getTime() : (order === 'desc' ? -Infinity : Infinity);

          // Perform comparison
          const comparison = order === 'desc' ? timeB - timeA : timeA - timeB;

          // Optional: Add secondary sort key (e.g., time) if dates are equal
          // if (comparison === 0) {
          //   // Compare by time string (HH:MM) or name, etc.
          // }

          return comparison;
        });
      };

    // Apply sorting to the original lists and update the displayed (sorted) lists state
    console.log("Updating displayed pending appointments based on new sort order...");
    setPendingAppointments(sortByDate(originalPending, sortOrder));
    console.log("Updating displayed completed appointments based on new sort order...");
    setCompletedAppointments(sortByDate(originalCompleted, sortOrder));

    console.log("--- Sorting Effect Finished ---");

  // Dependencies: Re-run this effect if the sort order changes OR if the original data changes.
  }, [sortOrder, originalPending, originalCompleted, loading, error]); // Added loading/error to dependency to ensure skip logic works correctly

  // --- Format Date Function ---
  const formatDate = (dateStr) => {
     if (!dateStr || typeof dateStr !== 'string') return '無效日期';
     const parts = dateStr.split('/');
     if (parts.length !== 3) return '格式錯誤';
     const year = Number(parts[0]); const month = Number(parts[1]); const day = Number(parts[2]);
     // Basic validation
     if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31 || year < 1970 || year > 2100) {
        return '日期解析錯誤';
     }
     // Format with padding if needed (e.g., for single digit months/days)
     // return `${year}年${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日`;
     return `${year}年${month}月${day}日`; // Original format
  };

  // --- Initial LIFF Setup Effect ---
  useEffect(() => {
    // This effect runs only once when the component mounts
    initializeLiff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures it runs only once

  // --- JSX Structure ---
  return (
    <div className="flex min-h-screen flex-col items-center p-4 bg-pink-50 font-sans">
      <Head>
        <title>美甲師後台 | LINE 美甲</title>
        <meta name="description" content="美甲師後台管理頁面" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" /> {/* Optimize viewport for mobile */}
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="max-w-md w-full bg-white rounded-lg shadow-xl p-4 sm:p-6 my-8"> {/* Adjusted padding for smaller screens */}
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-pink-600 mb-6">美甲師後台</h1>

        {/* User Profile Section */}
        {!loading && userProfile ? (
           <div className="text-center mb-6 border-b pb-4">
            <img src={userProfile.pictureUrl || '/default-avatar.png'} alt="頭貼" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-2 border-2 border-pink-200" onError={(e) => { e.target.onerror = null; e.target.src='/default-avatar.png'; }} />
            <p className="text-lg sm:text-xl font-semibold text-gray-800">歡迎，{userProfile.displayName || '使用者'}！</p>
           </div>
        ) : loading ? (
           <div className="text-center mb-6 pb-4"><div className="animate-pulse flex flex-col items-center space-y-2"><div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-300"></div><div className="h-4 bg-gray-300 rounded w-3/4"></div></div><p className="text-center text-gray-600 mt-2 text-sm sm:text-base">正在載入...</p></div>
        ) : null }

        {/* Initialization Error Display */}
        {error && !userProfile && (<p className="text-center text-red-600 bg-red-100 p-3 rounded border border-red-300 mb-4 text-sm sm:text-base">{error}</p>)}

        {/* Main Content (Tabs, Sort, Lists) - Show only when logged in */}
        {userProfile && (
          <>
            {/* Tab Navigation */}
            <div className="flex justify-center mb-6 border-b text-sm sm:text-base">
               <button className={`flex-1 py-2 sm:py-3 text-center font-medium transition-colors border-b-4 ${ activeTab === 'pending' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} onClick={() => setActiveTab('pending')}>待處理 ({pendingAppointments.length})</button>
               <button className={`flex-1 py-2 sm:py-3 text-center font-medium transition-colors border-b-4 ${ activeTab === 'completed' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} onClick={() => setActiveTab('completed')}>已完成 ({completedAppointments.length})</button>
            </div>

            {/* Sort Button */}
            <div className="flex justify-end mb-4">
              <button
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 active:bg-indigo-700 transition-colors text-xs sm:text-sm shadow disabled:opacity-50 disabled:cursor-not-allowed"
                onPointerUp={toggleSortOrder} // Use onPointerUp for better touch handling
                disabled={loading || (!originalPending.length && !originalCompleted.length)} // Disable if loading or no data
              >
                按日期排序 ({sortOrder === 'desc' ? '最新優先' : '最早優先'})
              </button>
            </div>

            {/* Appointments List Section */}
            <h2 className="text-lg sm:text-xl font-semibold text-center text-gray-700 mb-4">
              {activeTab === 'pending' ? '待處理預約' : '已完成預約'}
            </h2>

            {/* Loading Indicator */}
            {loading && (<div className="flex justify-center items-center py-6"><div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-pink-600"></div><p className="ml-3 text-gray-600 text-sm sm:text-base">載入中...</p></div>)}

            {/* Fetching Error Display */}
            {!loading && error && (<p className="text-center text-red-600 bg-red-100 p-3 rounded border border-red-300 text-sm sm:text-base">{error}</p>)}

            {/* Render Lists based on activeTab */}
            {/* Pending Appointments List */}
            {!loading && !error && activeTab === 'pending' && (
              pendingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {pendingAppointments.map((appointment) => (
                    // --- Appointment Card ---
                    <div key={appointment.id} className="bg-white p-3 sm:p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
                       <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs sm:text-sm">
                         <span className="font-medium text-gray-600 col-span-1">姓名:</span><span className="text-gray-900 col-span-2 truncate">{appointment.name || '-'}</span> {/* Added truncate */}
                         <span className="font-medium text-gray-600 col-span-1">日期:</span><span className="text-gray-900 col-span-2">{formatDate(appointment.date)}</span>
                         <span className="font-medium text-gray-600 col-span-1">時間:</span><span className="text-gray-900 col-span-2">{appointment.time || '-'}</span>
                         <span className="font-medium text-gray-600 col-span-1">聯絡:</span><span className="text-gray-900 col-span-2 break-words">{appointment.contact || '-'}</span>
                         <span className="font-medium text-gray-600 col-span-1">狀態:</span><span className="col-span-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-yellow-500">待處理</span></span>
                      </div>
                      {appointment.imageUrl && ( <div className="mt-3 pt-3 border-t border-gray-100"><span className="font-medium text-gray-600 text-xs sm:text-sm block mb-1">參考圖:</span><img src={appointment.imageUrl} alt="預約參考圖" className="w-full max-h-48 sm:max-h-60 object-contain rounded border border-gray-200 bg-gray-50" loading="lazy"/></div> )}
                      <button className="mt-4 w-full py-1.5 sm:py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 transition-colors text-xs sm:text-sm shadow" onClick={() => completeAppointment(appointment.id)} >標記為已完成</button>
                    </div>
                    // --- End Appointment Card ---
                  ))}
                </div>
              ) : ( <p className="text-center text-gray-500 py-6 text-sm sm:text-base">目前沒有待處理的預約。</p> )
            )}

            {/* Completed Appointments List */}
            {!loading && !error && activeTab === 'completed' && (
              completedAppointments.length > 0 ? (
                <div className="space-y-4">
                  {completedAppointments.map((appointment) => (
                     // --- Appointment Card ---
                    <div key={appointment.id} className="bg-gray-50 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 opacity-90">
                       <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs sm:text-sm">
                         <span className="font-medium text-gray-500 col-span-1">姓名:</span><span className="text-gray-700 col-span-2 truncate">{appointment.name || '-'}</span>
                         <span className="font-medium text-gray-500 col-span-1">日期:</span><span className="text-gray-700 col-span-2">{formatDate(appointment.date)}</span>
                         <span className="font-medium text-gray-500 col-span-1">時間:</span><span className="text-gray-700 col-span-2">{appointment.time || '-'}</span>
                         <span className="font-medium text-gray-500 col-span-1">聯絡:</span><span className="text-gray-700 col-span-2 break-words">{appointment.contact || '-'}</span>
                         <span className="font-medium text-gray-500 col-span-1">狀態:</span><span className="col-span-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-green-500">已完成</span></span>
                      </div>
                      {appointment.imageUrl && ( <div className="mt-3 pt-3 border-t border-gray-100"><span className="font-medium text-gray-500 text-xs sm:text-sm block mb-1">參考圖:</span><img src={appointment.imageUrl} alt="預約參考圖" className="w-full max-h-48 sm:max-h-60 object-contain rounded border border-gray-200 bg-gray-100" loading="lazy"/></div> )}
                    </div>
                     // --- End Appointment Card ---
                  ))}
                </div>
              ) : ( <p className="text-center text-gray-500 py-6 text-sm sm:text-base">目前沒有已完成的預約。</p> )
            )}
          </>
        )}
      </main>
      {/* Optional: Footer */}
      {/* <footer className="text-center text-xs text-gray-400 mt-4 pb-4">
        美甲預約系統 © {new Date().getFullYear()}
      </footer> */}
    </div>
  );
}