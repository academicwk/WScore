/**
 * W-Score : Main Dashboard Content
 * แสดงผล Summary Cards / Progress & Charts / Quick Actions ตาม Role ปัจจุบัน
 *
 * TODO: ตอนนี้ใช้ MOCK_DATA ชั่วคราว ขั้นตอนถัดไปจะแก้ให้ดึงจาก
 * Google Apps Script API จริง (แทนที่เฉพาะฟังก์ชัน fetchDashboardData)
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

    const progressSectionHtml =
    data.progress.length === 0
      ? ""
      : `
    <div class="bg-white rounded-xl shadow p-5 mb-6">
      <h2 class="text-sm font-semibold text-wsecondary mb-4">
        <i class="fa-solid fa-chart-simple mr-1.5 text-wprimary"></i>ความคืบหน้า
      </h2>
      <div class="space-y-4">
        ${progressHtml}
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

  container.innerHTML = `
    <!-- ส่วนที่ 1 : Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${data.cards.length} gap-4 mb-6">
      ${cardsHtml}
    </div>

    <!-- ส่วนที่ 2 : Progress & Charts -->
    ${progressSectionHtml}

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
