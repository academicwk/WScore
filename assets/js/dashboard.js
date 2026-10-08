/**
 * W-Score : Main Dashboard Content
 * แสดงผล Summary Cards / Progress & Charts / Quick Actions ตาม Role ปัจจุบัน
 */

document.addEventListener("DOMContentLoaded", function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  const currentRole =
    sessionStorage.getItem("wscore_current_role") || "SUBJECT_TEACHER";

  if (!userData) return;

  // นายทะเบียน/ผู้ช่วยนายทะเบียน: หน้าแรกเป็นคนละแบบ เน้นกำกับติดตามความคืบหน้าการบันทึกคะแนนของครูประจำวิชาทุกคน (อ่านอย่างเดียว)
  // แทนที่การ์ด/เมนูลัดแบบเดิมทั้งหมด จึงไม่เรียก fetchDashboardData/renderDashboard ทั่วไป — 5 ต.ค. 2569
  if (currentRole === "REGISTRAR" || currentRole === "ASSISTANT_REGISTRAR") {
    initRegistrarProgressDashboard();
    return;
  }

  fetchDashboardData(currentRole, userData.userId).then((data) => {
    renderDashboard(currentRole, data);
  });
});

async function fetchDashboardData(role, userId) {
  const result = await callApi("getDashboardData", { role, userId });
  if (result.status !== "success") {
    return { cards: [], progress: [], quickActions: [], subjects: [] };
  }
  return result.data;
}

function progressBarHtml(label, percent) {
  return `
    <div>
      <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>${label}</span><span>${percent}%</span>
      </div>
      <div class="w-full bg-gray-100 rounded-full h-2">
        <div class="bg-wprimary h-2 rounded-full" style="width:${percent}%"></div>
      </div>
    </div>`;
}

// ชุดสีสำหรับแยกแต่ละรายวิชาให้เห็นชัดในแถวความคืบหน้า (วนซ้ำได้ถ้ามีวิชาเกินจำนวนสี)
const SUBJECT_COLOR_PALETTE = [
  { border: "border-sky-300", text: "text-sky-700", bg: "bg-sky-50", bar: "bg-sky-500" },
  { border: "border-emerald-300", text: "text-emerald-700", bg: "bg-emerald-50", bar: "bg-emerald-500" },
  { border: "border-amber-300", text: "text-amber-700", bg: "bg-amber-50", bar: "bg-amber-500" },
  { border: "border-rose-300", text: "text-rose-700", bg: "bg-rose-50", bar: "bg-rose-500" },
  { border: "border-violet-300", text: "text-violet-700", bg: "bg-violet-50", bar: "bg-violet-500" },
  { border: "border-cyan-300", text: "text-cyan-700", bg: "bg-cyan-50", bar: "bg-cyan-500" },
  { border: "border-lime-300", text: "text-lime-700", bg: "bg-lime-50", bar: "bg-lime-500" },
  { border: "border-fuchsia-300", text: "text-fuchsia-700", bg: "bg-fuchsia-50", bar: "bg-fuchsia-500" },
];

// สร้างตารางสี subjectId -> สี โดยเรียงตามลำดับที่เจอครั้งแรก เพื่อให้สีของแต่ละวิชาคงที่เหมือนกันทั้ง 2 ภาคเรียน
function buildSubjectColorMap(progress) {
  const map = {};
  let nextIndex = 0;
  progress.forEach((p) => {
    const key = String(p.subjectId);
    if (!(key in map)) {
      map[key] = SUBJECT_COLOR_PALETTE[nextIndex % SUBJECT_COLOR_PALETTE.length];
      nextIndex++;
    }
  });
  return map;
}

function miniProgressBarHtml(label, percent, color) {
  return `
    <div class="flex items-center gap-1.5">
      <span class="text-[11px] text-gray-500 whitespace-nowrap">${label}</span>
      <div class="flex-1 bg-gray-100 rounded-full h-1.5">
        <div class="${color.bar} h-1.5 rounded-full" style="width:${percent}%"></div>
      </div>
      <span class="text-[11px] text-gray-500 w-8 text-right shrink-0">${percent}%</span>
    </div>`;
}

