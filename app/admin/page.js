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

  // 從 Firestore 抓取預約資料
  const fetchAppointments = async () => {
    try {
      setLoading(true); // 開始載入
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

      // 按日期排序（客戶端排序）
      const sortByDate = (list) => {
        return list.sort((a, b) => {
          const dateA = new Date(a.date.split('/').join('-'));
          const dateB = new Date(b.date.split('/').join('-'));
          return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
      };

      setPendingAppointments(sortByDate(pendingList));
      setCompletedAppointments(sortByDate(completedList));
      setError(null);
    } catch (error) {
      console.error('抓取預約資料失敗:', error);
      setError('無法載入預約資料，請稍後再試');
    } finally {
      setLoading(false); // 結束載入
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

  // 切換排序順序（客戶端排序）
  const toggleSortOrder = () => {
    const newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newSortOrder);

    // 客戶端重新排序
    const sortByDate = (list) => {
      return [...list].sort((a, b) => {
        const dateA = new Date(a.date.split('/').join('-'));
        const dateB = new Date(b.date.split('/').join('-'));
        return newSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
    };

    setPendingAppointments(sortByDate(pendingAppointments));
    setCompletedAppointments(sortByDate(completedAppointments));
  };

  // 格式化日期
  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('/');
    return `${year}年${parseInt(month)}月${parseInt(day)}日`;
  };

  // 登出功能
  const handleLogout = () => {
    liff.logout();
    window.location.reload();
  };

  useEffect(() => {
    initializeLiff();
    fetchAppointments();
  }, []); // 移除 sortOrder 依賴，因為排序在客戶端完成

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
          <div className="text-center mb-6">
            <p className="text-lg font-semibold text-gray-800">歡迎，{userProfile.displayName}！</p>
            <img
              src={userProfile.pictureUrl}
              alt="頭貼"
              className="w-16 h-16 rounded-full mx-auto mt-2"
            />
          </div>
        ) : (
          <p className="text-center text-gray-700">正在載入用戶資訊...</p>
        )}

        {/* 導航按鈕 */}
        <div className="flex justify-between mb-6">
          <a
            href="/"
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            返回首頁
          </a>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            登出
          </button>
        </div>

        {/* Tab 切換 */}
        <div className="flex justify-center mb-6 space-x-4">
          <button
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'pending' ? 'bg-pink-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
            onClick={() => setActiveTab('pending')}
          >
            已預約
          </button>
          <button
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
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
            className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 active:bg-blue-700 transition-colors touch-manipulation"
            onClick={toggleSortOrder}
            onTouchStart={toggleSortOrder} // 增強手機觸控響應
          >
            按日期排序 ({sortOrder === 'desc' ? '最近優先' : '最遠優先'})
          </button>
        </div>

        {/* 預約列表 */}
        <h2 className="text-xl font-semibold text-center text-gray-800 mb-4">
          {activeTab === 'pending' ? '已預約列表' : '已完成列表'}
        </h2>

        {loading ? (
          <p className="text-center text-gray-700">載入中...</p>
        ) : error ? (
          <p className="text-center text-red-500 bg-red-50 p-2 rounded border border-red-200">{error}</p>
        ) : activeTab === 'pending' ? (
          pendingAppointments.length > 0 ? (
            <div className="space-y-6">
              {pendingAppointments.map((appointment) => (
                <div key={appointment.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-gray-800">姓名:</span>
                    <span className="text-black">{appointment.name}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-gray-800">日期:</span>
                    <span className="text-black">{formatDate(appointment.date)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-gray-800">時間:</span>
                    <span className="text-black">{appointment.time}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-gray-800">聯絡方式:</span>
                    <span className="text-black">{appointment.contact}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-gray-800">狀態:</span>
                    <span
                      className={`px-2 py-1 rounded text-white ${
                        appointment.status === 'pending' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                    >
                      {appointment.status === 'pending' ? '待處理' : '已完成'}
                    </span>
                  </div>
                  {appointment.imageUrl && (
                    <div className="py-1">
                      <span className="font-medium text-gray-800">圖片:</span>
                      <img
                        src={appointment.imageUrl}
                        alt="預約圖片"
                        className="mt-2 w-full max-h-48 object-contain rounded"
                      />
                    </div>
                  )}
                  <button
                    className="mt-3 w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 transition-colors"
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
          <div className="space-y-6">
            {completedAppointments.map((appointment) => (
              <div key={appointment.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between py-1">
                  <span className="font-medium text-gray-800">姓名:</span>
                  <span className="text-black">{appointment.name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-medium text-gray-800">日期:</span>
                  <span className="text-black">{formatDate(appointment.date)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-medium text-gray-800">時間:</span>
                  <span className="text-black">{appointment.time}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-medium text-gray-800">聯絡方式:</span>
                  <span className="text-black">{appointment.contact}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-medium text-gray-800">狀態:</span>
                  <span
                    className={`px-2 py-1 rounded text-white ${
                      appointment.status === 'pending' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                  >
                    {appointment.status === 'pending' ? '待處理' : '已完成'}
                  </span>
                </div>
                {appointment.imageUrl && (
                  <div className="py-1">
                    <span className="font-medium text-gray-800">圖片:</span>
                    <img
                      src={appointment.imageUrl}
                      alt="預約圖片"
                      className="mt-2 w-full max-h-48 object-contain rounded"
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