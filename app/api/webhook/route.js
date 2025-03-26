export async function POST(request) {
  try {
    // 解析 LINE 送來的訊息
    const body = await request.json();
    const events = body.events;

    // 處理每個事件
    for (const event of events) {
      // 只處理文字訊息
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text.trim(); // 去掉前後空格

        // 檢查用戶是否說「我要預約」
        if (userMessage.includes("我要預約")) {
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
            throw new Error(`LINE API 回應失敗: ${response.status} - ${errorText}`);
          }
        }
      }
    }

    // 回應 LINE，告訴它處理成功
    return Response.json({ message: "OK" }, { status: 200 });
  } catch (error) {
    // 如果有錯誤，記錄下來並回應失敗
    console.error("Webhook 處理失敗", error);
    return Response.json({ message: "Error" }, { status: 500 });
  }
}