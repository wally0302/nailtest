import { Client } from "@line/bot-sdk";

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

export async function POST(req) {
  try {
    const body = await req.json();
    const events = body.events;

    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text.trim(); // 去掉前後空格
        if (userMessage.includes("我要預約")) { // 用 includes 更寬鬆
          await client.replyMessage(event.replyToken, {
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
          });
        }
      }
    }

    return new Response(JSON.stringify({ message: "OK" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook 處理失敗", error);
    return new Response(JSON.stringify({ message: "Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}