// การ์ดย่อย (chip) 1 ใบ ต่อ 1 วิชา/ห้อง แสดงเฉพาะภาคเรียนที่ระบุ
function progressChipHtml(p, componentsKey, colorMap) {
  const components = p[componentsKey];
  if (!components || components.length === 0) return "";
  const color = colorMap[String(p.subjectId)];

  const bars = components
    .map((c) => {
      const label = c.componentType === "ปลายภาค" ? "สอบปลายภาค" : c.componentName;
      return miniProgressBarHtml(label, c.percent, color);
    })
    .join("");

  // สถานะการส่งผลการเรียนแยกอิสระตามภาคเรียนที่ chip นี้กำลังแสดง (ไม่ใช่รวมทั้งปี)
  const isSubmitted = componentsKey === "semester1Components" ? p.isSubmittedSem1 : p.isSubmittedSem2;
  const submitStatusHtml = isSubmitted
    ? '<span class="text-[11px] text-green-600 font-medium whitespace-nowrap"><i class="fa-solid fa-circle-check mr-1"></i>ส่งผลการเรียนแล้ว</span>'
    : '<span class="text-[11px] text-gray-400 whitespace-nowrap"><i class="fa-regular fa-circle mr-1"></i>ยังไม่ส่งผลการเรียน</span>';

  return `
    <div class="rounded-lg border ${color.border} ${color.bg} p-2.5 w-full">
      <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1.5">
        <span class="text-xs font-semibold ${color.text}">${p.label}</span>
        ${submitStatusHtml}
      </div>
      <div class="space-y-1">${bars}</div>
    </div>`;
}

// คอลัมน์ความคืบหน้า 1 ภาคเรียน รวมทุกวิชา/ห้องที่สอน (ต่างวิชา = ต่างสี) วางซ้าย-ขวาคู่กับอีกภาคเรียน
function semesterProgressColumnHtml(semesterLabel, progress, componentsKey, colorMap) {
  const chips = progress.map((p) => progressChipHtml(p, componentsKey, colorMap)).join("");
  const bodyHtml = chips.trim()
    ? `<div class="flex flex-col gap-2">${chips}</div>`
    : `<div class="text-xs text-gray-400">ยังไม่ได้ตั้งค่าช่องเก็บคะแนนของภาคเรียนนี้</div>`;

  return `
    <div>
      <p class="text-xs font-semibold text-gray-400 mb-2">${semesterLabel}</p>
      ${bodyHtml}
    </div>`;
}

// ป้ายสถานะการส่งคะแนนรายภาคเรียนของรายวิชา (แสดงในรายการรายวิชาของครูประจำชั้น)
function semesterBadgeHtml(label, submitted) {
  return submitted
    ? `<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700"><i class="fa-solid fa-circle-check"></i>${label} ส่งแล้ว</span>`
    : `<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700"><i class="fa-solid fa-hourglass-half"></i>${label} ยังไม่ส่ง</span>`;
}

function submissionStatusHtml(classes) {
  if (!Array.isArray(classes) || classes.length === 0) return "";
  const showClass = classes.length > 1;
  return classes
    .map(
      (c) => `
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
          ${showClass ? `<span class="text-xs text-gray-500">ห้อง ${escapeHtmlText(c.label)}</span>` : ""}
          ${semesterBadgeHtml("ภาค 1", c.sem1)}
          ${semesterBadgeHtml("ภาค 2", c.sem2)}
          ${c.teachers ? `<span class="text-xs text-gray-400"><i class="fa-solid fa-chalkboard-user mr-1"></i>${escapeHtmlText(c.teachers)}</span>` : ""}
        </div>`
    )
    .join("");
}

