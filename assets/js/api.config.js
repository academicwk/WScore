/**
 * W-Score : API Configuration & Helper
 * แก้ไข Web App URL ของ Google Apps Script ได้ที่นี่ที่เดียว มีผลกับทุกหน้าที่เรียกใช้ไฟล์นี้
 */
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbz-8xNX3j0o__QyrJVg31eGFR8Mkgj3bUQotmeRCOsDJLUMxNOIu75tPXkuKTH8yubv/exec";

async function callApi(action, payload = {}) {
  const response = await fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  return response.json();
}


const CACHE_TTL_MS = 60 * 1000; // แคชฝั่งเบราว์เซอร์ไว้ 60 วินาที

async function callApiCached(action, payload = {}) {
  const cacheKey = "wscore_cache_" + action + "_" + JSON.stringify(payload);

  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.time < CACHE_TTL_MS) {
        return parsed.data;
      }
    }
  } catch (err) {
    // เข้าถึง sessionStorage ไม่ได้ (เช่น private mode) ข้ามแคช เรียก API ตรงไปเลย
  }

  const result = await callApi(action, payload);

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data: result }));
  } catch (err) {
    // พื้นที่เต็มหรือเข้าถึงไม่ได้ ข้ามการแคชได้ ไม่กระทบการทำงานหลัก
  }

  return result;
}

function clearApiCache(actionName) {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.indexOf("wscore_cache_" + actionName) === 0)
      .forEach((k) => sessionStorage.removeItem(k));
  } catch (err) {
    // ข้ามได้ถ้าเข้าถึง sessionStorage ไม่ได้
  }
}
