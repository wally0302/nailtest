'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import liff from '@line/liff';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

export default function Backend() {
  // 狀態管理
  const [userProfile, setUserProfile] = useState(null); // LIFF 用戶資料
  const [appointments, setAppointments] = useState([]); // 預約資料
  const [loading, setLoading] = useState(true); // 載入狀態

  // Firebase 配置（應與 route.js 一致）
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // 初始化 Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // LIFF 初始化並獲取預約資料
  useEffect(() => {
    const initializeLiffAndFetchData = async () => {
      try {
        // 初始化 LIFF
        await liff.init({ liffId: '2007124985-JOZyYjrA' }); // 使用與 page.js 相同的 LIFF ID
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        setUserProfile(profile);

        // 從 Firestore 獲取預約資料
        const querySnapshot = await getDocs(collection(db, 'appointments'));
        const appointmentList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAppointments(appointmentList);
        setLoading(false);
      } catch (error) {
        console.log('LIFF 初始化或資料獲取失敗', error);
        setLoading(false);
      }
    };

    initializeLiffAndFetchData();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center p-4 bg-pink-50">
      <Head>
        <title>美甲後台 | LINE 美甲</title>
        <meta name="description" content="管理美甲預約的後台" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="max-w-2xl w-full bg-white rounded-lg shadow-md p-6 my-8">
        <h1 className="text-2xl font-bold text-center text-pink-600 mb-6">美甲後台</h1>

        {/* 顯示用戶資料 */}
        {userProfile && (
          <div className="text-center mb-6">
            <p>管理員：{userProfile.displayName}</p>
            <img
              src={userProfile.pictureUrl}
              alt="頭貼"
              className="w-12 h-12 rounded-full mx-auto mt-2"
            />
          </div>
        )}

        {/* 預約列表 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700">預約列表</h2>

          {loading ? (
            <p className="text-center text-gray-500">載入中...</p>
          ) : appointments.length === 0 ? (
            <p className="text-center text-gray-500">目前沒有預約</p>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200"
                >
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-gray-700">日期:</span>
                    <span>{appointment.date}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-gray-700">時間:</span>
                    <span>{appointment.time}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-gray-700">姓名:</span>
                    <span>{appointment.name}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-gray-700">聯絡方式:</span>
                    <span>{appointment.contact}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-medium text-gray-700">狀態:</span>
                    <span
                      className={
                        appointment.status === 'pending'
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }
                    >
                      {appointment.status === 'pending' ? '待確認' : appointment.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 返回按鈕 */}
        <div className="mt-6">
          <button
            className="w-full py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
            onClick={() => liff.closeWindow()}
          >
            關閉後台
          </button>
        </div>
      </main>
    </div>
  );
}