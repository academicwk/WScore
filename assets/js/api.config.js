/**
 * W-Score : API Configuration & Helper
 * แก้ไข Web App URL ของ Google Apps Script ได้ที่นี่ที่เดียว มีผลกับทุกหน้าที่เรียกใช้ไฟล์นี้
 */
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbz-8xNX3j0o__QyrJVg31eGFR8Mkgj3bUQotmeRCOsDJLUMxNOIu75tPXkuKTH8yubv/exec";

async function callApi(action, payload = {}) {
  const token = sessionStorage.getItem("wscore_token") || "";

  const response = await fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token, ...payload }),
  });
  const result = await response.json();

  // เซสชันหมดอายุ/ไม่ถูกต้อง -> เคลียร์ข้อมูลผู้ใช้งานแล้วเด้งกลับหน้า Login
  if (result && result.sessionExpired) {
    sessionStorage.removeItem("wscore_user");
    sessionStorage.removeItem("wscore_token");
    sessionStorage.removeItem("wscore_current_role");
    clearAllApiCaches();
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.href = "login.html";
    }
  }

  return result;
}


const CACHE_TTL_MS = 60 * 1000; // แคชฝั่งเบราว์เซอร์ไว้ 60 วินาที

// action ที่ข้อมูลแทบไม่เปลี่ยนระหว่างวัน ให้แคชนานกว่าค่าเริ่มต้น (8 ต.ค. 2569)
const CACHE_TTL_BY_ACTION_MS = {
  getTeacherSubjectsPageData: 10 * 60 * 1000, // รายวิชา/ปีที่ครูได้รับมอบหมาย
  getGradingPeriodStatus: 2 * 60 * 1000, // สถานะช่วงเวลาบันทึกคะแนน (ตัวนับถอยหลังที่ส่วนหัว)
};

async function callApiCached(action, payload = {}) {
  const cacheKey = "wscore_cache_" + action + "_" + JSON.stringify(payload);
  const ttlMs = CACHE_TTL_BY_ACTION_MS[action] || CACHE_TTL_MS;

  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.time < ttlMs) {
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

/**
 * ล้างแคชข้อมูลทุกชนิดของผู้ใช้ในเบราว์เซอร์นี้ (ใช้ตอนออกจากระบบ/เซสชันหมดอายุ ไม่ให้ข้อมูลคะแนนค้างบนเครื่องที่ใช้ร่วมกัน)
 */
function clearAllApiCaches() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.indexOf("wscore_cache_") === 0 || k.indexOf(SWR_PREFIX) === 0)
      .forEach((k) => sessionStorage.removeItem(k));
  } catch (err) {
    // ข้ามได้
  }
}

/* ============================================================
 * แสดงจากแคชก่อนแล้วอัปเดตเบื้องหลัง (stale-while-revalidate) + โหลดข้อมูลล่วงหน้าแบบชุด — 8 ต.ค. 2569
 * ใช้กับหน้าครู (บันทึกคะแนน/ส่งผลการเรียน/กำหนดช่องคะแนน/ครูประจำชั้น/ปถ.12) ให้เลือกแล้วข้อมูลขึ้นทันที
 * คีย์แคชผูกกับผู้ใช้ (userId) และล้างทั้งหมดเมื่อออกจากระบบ
 * ============================================================ */

const SWR_PREFIX = "wscore_swr_";
const SWR_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // รีเฟรชเบื้องหลังทุก 5 นาที (ลดภาระเซิร์ฟเวอร์)
const SWR_IDLE_PAUSE_MS = 10 * 60 * 1000; // ไม่มีการใช้งานเกิน 10 นาที -> หยุดรีเฟรช
const SWR_SLOW_MS = 8000; // รอบที่ช้าเกิน 8 วินาที -> ข้ามรอบถัดไป
const SWR_PREFETCH_FRESH_MS = 2 * 60 * 1000; // รายการที่โหลดมาไม่เกินช่วงนี้ไม่ต้องโหลดล่วงหน้าซ้ำ
const SWR_PREFETCH_CHUNK = 12; // จำนวนรายการต่อ 1 คำขอแบบชุด

function swrUserId() {
  try {
    const u = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
    return u && u.userId ? String(u.userId) : "anon";
  } catch (err) {
    return "anon";
  }
}

