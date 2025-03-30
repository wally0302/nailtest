'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import liff from '@line/liff';

export default function Home() {
  // 狀態管理
  const [step, setStep] = useState(1); // 1: 選擇日期, 2: 填寫資料, 3: 確認預約
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [form, setForm] = useState({ name: '', contact: '' });
  const [availableTimes, setAvailableTimes] = useState([]);
  const [userProfile, setUserProfile] = useState(null); // 用來存 LIFF 用戶資料
  console.log('userProfile', userProfile);
  // LIFF 初始化
  useEffect(() => {
    const initializeLiff = async () => {
      try {
        await liff.init({ liffId: '2007124985-JOZyYjrA' }); // 您的 LIFF ID
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        setUserProfile(profile);
        // 自動填入用戶名稱
        setForm((prev) => ({ ...prev, name: profile.displayName }));
      } catch (error) {
        console.log('LIFF 初始化失敗', error);
      }
    };

    initializeLiff();
  }, []);

  // 取得可預約時段 (假資料)
  const getAvailableTimes = () => {
    setAvailableTimes([
      '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    ]);
  };

  // 當選擇日期時，更新可用時段
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    getAvailableTimes();
  };

  // 處理表單變更
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 處理預約提交

  const handleSubmit = async () => {
    try {
      if (!selectedDate || !selectedTime || !form.name || !form.contact) {
        alert('請填寫完整的預約資訊');
        return;
      }
  
      if (!liff.isInClient()) {
        console.log('不在 LINE 環境中，無法發送訊息');
        alert('請在 LINE 應用程式內進行預約');
        return;
      }
  
      if (!liff.isLoggedIn()) {
        console.log('LIFF 未登入，無法發送訊息');
        alert('請重新登入 LINE');
        liff.login();
        return;
      }
  
      const formattedDate = selectedDate.toLocaleDateString('zh-TW');
      const message = `預約成功！\n` +
                      `日期：${formattedDate}\n` +
                      `時間：${selectedTime}\n` +
                      `姓名：${form.name}\n` +
                      `聯絡方式：${form.contact}`;
  
      console.log(`準備儲存預約並發送訊息: ${message}`);
  
      if (message.length > 5000) {
        console.log('訊息長度超過 5000 字元，無法發送');
        alert('預約資訊過長，請縮短姓名或聯絡方式');
        return;
      }
  
      const appointmentData = {
        date: formattedDate,
        time: selectedTime,
        name: form.name,
        contact: form.contact,
        userId: userProfile.userId,
        message,
      };
  
      const saveResponse = await fetch('/api/save-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData),
      });
  
      const saveResult = await saveResponse.json();
      if (!saveResponse.ok) {
        throw new Error(saveResult.message || '儲存預約失敗');
      }
  
      console.log(`預約已存進 Firestore，ID: ${saveResult.id}`);
  
      alert('預約成功，已發送通知到您的 LINE！');
      setStep(1);
      setSelectedDate(null);
      setSelectedTime(null);
      setForm({ name: '', contact: '' });
      liff.closeWindow();
    } catch (error) {
      console.log('預約提交失敗', error);
      console.log(`預約提交失敗: ${error.message}`);
      alert(`預約失敗：${error.message}，請稍後再試！`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-4 bg-pink-50">
      <Head>
        <title>美甲預約 | LINE 美甲</title>
        <meta name="description" content="透過 LINE 預約美甲服務" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="max-w-md w-full bg-white rounded-lg shadow-md p-6 my-8">
        <h1 className="text-2xl font-bold text-center text-pink-600 mb-6">美甲預約</h1>

        {/* 顯示用戶資料（可選） */}
        {userProfile && (
          <div className="text-center mb-4">
            <p>歡迎，{userProfile.displayName}！</p>
            <img
              src={userProfile.pictureUrl}
              alt="頭貼"
              className="w-12 h-12 rounded-full mx-auto mt-2"
            />
          </div>
        )}

        {/* 步驟導航 */}
        <div className="flex justify-between mb-8">
          <div
            className={`flex-1 text-center ${step >= 1 ? 'text-pink-600 font-semibold' : 'text-gray-400'}`}
            onClick={() => step > 1 && setStep(1)}
          >
            1. 選擇時間
          </div>
          <div
            className={`flex-1 text-center ${step >= 2 ? 'text-pink-600 font-semibold' : 'text-gray-400'}`}
            onClick={() => step > 2 && setStep(2)}
          >
            2. 填寫資料
          </div>
          <div
            className={`flex-1 text-center ${step >= 3 ? 'text-pink-600 font-semibold' : 'text-gray-400'}`}
          >
            3. 確認預約
          </div>
        </div>

        {/* 步驟 1: 選擇日期時間 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-gray-700 mb-2">選擇日期</label>
              <DatePicker
                selected={selectedDate}
                onChange={handleDateSelect}
                minDate={new Date()}
                dateFormat="yyyy/MM/dd"
                className="w-full p-2 border border-gray-300 rounded"
                placeholderText="點擊選擇日期"
              />
            </div>

            {selectedDate && (
              <div>
                <label className="block text-gray-700 mb-2">選擇時間</label>
                <div className="grid grid-cols-3 gap-2">
                  {availableTimes.map((time) => (
                    <button
                      key={time}
                      className={`p-2 rounded ${
                        selectedTime === time
                          ? 'bg-pink-500 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              className="w-full py-2 bg-pink-600 text-white rounded hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              disabled={!selectedDate || !selectedTime}
              onClick={() => setStep(2)}
            >
              下一步
            </button>
          </div>
        )}

        {/* 步驟 2: 填寫資料 */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="name">
                姓名
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="請輸入姓名"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2" htmlFor="contact">
                聯絡方式
              </label>
              <input
                type="text"
                id="contact"
                name="contact"
                value={form.contact}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="請輸入電話或 LINE ID"
                required
              />
            </div>

            <div className="flex space-x-4">
              <button
                className="flex-1 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                onClick={() => setStep(1)}
              >
                上一步
              </button>
              <button
                className="flex-1 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!form.name || !form.contact}
                onClick={() => setStep(3)}
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {/* 步驟 3: 確認預約 */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center mb-4">預約確認</h2>

            <div className="bg-gray-50 p-4 rounded">
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium">日期:</span>
                <span>{selectedDate?.toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium">時間:</span>
                <span>{selectedTime}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="font-medium">姓名:</span>
                <span>{form.name}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-medium">聯絡方式:</span>
                <span>{form.contact}</span>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                className="flex-1 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                onClick={() => setStep(2)}
              >
                上一步
              </button>
              <button
                className="flex-1 py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
                onClick={handleSubmit}
              >
                確認預約
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}