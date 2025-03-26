// /app/api/webhook/route.js
export async function GET(request) {
  // 支援 GET 請求，方便用瀏覽器測試路徑是否正確
  console.log("進入 /api/webhook 路由 (GET)");
  return Response.json({ message: "這是 GET 請求，僅用於測試" }, { status: 200 });
}

export async function POST(request) {
  // 一進來就記錄，確認 route.js 是否被執行
  console.log("進入 /api/webhook 路由 (POST)");

  try {
    // 檢查環境變數
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
      console.error("環境變數 LINE_CHANNEL_ACCESS_TOKEN 未設定");
      return Response.json({ message: "環境變數未設定" }, { status: 500 });
    }
    console.log("LINE_CHANNEL_ACCESS_TOKEN:", channelAccessToken);

    // 記錄收到的請求
    console.log("收到 Webhook 請求:", request.method, request.url);

    // 解析 LINE 送來的訊息
    const body = await request.json();
    console.log("Webhook Body:", JSON.stringify(body, null, 2));

    // 檢查是否有事件
    const events = body.events || [];
    if (events.length === 0) {
      console.log("沒有收到任何事件");
      return Response.json({ message: "沒有事件" }, { status: 200 });
    }

    // 處理每個事件
    for (const event of events) {
      console.log("處理事件:", JSON.stringify(event, null, 2));

      // 只處理文字訊息
      if (event.type !== "message" || event.message.type !== "text") {
        console.log("事件不是文字訊息，忽略");
        continue;
      }

      // 檢查用戶訊息
      const userMessage = event.message.text.trim();
      console.log("用戶訊息:", userMessage);

      // 如果用戶說「我要預約」
      if (userMessage.includes("我要預約")) {
        console.log("用戶說了 '我要預約'，準備回應 Quick Reply");

        // 準備 Quick Reply 訊息
        const replyMessage = {
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "請選擇操作：",
              quickReply: {
                items: [
                  {
                    type: "action",
                    action: {
                      type: "uri",
                      label: "我要預約",
                      uri: "https://liff.line.me/2007124985-JOZYjrA", // 您的 LIFF URL
                    },
                  },
                ],
              },
            },
          ],
        };

        // 發送 LINE API 請求
        const response = await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${channelAccessToken}`,
          },
          body: JSON.stringify(replyMessage),
        });

        // 檢查 LINE API 回應
        if (!response.ok) {
          const errorText = await response.text();
          console.error("LINE API 回應失敗:", response.status, errorText);
          return Response.json({ message: "LINE API 失敗" }, { status: 500 });
        }

        console.log("LINE API 回應成功:", response.status);
      } else {
        console.log("用戶訊息不包含 '我要預約'，忽略");
      }
    }

    // 回應 LINE，告訴它處理成功
    console.log("處理完成，回應 OK");
    return Response.json({ message: "OK" }, { status: 200 });
  } catch (error) {
    // 記錄錯誤並回應
    console.error("Webhook 處理失敗:", error.message);
    return Response.json({ message: "錯誤", error: error.message }, { status: 500 });
  }
}