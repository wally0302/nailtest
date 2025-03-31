// app/admin/page.js
'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import liff from '@line/liff';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

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
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState(null);

  // 初始化 LIFF 並獲取用戶資訊
  const initializeLiff = async () => {
    try {
      // 初始化 LIFF
      await liff.init({ liffId: '2007124985-JOZyYjrA' });

      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }

      // 獲取用戶資訊
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
      // 查詢條件：nailArtistId == "artist_001"
      const q = query(
        collection(db, 'appointments'),
        where('nailArtistId', '==', 'artist_001')
      );
      const querySnapshot = await getDocs(q);

      const appointmentList = [];
      querySnapshot.forEach((doc) => {
        appointmentList.push({ id: doc.id, ...doc.data() });
      });

      setAppointments(appointmentList);
      setError(null); // 清除錯誤訊息
    } catch (error) {
      console.error('抓取預約資料失敗:', error);
      setError('無法載入預約資料，請稍後再試');
    }
  };

  useEffect(() => {
    initializeLiff();
    fetchAppointments();
  }, []);

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

        <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">預約列表</h2>

        {error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : appointments.length > 0 ? (
          <div className="space-y-4">
            {appointments.map((appointment) => (
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
          <p className="text-center text-gray-700">目前沒有預約資料。</p>
        )}
      </main>
    </div>
  );
}