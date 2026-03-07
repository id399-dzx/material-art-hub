import { NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';

// 🚀 终极穿透：创建一个忽略 SSL 证书校验的本地 HTTPS 代理引擎
const httpsAgent = new https.Agent({
    rejectUnauthorized: false, // 强行穿透本地网络代理的 TLS 拦截
});

export async function POST(req: Request) {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                report: `❌ 诊断失败：后端环境变量中未找到 DEEPSEEK_API_KEY。\n\n当前读取路径：${process.cwd()}\n请检查根目录下的 .env.local 文件内容。`,
                primary: "环境配置错误",
                secondary: "KEY_MISSING"
            }, { status: 500 });
        }

        const body = await req.json();
        const { dataType, isFollowUp, followUpText, previousReport, topPeaks, maxCapacity, voltageRange } = body;

        let systemPrompt = "";
        let userPrompt = "";
        if (isFollowUp) {
            systemPrompt = "你是一位顶尖的材料科学与化学专家。请结合客观图谱报告与用户背景进行机理探讨。直接输出学术级结论。";
            userPrompt = `【前期客观图谱特征】：\n${previousReport}\n\n【用户补充的实验背景】：\n${followUpText}\n\n请进行顶刊级别的深度剖析。`;
        } else {
            switch (dataType) {
                case 'XRD':
                    systemPrompt = "你是一位极其严谨的晶体学顶刊审稿人。请严格按格式输出：\n鉴定目标：[物质]\n微观结构：[晶面]\n===\n[Markdown报告]";
                    userPrompt = `提取到的XRD核心衍射峰位如下：${topPeaks}。请进行严谨的物相鉴定。`;
                    break;
                case 'GCD':
                    systemPrompt = "你是一位极其严谨的电化学顶刊审稿人。请严格按格式输出：\n鉴定目标：[最大容量]\n微观结构：[电压窗口]\n===\n[Markdown报告]";
                    userPrompt = `最大比容量：${maxCapacity}，电压窗口：${voltageRange}。请分析电化学性能。`;
                    break;
                default:
                    systemPrompt = "你是一位极其严谨的材料学专家。请严格按格式输出：\n鉴定目标：[特征]\n微观结构：[解析]\n===\n[Markdown报告]";
                    userPrompt = `当前分析模式：${dataType}。请结合典型特征进行深度解析。`;
            }
        }

        // 🚀 核心替换：使用 Axios + HttpsAgent 强行发起请求
        const response = await axios.post('https://api.deepseek.com/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 60000,
            httpsAgent: httpsAgent // 绑定穿透引擎
        });

        const rawContent = response.data.choices[0].message.content;

        if (isFollowUp) {
            return NextResponse.json({ report: rawContent });
        } else {
            const parts = rawContent.split('===');
            let headerText = parts[0];
            let reportText = parts.length > 1 ? parts.slice(1).join('===') : rawContent;

            const primaryMatch = headerText.match(/鉴定目标：(.*)/);
            const secondaryMatch = headerText.match(/微观结构：(.*)/);

            return NextResponse.json({
                primary: primaryMatch ? primaryMatch[1].trim() : "解析完成",
                secondary: secondaryMatch ? secondaryMatch[1].trim() : "特征提取完毕",
                report: reportText.trim()
            });
        }
    } catch (error: any) {
        console.error("🚀 终极崩溃捕获:", error);
        return NextResponse.json({
            report: `❌ Axios 穿透请求失败：\n- 报错信息: ${error.message}\n- 请确认您的 DeepSeek API 余额充足，或切换手机热点测试。`,
            primary: "网络墙阻断",
            secondary: "AXIOS_ERR"
        }, { status: 500 });
    }
}