// ทำ payload ให้เป็นรูปแบบเดียวกันเสมอ (เรียงคีย์, ค่าเป็นข้อความ, ตัดค่าว่าง/userId) เพื่อให้หน้าเว็บและตัวโหลดล่วงหน้าได้คีย์ตรงกัน
function swrKey(action, payload) {
  const norm = {};
  Object.keys(payload || {})
    .sort()
    .forEach((k) => {
      const v = payload[k];
      if (k === "userId" || v === null || v === undefined || v === "") return;
      norm[k] = String(v);
    });
  return SWR_PREFIX + swrUserId() + "|" + action + "|" + JSON.stringify(norm);
}

function swrRead(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed : null;
  } catch (err) {
    return null;
  }
}

function swrEvictOldest(count) {
  try {
    const entries = Object.keys(sessionStorage)
      .filter((k) => k.indexOf(SWR_PREFIX) === 0)
      .map((k) => {
        let t = 0;
        try {
          t = JSON.parse(sessionStorage.getItem(k)).time || 0;
        } catch (err) {
          // ถือว่าเก่าสุด
        }
        return { k, t };
      })
      .sort((a, b) => a.t - b.t);
    entries.slice(0, count).forEach((e) => sessionStorage.removeItem(e.k));
  } catch (err) {
    // ข้ามได้
  }
}

function swrWrite(key, data) {
  const payload = JSON.stringify({ time: Date.now(), data: data });
  try {
    sessionStorage.setItem(key, payload);
    return;
  } catch (err) {
    // พื้นที่เต็ม: ลบรายการเก่าที่สุดบางส่วนแล้วลองใหม่ครั้งเดียว
  }
  swrEvictOldest(5);
  try {
    sessionStorage.setItem(key, payload);
  } catch (err) {
    // ยังเก็บไม่ได้ ข้ามการแคชได้ ไม่กระทบการทำงานหลัก
  }
}

// ล้างแคชของ action ที่ระบุ (ทุกพารามิเตอร์) ของผู้ใช้คนนี้ — ใช้หลังแก้ข้อมูลที่ทำให้สำเนาเดิมไม่ตรงความจริง
function swrClear(actionName) {
  try {
    const prefix = SWR_PREFIX + swrUserId() + "|" + actionName + "|";
    Object.keys(sessionStorage)
      .filter((k) => k.indexOf(prefix) === 0)
      .forEach((k) => sessionStorage.removeItem(k));
  } catch (err) {
    // ข้ามได้
  }
}

// เขียนสำเนาข้อมูลที่หน้าเว็บเพิ่งแก้เองลงแคชโดยตรง (เช่น หลังกดบันทึกคะแนนสำเร็จ)
function swrSet(action, payload, data) {
  swrWrite(swrKey(action, payload), data);
}

/**
 * เรียก API แบบแสดงจากแคชก่อน:
 *  1) ถ้ามีสำเนา -> เรียก onData(สำเนา, { fromCache: true }) ทันที
 *  2) ถามเซิร์ฟเวอร์ แล้วเรียก onData(ผลล่าสุด, { fromCache: false, changed, failed })
 *     changed = ผลล่าสุดต่างจากสำเนาที่แสดงไปหรือไม่ (ไม่มีสำเนา = true)
 * ผลที่ไม่สำเร็จไม่ถูกเก็บลงแคช ถ้าเชื่อมต่อไม่ได้จะเรียก onData ด้วยผล status "error" และ offline: true
 */
