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

  // 初始化 LIFF 並獲取用戶資訊
  const initializeLiff = async () => {
    try {
      await liff.init({ liffId: '2007124985-JOZyYjrA' });

      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }

      const profile = await liff.getProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('LIFF 初始化失敗:', error);
      alert('無法載入用戶資訊，請稍後再試');
    }
  };

  // 從 Firestore 抓取預約資料並排序
  const fetchAppointments = async () => {
    try {
      // 查詢條件：nailArtistId == "artist_001" 且 status == "pending"
      const pendingQuery = query(
        collection(db, 'appointments'),
        where('nailArtistId', '==', 'artist_001'),
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      const pendingList = [];
      pendingSnapshot.forEach((doc) => {
        pendingList.push({ id: doc.id, ...doc.data() });
      });

      // 按日期排序
      pendingList.sort((a, b) => {
        const dateA = new Date(a.date.split('/').join('-')); // 將 "2025/4/2" 轉為 "2025-4-2"
        const dateB = new Date(b.date.split('/').join('-'));
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
      setPendingAppointments(pendingList);

      // 查詢條件：nailArtistId == "artist_001" 且 status == "completed"
      const completedQuery = query(
        collection(db, 'appointments'),
        where('nailArtistId', '==', 'artist_001'),
        where('status', '==', 'completed')
      );
      const completedSnapshot = await getDocs(completedQuery);
      const completedList = [];
      completedSnapshot.forEach((doc) => {
        completedList.push({ id: doc.id, ...doc.data() });
      });

      // 按日期排序
      completedList.sort((a, b) => {
        const dateA = new Date(a.date.split('/').join('-'));
        const dateB = new Date(b.date.split('/').join('-'));
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
      setCompletedAppointments(completedList);

      setError(null);
    } catch (error) {
      console.error('抓取預約資料失敗:', error);
      setError('無法載入預約資料，請稍後再試');
    }
  };

  // 將預約狀態從 pending 更改為 completed
  const completeAppointment = async (appointmentId) => {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, {
        status: 'completed',
      });

      await fetchAppointments();
      alert('預約已標記為已完成！');
    } catch (error) {
      console.error('更新預約狀態失敗:', error);
      alert('無法更新預約狀態，請稍後再試');
    }
  };

  // 切換排序順序
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    fetchAppointments(); // 重新排序
  };

  useEffect(() => {
    initializeLiff();
    fetchAppointments();
  }, [sortOrder]); // 當 sortOrder 改變時重新抓取並排序

  return (
    <div className="flex min-h-screen flex-col items-center p-4 bg-pink-50">
      <Head>
        <title>美甲師後台 | LINE 美甲</title>
        <meta name="description" content="美甲師後台管理頁面" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="max-w-md w-full bg-white rounded-lg shadow-md p-6 my-8">
        <h1 className="text-2xl font-bold text-center text-pink-600 mb-6">美甲師後台</h1>

        {userProfile ? (
          <div className="text-center mb-4">
            <p>歡迎，{userProfile.displayName}！</p>
            <img
              src={userProfile.pictureUrl}
              alt="頭貼"
              className="w-12 h-12 rounded-full mx-auto mt-2"
            />
          </div>
        ) : (
          <p className="text-center text-gray-700">正在載入用戶資訊...</p>
        )}

        {/* Tab 切換 */}
        <div className="flex justify-center mb-6">
          <button
            className={`px-4 py-2 mx-2 rounded ${
              activeTab === 'pending' ? 'bg-pink-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
            onClick={() => setActiveTab('pending')}
          >
            已預約
          </button>
          <button
            className={`px-4 py-2 mx-2 rounded ${
              activeTab === 'completed' ? 'bg-pink-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
            onClick={() => setActiveTab('completed')}
          >
            已完成
          </button>
        </div>

        {/* 排序按鈕 */}
        <div className="flex justify-end mb-4">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={toggleSortOrder}
          >
            按日期排序 ({sortOrder === 'desc' ? '最近優先' : '最遠優先'})
          </button>
        </div>

        {/* 預約列表 */}
        <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">
          {activeTab === 'pending' ? '已預約列表' : '已完成列表'}
        </h2>

        {error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : activeTab === 'pending' ? (
          pendingAppointments.length > 0 ? (
            <div className="space-y-4">
              {pendingAppointments.map((appointment) => (
                <div key={appointment.id} className="bg-gray-50 p-4 rounded-lg shadow-sm">
                  <div className="flex justify-between py-1">
                    <span className="font-medium">姓名:</span>
                    <span>{appointment.name}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium">日期:</span>
                    <span>{appointment.date}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium">時間:</span>
                    <span>{appointment.time}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium">聯絡方式:</span>
                    <span>{appointment.contact}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium">狀態:</span>
                    <span>{appointment.status}</span>
                  </div>
                  {appointment.imageUrl && (
                    <div className="py-1">
                      <span className="font-medium">圖片:</span>
                      <img
                        src={appointment.imageUrl}
                        alt="預約圖片"
                        className="mt-2 w-full h-32 object-cover rounded"
                      />
                    </div>
                  )}
                  <button
                    className="mt-2 w-full py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    onClick={() => completeAppointment(appointment.id)}
                  >
                    標記為已完成
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-700">目前沒有已預約資料。</p>
          )
        ) : completedAppointments.length > 0 ? (
          <div className="space-y-4">
            {completedAppointments.map((appointment) => (
              <div key={appointment.id} className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <div className="flex justify-between py-1">
                  <span className="font-medium">姓名:</span>
                  <span>{appointment.name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-medium">日期:</span>
                  <span>{appointment.date}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-medium">時間:</span>
                  <span>{appointment.time}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-medium">聯絡方式:</span>
                  <span>{appointment.contact}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-medium">狀態:</span>
                  <span>{appointment.status}</span>
                </div>
                {appointment.imageUrl && (
                  <div className="py-1">
                    <span className="font-medium">圖片:</span>
                    <img
                      src={appointment.imageUrl}
                      alt="預約圖片"
                      className="mt-2 w-full h-32 object-cover rounded"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-700">目前沒有已完成資料。</p>
        )}
      </main>
    </div>
  );
}