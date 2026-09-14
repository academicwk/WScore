/**
 * W-Score : Main Dashboard Content
 * แสดงผล Summary Cards / Progress & Charts / Quick Actions ตาม Role ปัจจุบัน
 *
 * TODO: ตอนนี้ใช้ MOCK_DATA ชั่วคราว ขั้นตอนถัดไปจะแก้ให้ดึงจาก
 * Google Apps Script API จริง (แทนที่เฉพาะฟังก์ชัน fetchDashboardData)
 */

document.addEventListener("DOMContentLoaded", function () {
  const currentRole =
    sessionStorage.getItem("wscore_current_role") || "SUBJECT_TEACHER";

  fetchDashboardData(currentRole).then((data) => {
    renderDashboard(currentRole, data);
  });
});

// TODO: แทนที่ด้วยการเรียก GAS_API_URL จริง action: "getDashboardData"
function fetchDashboardData(role) {
  const MOCK_DATA = {
    SUBJECT_TEACHER: {
      cards: [
        { icon: "fa-book-open", label: "รายวิชาที่สอน", value: "4 วิชา" },
        { icon: "fa-chalkboard", label: "ห้องที่สอน", value: "6 ห้อง" },
        { icon: "fa-user-graduate", label: "นักเรียนทั้งหมด", value: "182 คน" },
      ],
      progress: [
        { label: "ม.1/1 - ภาษาไทย", percent: 100 },
        { label: "ม.1/2 - ภาษาไทย", percent: 75 },
        { label: "ม.2/1 - ภาษาไทยเพิ่มเติม", percent: 40 },
        { label: "ม.2/2 - ภาษาไทยเพิ่มเติม", percent: 0 },
      ],
      quickActions: [
        { icon: "fa-pen-to-square", label: "บันทึกคะแนนรายวิชา", href: "grading.html" },
      ],
    },
    HOMEROOM_TEACHER: {
      cards: [
        { icon: "fa-user-graduate", label: "นักเรียนในห้อง", value: "32 คน" },
        { icon: "fa-triangle-exclamation", label: "ข้อมูลไม่ครบ", value: "3 คน" },
        { icon: "fa-chart-line", label: "เกรดเฉลี่ยห้อง", value: "3.24" },
      ],
      progress: [
        { label: "บันทึกเวลาเรียน", percent: 90 },
        { label: "ประเมินคุณลักษณะอันพึงประสงค์", percent: 60 },
        { label: "ประเมินการอ่าน คิดวิเคราะห์ และเขียน", percent: 60 },
        { label: "ประเมินสมรรถนะสำคัญของผู้เรียน", percent: 20 },
      ],
      quickActions: [
        { icon: "fa-user-check", label: "บันทึกเวลาเรียน/กิจกรรมโฮมรูม", href: "homeroom-activity.html" },
        { icon: "fa-star", label: "ประเมินคุณลักษณะ/อ่านคิดวิเคราะห์", href: "homeroom-evaluation.html" },
      ],
    },
    REGISTRAR: {
      cards: [
        { icon: "fa-user-graduate", label: "นักเรียนทั้งหมด", value: "1,240 คน" },
        { icon: "fa-book", label: "รายวิชาทั้งหมด", value: "86 วิชา" },
        { icon: "fa-chalkboard-user", label: "ครูผู้สอนทั้งหมด", value: "54 คน" },
        { icon: "fa-clipboard-check", label: "รออนุมัติผลการเรียน", value: "12 รายการ" },
      ],
      progress: [
        { label: "ครูกรอกคะแนนครบแล้ว", percent: 68 },
        { label: "ครูประจำชั้นประเมินครบแล้ว", percent: 54 },
      ],
      quickActions: [
        { icon: "fa-book", label: "จัดการหลักสูตร/รายวิชา", href: "subjects-manage.html" },
        { icon: "fa-clipboard-check", label: "ตรวจสอบ/อนุมัติผลการเรียน", href: "grades-approve.html" },
        { icon: "fa-file-lines", label: "พิมพ์เอกสาร (ปพ.1 / ปพ.3)", href: "documents.html" },
      ],
    },
    DIRECTOR: {
      cards: [
        { icon: "fa-user-graduate", label: "นักเรียนทั้งหมด", value: "1,240 คน" },
        { icon: "fa-chart-line", label: "ผลสัมฤทธิ์เฉลี่ยรวม", value: "3.15" },
        { icon: "fa-circle-check", label: "อัตราจบการศึกษา", value: "98.4%" },
      ],
      progress: [
        { label: "ภาพรวมการกรอกคะแนนทั้งโรงเรียน", percent: 68 },
      ],
      quickActions: [
        { icon: "fa-chart-pie", label: "รายงานสรุปผู้บริหาร", href: "reports.html" },
      ],
    },
  };

  MOCK_DATA.ASSISTANT_REGISTRAR = MOCK_DATA.REGISTRAR;

  return Promise.resolve(MOCK_DATA[role] || MOCK_DATA.SUBJECT_TEACHER);
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

  const progressHtml = data.progress
    .map(
      (p) => `
    <div>
      <div class="flex justify-between text-sm mb-1">
        <span class="text-gray-600">${p.label}</span>
        <span class="font-medium text-wsecondary">${p.percent}%</span>
      </div>
      <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full bg-wprimary rounded-full" style="width:${p.percent}%"></div>
      </div>
    </div>`
    )
    .join("");

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

  container.innerHTML = `
    <!-- ส่วนที่ 1 : Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${data.cards.length} gap-4 mb-6">
      ${cardsHtml}
    </div>

    <!-- ส่วนที่ 2 : Progress & Charts -->
    <div class="bg-white rounded-xl shadow p-5 mb-6">
      <h2 class="text-sm font-semibold text-wsecondary mb-4">
        <i class="fa-solid fa-chart-simple mr-1.5 text-wprimary"></i>ความคืบหน้า
      </h2>
      <div class="space-y-4">
        ${progressHtml}
      </div>
    </div>

    <!-- ส่วนที่ 3 : Quick Actions -->
    <div>
      <h2 class="text-sm font-semibold text-wsecondary mb-3">
        <i class="fa-solid fa-bolt mr-1.5 text-wprimary"></i>เมนูลัด
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${actionsHtml}
      </div>
    </div>
  `;
}