async function callApiSWR(action, payload, onData) {
  const key = swrKey(action, payload);
  const cached = swrRead(key);
  let cachedJson = null;

  if (cached) {
    cachedJson = JSON.stringify(cached.data);
    onData(cached.data, { fromCache: true, cachedAt: cached.time });
  }

  let fresh;
  try {
    fresh = await callApi(action, payload);
  } catch (err) {
    fresh = { status: "error", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" };
    onData(fresh, { fromCache: false, changed: true, failed: true, offline: true, hadCache: !!cached });
    return fresh;
  }

  if (fresh && fresh.status === "success") {
    swrWrite(key, fresh);
    onData(fresh, { fromCache: false, changed: !cached || JSON.stringify(fresh) !== cachedJson, failed: false, hadCache: !!cached });
  } else {
    onData(fresh, { fromCache: false, changed: true, failed: true, hadCache: !!cached });
  }
  return fresh;
}

// ภาคเรียนที่กำลังเปิดให้บันทึกคะแนน (ใช้เลือกว่าจะโหลดล่วงหน้าภาคไหน) คืน [] ถ้าไม่มีภาคใดเปิด/ดึงข้อมูลไม่สำเร็จ
async function swrOpenSemesters() {
  try {
    const res = await callApiCached("getGradingPeriodStatus");
    if (!res || res.status !== "success") return [];
    return (res.data.periods || []).filter((p) => p.isOpen === true && (p.isConfigured || p.manualStatus === "OPEN")).map((p) => p.semester);
  } catch (err) {
    return [];
  }
}

/**
 * โหลดข้อมูลล่วงหน้าเบื้องหลังเป็นชุด (ผ่าน action "batch" ของเซิร์ฟเวอร์ ซึ่งตรวจสิทธิ์ทีละรายการ)
 * items = [{ action, payload }] — ข้ามรายการที่มีสำเนาใหม่อยู่แล้ว, ทำทีละชุดต่อเนื่องกัน, ข้อผิดพลาดทุกชนิดเงียบไว้ ไม่กระทบหน้า
 */
let swrPrefetchRunning = false;
async function swrPrefetch(items) {
  if (swrPrefetchRunning) return;
  swrPrefetchRunning = true;
  try {
    const todo = [];
    const seen = {};
    (items || []).forEach((it) => {
      const key = swrKey(it.action, it.payload);
      if (seen[key]) return;
      seen[key] = true;
      const cached = swrRead(key);
      if (cached && Date.now() - cached.time < SWR_PREFETCH_FRESH_MS) return;
      todo.push({ action: it.action, payload: it.payload, key: key });
    });

    for (let i = 0; i < todo.length; i += SWR_PREFETCH_CHUNK) {
      const chunk = todo.slice(i, i + SWR_PREFETCH_CHUNK);
      const res = await callApi("batch", {
        calls: chunk.map((it, idx) => ({ key: idx, action: it.action, payload: it.payload })),
      });
      if (!res || res.status !== "success") return;
      (res.data.results || []).forEach((r) => {
        const it = chunk[r.key];
        if (it && r.result && r.result.status === "success") swrWrite(it.key, r.result);
      });
    }
  } catch (err) {
    // เงียบไว้ การโหลดล่วงหน้าเป็นแค่ตัวช่วยเร่งความเร็ว
  } finally {
    swrPrefetchRunning = false;
  }
}

/**
 * รีเฟรชเบื้องหลังเป็นระยะ: เรียก refreshFn ทุก SWR_REFRESH_INTERVAL_MS และทุกครั้งที่กลับมาเปิดแท็บนี้อีกครั้ง
 * ไม่ทำงานตอนซ่อนแท็บ และไม่ทำงานซ้อนกัน ตั้งได้ครั้งเดียวต่อหน้า
 */
let swrAutoRefreshStarted = false;
function swrStartAutoRefresh(refreshFn) {
  if (swrAutoRefreshStarted) return;
  swrAutoRefreshStarted = true;
  let busy = false;
  let lastRun = Date.now();
  let lastActivity = Date.now();
  let skipNext = false;

  // นับว่า "มีการใช้งาน" เมื่อขยับเมาส์ กดแป้น แตะ หรือเลื่อนหน้า
  const markActive = () => {
    const wasIdle = Date.now() - lastActivity > SWR_IDLE_PAUSE_MS;
    lastActivity = Date.now();
    if (wasIdle && Date.now() - lastRun > 60 * 1000) run(); // กลับมาใช้งานหลังพัก -> รีเฟรชทันทีหนึ่งครั้ง
  };
  ["mousemove", "keydown", "touchstart", "scroll", "click"].forEach((ev) =>
    document.addEventListener(ev, markActive, { passive: true })
  );

  const run = async () => {
    if (busy || document.hidden) return;
    if (Date.now() - lastActivity > SWR_IDLE_PAUSE_MS) return; // ไม่มีคนใช้งาน ไม่ต้องรีเฟรช
    busy = true;
    const startedAt = Date.now();
    try {
      await refreshFn();
      if (Date.now() - startedAt > SWR_SLOW_MS) skipNext = true; // เซิร์ฟเวอร์ช้า ให้พักรอบหน้า
    } catch (err) {
      skipNext = true;
    } finally {
      lastRun = Date.now();
      busy = false;
    }
  };

  // สุ่มเลื่อนเวลาเริ่มของแต่ละเครื่อง 0-60 วินาที กันทุกเครื่องยิงพร้อมกัน
  setTimeout(() => {
    setInterval(() => {
      if (skipNext) {
        skipNext = false;
        return;
      }
      run();
    }, SWR_REFRESH_INTERVAL_MS);
  }, Math.floor(Math.random() * 60 * 1000));

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastRun > 60 * 1000) run();
  });
}
