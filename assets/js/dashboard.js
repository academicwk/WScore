/**
 * W-Score : Main Dashboard Content
 * แสดงผล Summary Cards / Progress & Charts / Quick Actions ตาม Role ปัจจุบัน
 */

document.addEventListener("DOMContentLoaded", function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  const currentRole =
    sessionStorage.getItem("wscore_current_role") || "SUBJECT_TEACHER";

  if (!userData) return;

  fetchDashboardData(currentRole, userData.userId).then((data) => {
    renderDashboard(currentRole, data);
  });
});

async function fetchDashboardData(role, userId) {
  const result = await callApi("getDashboardData", { role, userId });
  if (result.status !== "success") {
    return { cards: [], progress: [], quickActions: [] };
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
      <span class="text-[10px] text-gray-500 w-14 truncate" title="${label}">${label}</span>
      <div class="flex-1 bg-gray-100 rounded-full h-1.5">
        <div class="${color.bar} h-1.5 rounded-full" style="width:${percent}%"></div>
      </div>
      <span class="text-[10px] text-gray-500 w-8 text-right">${percent}%</span>
    </div>`;
}

// การ์ดย่อย (chip) 1 ใบ ต่อ 1 วิชา/ห้อง แสดงเฉพาะภาคเรียนที่ระบุ ให้กระชับพอวางเรียงกันเป็นแถวเดียวได้
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

  return `
    <div class="rounded-lg border ${color.border} ${color.bg} p-2 w-full sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]">
      <div class="flex items-center justify-between gap-2 mb-1.5">
        <span class="text-xs font-semibold ${color.text} truncate" title="${p.label}">${p.label}</span>
        ${
          p.isSubmitted
            ? '<i class="fa-solid fa-circle-check text-green-600 text-xs" title="ส่งผลการเรียนแล้ว"></i>'
            : '<i class="fa-regular fa-circle text-gray-300 text-xs" title="ยังไม่ส่งผลการเรียน"></i>'
        }
      </div>
      <div class="space-y-1">${bars}</div>
    </div>`;
}

// แถวความคืบหน้า 1 ภาคเรียน = 1 แถว รวมทุกวิชา/ห้องที่สอน (ต่างวิชา = ต่างสี)
function semesterProgressRowHtml(semesterLabel, progress, componentsKey, colorMap) {
  const chips = progress.map((p) => progressChipHtml(p, componentsKey, colorMap)).join("");
  if (!chips.trim()) {
    return `
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold text-gray-400 whitespace-nowrap w-20">${semesterLabel}</span>
        <span class="text-xs text-gray-400">ยังไม่ได้ตั้งค่าช่องเก็บคะแนนของภาคเรียนนี้</span>
      </div>`;
  }
  return `
    <div class="flex flex-col sm:flex-row sm:items-start gap-2">
      <span class="text-xs font-semibold text-gray-400 whitespace-nowrap w-20 sm:pt-2">${semesterLabel}</span>
      <div class="flex flex-wrap gap-2 flex-1">${chips}</div>
    </div>`;
}

function renderDashboard(role, data) {
  const container = document.getElementById("dashboard-content");

  const cardsHtml = data.cards
    .map(
      (c) => `
    <div class="bg-white rounded-xl shadow p-5 flex items-center gap-4">
      <div class="w-12 h-12 rounded-lg bg-wprimary-light text-wprimary flex items-center justify-center text-xl">
        <i class="fa-solid ${c.icon}"></i>
      </div>
      <div>
        <p class="text-xs text-gray-500">${c.label}</p>
        <p class="text-lg font-bold text-wsecondary">${c.value}</p>
      </div>
    </div>`
    )
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
      <div class="space-y-3">
        ${semesterProgressRowHtml("ภาคเรียนที่ 1", data.progress, "semester1Components", subjectColorMap)}
        ${semesterProgressRowHtml("ภาคเรียนที่ 2", data.progress, "semester2Components", subjectColorMap)}
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

  container.innerHTML = `
    <!-- ส่วนที่ 1 : Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${data.cards.length} gap-4 mb-6">
      ${cardsHtml}
    </div>

    <!-- ส่วนที่ 2 : Progress & Charts -->
    ${progressSectionHtml}

    <!-- ส่วนที่ 3 : Quick Actions -->
    ${actionsSectionHtml}
  `;
}