function escapeHtmlText(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// รายการชื่อรายวิชาที่ลงทะเบียนเรียนทั้งหมดของห้อง (data.subjects) แสดงเฉพาะกรณีมีข้อมูลส่งมา (ปัจจุบันมีเฉพาะ HOMEROOM_TEACHER)
// เรียงลำดับมาจาก backend แล้ว (ตามกลุ่มสาระ) ฝั่งนี้แค่ใส่หัวข้อกลุ่มสาระคั่นเมื่อกลุ่มเปลี่ยน
function subjectListSectionHtml(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) return "";

  let currentGroup = null;
  let rowsHtml = "";
  subjects.forEach((s) => {
    const groupLabel = s.subjectGroup || (s.subjectType === "กิจกรรมพัฒนาผู้เรียน" ? "กิจกรรมพัฒนาผู้เรียน" : "อื่นๆ");
    if (groupLabel !== currentGroup) {
      currentGroup = groupLabel;
      rowsHtml += `<p class="text-xs font-semibold text-wprimary mt-3 first:mt-0">${groupLabel}</p>`;
    }
    rowsHtml += `
      <div class="py-2 border-b border-gray-50 last:border-0">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-gray-700">${s.subjectId} ${s.subjectName}</span>
          <span class="text-xs text-gray-400 whitespace-nowrap">${s.subjectType}</span>
        </div>
        ${submissionStatusHtml(s.classes)}
      </div>`;
  });

  return `
    <div class="bg-white rounded-xl shadow p-5 mb-6">
      <h2 class="text-sm font-semibold text-wsecondary mb-3">
        <i class="fa-solid fa-book mr-1.5 text-wprimary"></i>รายวิชาที่ลงทะเบียนเรียน
      </h2>
      <div>${rowsHtml}</div>
    </div>`;
}

function renderDashboard(role, data) {
  const container = document.getElementById("dashboard-content");

  const cardsHtml = data.cards
    .map((c) => {
      const hasSubjectList = Array.isArray(c.subjectList) && c.subjectList.length > 0;

      const bodyHtml = hasSubjectList
        ? `
        <p class="text-xs text-gray-500 mb-1">${c.label}</p>
        <div class="space-y-1.5">
          ${c.subjectList
            .map(
              (s) => `
            <div>
              <p class="text-sm font-bold text-wsecondary leading-snug">${s.name}</p>
              <p class="text-xs text-gray-500 leading-snug">${s.classes.join(", ")}</p>
            </div>`
            )
            .join("")}
        </div>`
        : `
        <p class="text-xs text-gray-500">${c.label}</p>
        <p class="text-lg font-bold text-wsecondary">${c.value}</p>`;

      return `
    <div class="bg-white rounded-xl shadow p-5 flex ${hasSubjectList ? "items-start" : "items-center"} gap-4">
      <div class="w-12 h-12 rounded-lg bg-wprimary-light text-wprimary flex items-center justify-center text-xl shrink-0">
        <i class="fa-solid ${c.icon}"></i>
      </div>
      <div class="min-w-0">${bodyHtml}</div>
    </div>`;
    })
    .join("");

  const subjectColorMap = buildSubjectColorMap(data.progress);

  const progressSectionHtml =
    data.progress.length === 0
      ? ""
      : `
    <div class="bg-white rounded-xl shadow p-5 mb-6">
      <h2 class="text-sm font-semibold text-wsecondary mb-4">
        <i class="fa-solid fa-chart-simple mr-1.5 text-wprimary"></i>ความคืบหน้าการกรอกคะแนน
      </h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        ${semesterProgressColumnHtml("ภาคเรียนที่ 1", data.progress, "semester1Components", subjectColorMap)}
        ${semesterProgressColumnHtml("ภาคเรียนที่ 2", data.progress, "semester2Components", subjectColorMap)}
      </div>
    </div>`;

  const actionsHtml = data.quickActions
    .map(
      (a) => `
    <a href="${a.href}" class="flex items-center gap-3 bg-white hover:bg-wprimary-light border border-gray-200 hover:border-wprimary rounded-xl p-4 transition">
      <div class="w-10 h-10 rounded-lg bg-wprimary text-white flex items-center justify-center">
        <i class="fa-solid ${a.icon}"></i>
      </div>
      <span class="text-sm font-medium text-wsecondary">${a.label}</span>
    </a>`
    )
    .join("");

  const actionsSectionHtml =
    data.quickActions.length === 0
      ? ""
      : `
    <div>
      <h2 class="text-sm font-semibold text-wsecondary mb-3">
        <i class="fa-solid fa-bolt mr-1.5 text-wprimary"></i>เมนูลัด
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${actionsHtml}
      </div>
    </div>`;

  const subjectsSectionHtml = subjectListSectionHtml(data.subjects);

  container.innerHTML = `
    <!-- ส่วนที่ 1 : Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${data.cards.length} gap-4 mb-6">
      ${cardsHtml}
    </div>

    <!-- รายวิชาที่ลงทะเบียนเรียน (มีเฉพาะบาง Role ที่ backend ส่ง data.subjects มา) -->
    ${subjectsSectionHtml}

    <!-- ส่วนที่ 2 : Progress & Charts -->
    ${progressSectionHtml}

    <!-- ส่วนที่ 3 : Quick Actions -->
    ${actionsSectionHtml}
  `;
}

