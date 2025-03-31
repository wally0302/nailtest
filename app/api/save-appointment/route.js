// 前台至 firestore 存資料
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const NAIL_ARTIST_ID = 'artist_001';

export async function POST(request) {
  try {
    const { date, time, name, contact, userId, message } = await request.json();

    if (!date || !time || !name || !contact || !userId || !message) {
      console.error("缺少必要欄位", { date, time, name, contact, userId, message });
      return Response.json({ message: "缺少必要欄位" }, { status: 400 });
    }

    const docRef = await addDoc(collection(db, "appointments"), {
      date,
      time,
      name,
      contact,
      userId,
      nailArtistId: NAIL_ARTIST_ID,
      createdAt: new Date().toISOString(),
      status: "pending",
    });

    console.log("預約已存進 Firestore，ID:", docRef.id);

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
      console.error("環境變數 LINE_CHANNEL_ACCESS_TOKEN 未設定");
      return Response.json({ message: "環境變數未設定" }, { status: 500 });
    }

    const pushMessageResponse = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      }),
    });

    if (!pushMessageResponse.ok) {
      const errorText = await pushMessageResponse.text();
      console.error("LINE pushMessage 失敗:", pushMessageResponse.status, errorText);
      return Response.json({ message: "發送訊息失敗" }, { status: 500 });
    }

    console.log("LINE pushMessage 成功:", pushMessageResponse.status);

    return Response.json({ message: "預約已儲存", id: docRef.id }, { status: 200 });
  } catch (error) {
    console.error("儲存預約失敗:", error.message);
    return Response.json({ message: "儲存失敗", error: error.message }, { status: 500 });
  }
}