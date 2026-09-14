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