/* =========================================================================================
 * หน้าแรกนายทะเบียน/ผู้ช่วยนายทะเบียน : กำกับติดตามความคืบหน้าการบันทึกคะแนนของครูประจำวิชาทุกคน (อ่านอย่างเดียว) — 5 ต.ค. 2569
 * เรียก getRegistrarTeacherProgressOverview ครั้งแรก (ไม่ cache เพราะเป็นข้อมูลเฝ้าติดตามที่ต้องอัพเดทล่าสุดเสมอ)
 * การกรองระดับชั้น/สถานะ/ค้นหา ทำที่ฝั่ง browser ทั้งหมดจาก rows ที่ดึงมาครั้งเดียว เพื่อความเร็ว ไม่ยิง API ซ้ำ
 * ===========================================================================================*/

let registrarProgressRows = [];
let registrarProgressStatusFilter = "ALL";

async function initRegistrarProgressDashboard() {
  const container = document.getElementById("dashboard-content");
  container.innerHTML = `
    <div class="flex items-center justify-center py-20 text-gray-400">
      <i class="fa-solid fa-circle-notch fa-spin text-2xl mr-2"></i>กำลังโหลดข้อมูล...
    </div>`;

  const result = await callApi("getRegistrarTeacherProgressOverview", {});

  if (result.status !== "success") {
    container.innerHTML = `
      <div class="bg-white rounded-xl shadow p-8 text-center text-gray-400">
        <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
        <p>${result.message || "ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง"}</p>
      </div>`;
    return;
  }

  renderRegistrarProgressDashboard(result.data);
}

function registrarStatusBadgeHtml(status) {
  const map = {
    complete: '<span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-600"><i class="fa-solid fa-circle-check"></i>ครบแล้ว</span>',
    in_progress: '<span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-600"><i class="fa-solid fa-spinner"></i>กำลังบันทึก</span>',
    not_started: '<span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-50 text-red-600"><i class="fa-solid fa-circle-xmark"></i>ยังไม่เริ่ม</span>',
  };
  return map[status] || "";
}

function registrarProgressBarColor(status) {
  if (status === "complete") return "bg-green-500";
  if (status === "in_progress") return "bg-amber-500";
  return "bg-red-400";
}

