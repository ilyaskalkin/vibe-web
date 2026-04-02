import express from "express";
import multer from "multer";
import axios from "axios";
import https from "https";
import FormData from "form-data";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Sber использует самоподписанные сертификаты
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let cachedToken = null;
let tokenExpiry = 0;

function log(label, data) {
  const time = new Date().toLocaleTimeString("ru-RU");
  console.log(`\n[${time}] ── ${label}`);
  if (data !== undefined) console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

function logError(label, err) {
  const time = new Date().toLocaleTimeString("ru-RU");
  console.error(`\n[${time}] ✗ ${label}`);
  if (err.response) {
    console.error("  Статус:", err.response.status);
    console.error("  Тело:  ", JSON.stringify(err.response.data, null, 2));
  } else {
    console.error("  ", err.message);
  }
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    log("Токен (из кэша)", `истекает в ${new Date(tokenExpiry).toLocaleTimeString("ru-RU")}`);
    return cachedToken;
  }

  log("→ OAuth: запрос токена", "POST /api/v2/oauth  scope=GIGACHAT_API_PERS");
  const res = await axios.post(
    "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
    "scope=GIGACHAT_API_PERS",
    {
      headers: {
        Authorization: `Basic ${process.env.GIGACHAT_AUTH_KEY?.trim()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        RqUID: randomUUID(),
        Accept: "application/json",
      },
      httpsAgent,
    }
  );

  cachedToken = res.data.access_token;
  tokenExpiry = res.data.expires_at - 30_000;
  log("← OAuth: токен получен", `истекает в ${new Date(tokenExpiry).toLocaleTimeString("ru-RU")}`);
  return cachedToken;
}

app.post("/gigachat/parse", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Файл не передан" });

  const reqId = randomUUID().slice(0, 8);
  log(`[${reqId}] Новый запрос`, `файл: ${req.file.originalname || "screenshot"}, размер: ${(req.file.size / 1024).toFixed(1)} KB, тип: ${req.file.mimetype}`);

  try {
    const token = await getToken();

    // Шаг 1: загружаем файл
    log(`[${reqId}] → Files: загрузка изображения`, "POST /api/v1/files");
    const fileForm = new FormData();
    fileForm.append("file", req.file.buffer, {
      filename: req.file.originalname || "screenshot.jpg",
      contentType: req.file.mimetype,
    });
    fileForm.append("purpose", "general");

    const fileRes = await axios.post(
      "https://gigachat.devices.sberbank.ru/api/v1/files",
      fileForm,
      {
        headers: { Authorization: `Bearer ${token}`, ...fileForm.getHeaders() },
        httpsAgent,
      }
    );
    log(`[${reqId}] ← Files: файл загружен`, fileRes.data);

    const fileId = fileRes.data.id;

    // Шаг 2: отправляем запрос в чат
    const today = new Date().toISOString().slice(0, 10);
    const prompt =
      `Сегодняшняя дата: ${today}. ` +
      "Извлеки финансовые транзакции из этого скриншота банковского приложения. " +
      "Относительные даты (вчера, сегодня, позавчера и т.п.) вычисляй относительно сегодняшней даты. " +
      "Правила: " +
      "1) В поле description используй только текст из крупной жирной строки названия операции. Мелкий серый текст игнорируй. " +
      "2) Сразу под жирным названием есть мелкая серая строка-подпись. Пропускай операцию ТОЛЬКО если в этой подписи написано точно «Между своими». Никаких других причин для исключения нет — даже если в названии есть стрелка или номера карт. " +
      "Верни ТОЛЬКО JSON массив без пояснений и без markdown-блоков. " +
      'Формат каждого объекта: {"description": "название операции", "amount": число, "date": "YYYY-MM-DD"}. ' +
      "Суммы — положительные числа.";

    log(`[${reqId}] → Chat: запрос`, { model: "GigaChat-Pro", attachments: [fileId], prompt });

    const response = await axios.post(
      "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
      {
        model: "GigaChat-Pro",
        messages: [{ role: "user", content: prompt, attachments: [fileId] }],
        temperature: 0.1,
      },
      {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        httpsAgent,
      }
    );

    const content = response.data.choices[0].message.content;
    log(`[${reqId}] ← Chat: ответ`, content);

    const match = content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("GigaChat не вернул JSON массив");

    const transactions = JSON.parse(match[0]);
    log(`[${reqId}] ✓ Распознано транзакций: ${transactions.length}`, transactions);

    res.json({ transactions });
  } catch (e) {
    logError(`[${reqId}] Ошибка`, e);
    res.status(500).json({ error: e.response?.data?.message || e.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  log("Прокси-сервер запущен", `http://localhost:${PORT}`);
});
