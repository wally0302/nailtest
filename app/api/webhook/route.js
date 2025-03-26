export async function POST(request) {
  try {
    // 檢查環境變數
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error("LINE_CHANNEL_ACCESS_TOKEN 環境變數未設定");
    }
    console.log("LINE_CHANNEL_ACCESS_TOKEN:", process.env.LINE_CHANNEL_ACCESS_TOKEN);

    // 記錄收到的原始請求
    console.log("收到 Webhook 請求:", request.method, request.url);

    // 解析 LINE 送來的訊息
    const body = await request.json();
    console.log("Webhook Body:", JSON.stringify(body, null, 2));

    const events = body.events;
    console.log("Webhook Events:", JSON.stringify(events, null, 2));

    // 如果沒有事件，記錄並回應
    if (!events || events.length === 0) {
      console.log("沒有收到任何事件");
      return Response.json({ message: "No events" }, { status: 200 });
    }

    // 處理每個事件
    for (const event of events) {
      console.log("處理事件:", JSON.stringify(event, null, 2));

      // 只處理文字訊息
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text.trim(); // 去掉前後空格
        console.log("用戶訊息:", userMessage);

        // 檢查用戶是否說「我要預約」
        if (userMessage.includes("我要預約")) {
          console.log("用戶說了 '我要預約'，準備回應 Quick Reply");

          // 用 fetch 發送 LINE API 請求
          const response = await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
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
            }),
          });

          // 檢查 LINE API 回應
          if (!response.ok) {
            const errorText = await response.text();
            console.log("LINE API 回應失敗:", response.status, errorText);
            throw new Error(`LINE API 回應失敗: ${response.status} - ${errorText}`);
          } else {
            console.log("LINE API 回應成功:", response.status);
          }
        } else {
          console.log("用戶訊息不包含 '我要預約'，忽略");
        }
      } else {
        console.log("事件不是文字訊息，忽略");
      }
    }

    // 回應 LINE，告訴它處理成功
    console.log("處理完成，回應 OK");
    return Response.json({ message: "OK" }, { status: 200 });
  } catch (error) {
    // 如果有錯誤，記錄下來並回應失敗
    console.error("Webhook 處理失敗:", error.message);
    return Response.json({ message: "Error" }, { status: 500 });
  }
}