function renderRegistrarProgressDashboard(data) {
  const container = document.getElementById("dashboard-content");

  if (data.noOpenSemester) {
    container.innerHTML = `
      <div class="bg-white rounded-xl shadow p-10 text-center text-gray-400">
        <i class="fa-solid fa-calendar-xmark text-3xl mb-3"></i>
        <p>ขณะนี้ไม่มีภาคเรียนใดเปิดให้บันทึกคะแนนอยู่ จึงไม่มีข้อมูลให้ติดตาม</p>
      </div>`;
    return;
  }

  registrarProgressRows = data.rows || [];

  const cards = data.cards || { totalCombos: 0, completeCombos: 0, inProgressCombos: 0, notStartedCombos: 0, overallPercent: 0 };
  const gradeLevelOptionsHtml = (data.gradeLevelOptions || [])
    .map((g) => `<option value="${g}">${g}</option>`)
    .join("");

  container.innerHTML = `
    <!-- การ์ดสรุป -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-xs text-gray-500">ปีการศึกษา / ภาคเรียนที่เปิดอยู่</p>
        <p class="text-lg font-bold text-wsecondary">${data.academicYearLabel} / ${data.currentSemester}</p>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-xs text-gray-500">รายวิชา x ห้องเรียนทั้งหมด</p>
        <p class="text-lg font-bold text-wsecondary">${cards.totalCombos}</p>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-xs text-gray-500"><i class="fa-solid fa-circle-check text-green-500 mr-1"></i>บันทึกครบแล้ว</p>
        <p class="text-lg font-bold text-green-600">${cards.completeCombos}</p>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-xs text-gray-500"><i class="fa-solid fa-spinner text-amber-500 mr-1"></i>กำลังบันทึก</p>
        <p class="text-lg font-bold text-amber-600">${cards.inProgressCombos}</p>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <p class="text-xs text-gray-500"><i class="fa-solid fa-circle-xmark text-red-500 mr-1"></i>ยังไม่เริ่มบันทึก</p>
        <p class="text-lg font-bold text-red-600">${cards.notStartedCombos}</p>
      </div>
    </div>

    <!-- ความคืบหน้ารวมทั้งโรงเรียน -->
    <div class="bg-white rounded-xl shadow p-5 mb-6">
      <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>ความคืบหน้าการบันทึกคะแนนรวมทั้งโรงเรียน (ภาคเรียนที่ ${data.currentSemester})</span>
        <span class="font-semibold">${cards.overallPercent}%</span>
      </div>
      <div class="w-full bg-gray-100 rounded-full h-2.5">
        <div class="bg-wprimary h-2.5 rounded-full" style="width:${cards.overallPercent}%"></div>
      </div>
    </div>

    <!-- ตัวกรอง -->
    <div class="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-500 whitespace-nowrap">ระดับชั้น</label>
        <select id="rpGradeLevelFilter" class="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-wprimary/30">
          <option value="">ทุกระดับชั้น</option>
          ${gradeLevelOptionsHtml}
        </select>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-500 whitespace-nowrap">สถานะ</label>
        <select id="rpStatusFilter" class="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-wprimary/30">
          <option value="ALL">ทุกสถานะ</option>
          <option value="not_started">ยังไม่เริ่มบันทึก</option>
          <option value="in_progress">กำลังบันทึก</option>
          <option value="complete">ครบแล้ว</option>
        </select>
      </div>
      <div class="flex items-center gap-2 flex-1 min-w-[180px]">
        <i class="fa-solid fa-magnifying-glass text-gray-400 text-sm"></i>
        <input id="rpSearchBox" type="text" placeholder="ค้นหารายวิชา, ห้องเรียน หรือชื่อครูผู้สอน" class="text-sm border border-gray-300 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-wprimary/30">
      </div>
    </div>

    <!-- ตารางความคืบหน้ารายวิชา x ห้องเรียน -->
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th class="text-left px-4 py-3 font-medium">รายวิชา</th>
              <th class="text-left px-4 py-3 font-medium">ห้องเรียน</th>
              <th class="text-left px-4 py-3 font-medium">ครูผู้สอน</th>
              <th class="text-left px-4 py-3 font-medium w-48">ความคืบหน้า</th>
              <th class="text-left px-4 py-3 font-medium">สถานะ</th>
              <th class="text-center px-4 py-3 font-medium">รายละเอียด</th>
            </tr>
          </thead>
          <tbody id="rpTableBody"></tbody>
        </table>
      </div>
      <p id="rpEmptyMessage" class="hidden text-center text-gray-400 text-sm py-10">ไม่พบข้อมูลตามเงื่อนไขที่กรอง</p>
    </div>
  `;

  document.getElementById("rpGradeLevelFilter").addEventListener("change", applyRegistrarProgressFilters);
  document.getElementById("rpStatusFilter").addEventListener("change", applyRegistrarProgressFilters);
  document.getElementById("rpSearchBox").addEventListener("input", applyRegistrarProgressFilters);

  renderRegistrarProgressTable(registrarProgressRows);
}

function applyRegistrarProgressFilters() {
  const gradeLevel = document.getElementById("rpGradeLevelFilter").value;
  const status = document.getElementById("rpStatusFilter").value;
  const keyword = document.getElementById("rpSearchBox").value.trim().toLowerCase();

  const filtered = registrarProgressRows.filter((r) => {
    if (gradeLevel && String(r.gradeLevel) !== String(gradeLevel)) return false;
    if (status !== "ALL" && r.status !== status) return false;
    if (keyword) {
      const haystack = `${r.subjectName} ${r.className} ${r.teacherNames}`.toLowerCase();
      if (haystack.indexOf(keyword) === -1) return false;
    }
    return true;
  });

  renderRegistrarProgressTable(filtered);
}

