// app/admin/page.js
'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import liff from '@line/liff';

export default function Admin() {
  const [userProfile, setUserProfile] = useState(null);

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

  useEffect(() => {
    initializeLiff();
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

        <p className="text-center text-gray-700">這裡是美甲師後台，後續將顯示預約列表。</p>
      </main>
    </div>
  );
}