function renderRegistrarProgressTable(rows) {
  const tbody = document.getElementById("rpTableBody");
  const emptyMessage = document.getElementById("rpEmptyMessage");

  if (rows.length === 0) {
    tbody.innerHTML = "";
    emptyMessage.classList.remove("hidden");
    return;
  }
  emptyMessage.classList.add("hidden");

  tbody.innerHTML = rows
    .map(
      (r) => `
    <tr class="border-t border-gray-50 hover:bg-gray-50/60">
      <td class="px-4 py-3 text-gray-700 whitespace-nowrap">${r.subjectId} ${r.subjectName}</td>
      <td class="px-4 py-3 text-gray-700 whitespace-nowrap">${r.className}</td>
      <td class="px-4 py-3 text-gray-500">${r.teacherNames}</td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <div class="flex-1 bg-gray-100 rounded-full h-2">
            <div class="${registrarProgressBarColor(r.status)} h-2 rounded-full" style="width:${r.percent}%"></div>
          </div>
          <span class="text-xs text-gray-500 w-20 text-right whitespace-nowrap">${r.completeCount}/${r.totalStudents} คน</span>
        </div>
      </td>
      <td class="px-4 py-3">${registrarStatusBadgeHtml(r.status)}</td>
      <td class="px-4 py-3 text-center">
        <button class="text-wprimary hover:text-wsecondary text-sm font-medium" onclick="showTeacherProgressDetail('${r.subjectId}', '${r.classId}')">
          <i class="fa-solid fa-magnifying-glass-chart mr-1"></i>ดูรายละเอียด
        </button>
      </td>
    </tr>`
    )
    .join("");
}

async function showTeacherProgressDetail(subjectId, classId) {
  Swal.fire({
    title: "กำลังโหลดข้อมูล...",
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false,
    showConfirmButton: false,
  });

  const result = await callApi("getTeacherProgressDetail", { subjectId, classId });

  if (result.status !== "success") {
    Swal.fire({ icon: "error", title: "ไม่สามารถดึงข้อมูลได้", text: result.message || "", confirmButtonColor: "#40BD68" });
    return;
  }

  const data = result.data;

  if (data.notSetUp) {
    Swal.fire({
      icon: "info",
      title: `${data.subjectLabel} / ${data.className}`,
      text: "วิชา/ห้องนี้ยังไม่มีการตั้งค่าช่องเก็บคะแนนของภาคเรียนนี้ ครูผู้สอนยังไม่ได้เริ่มกำหนดช่องเก็บคะแนน",
      confirmButtonColor: "#40BD68",
    });
    return;
  }

  const bodyHtml =
    data.missingStudents.length === 0
      ? '<p class="text-sm text-green-600 text-center py-6"><i class="fa-solid fa-circle-check mr-1"></i>นักเรียนทุกคนมีคะแนนครบทุกช่องแล้ว</p>'
      : `
      <div class="max-h-96 overflow-y-auto text-left">
        <table class="w-full text-xs">
          <thead class="text-gray-500">
            <tr><th class="text-left py-1.5 pr-2">เลขที่</th><th class="text-left py-1.5 pr-2">ชื่อ-สกุล</th><th class="text-left py-1.5">ยังขาดคะแนน</th></tr>
          </thead>
          <tbody>
            ${data.missingStudents
              .map(
                (s) => `
              <tr class="border-t border-gray-100">
                <td class="py-1.5 pr-2 align-top">${s.studentNumber}</td>
                <td class="py-1.5 pr-2 align-top whitespace-nowrap">${s.fullName}</td>
                <td class="py-1.5 align-top">
                  ${s.missingComponents
                    .map((c) => `<span class="inline-block bg-red-50 text-red-600 rounded px-1.5 py-0.5 mr-1 mb-1">${c.componentName} (${c.recorded}/${c.expected})</span>`)
                    .join("")}
                </td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;

  Swal.fire({
    title: `${data.subjectLabel} / ${data.className}`,
    html: `
      <p class="text-xs text-gray-500 mb-3">บันทึกครบแล้ว ${data.completeCount}/${data.totalStudents} คน (ภาคเรียนที่ ${data.currentSemester})</p>
      ${bodyHtml}
    `,
    width: 560,
    confirmButtonText: "ปิด",
    confirmButtonColor: "#40BD68",
  });
}
