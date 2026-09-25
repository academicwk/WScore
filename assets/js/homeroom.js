/**
 * W-Score : สรุปข้อมูลประจำชั้น (สำหรับครูประจำชั้น)
 * แสดงรายชื่อนักเรียนในห้องที่ตนเองเป็นครูประจำชั้น พร้อมเกรดเฉลี่ย (GPAX) และความคืบหน้าการส่งผลการเรียน
 */

let currentClasses = [];

document.addEventListener("DOMContentLoaded", function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  if (!userData) return;

  document.getElementById("classFilter").addEventListener("change", function () {
    loadHomeroomSummary(userData.userId, this.value);
  });

  loadHomeroomSummary(userData.userId, null);
});

async function loadHomeroomSummary(userId, classId) {
  const content = document.getElementById("homeroomContent");
  content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>`;

  try {
    const result = await callApi("getHomeroomSummaryPageData", { userId, classId });

    if (result.status !== "success") {
      content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">${result.message}</div>`;
      return;
    }

    renderHomeroomSummary(result.data);
  } catch (err) {
    content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</div>`;
  }
}

function renderClassFilter(data) {
  currentClasses = data.classOptions;
  const wrap = document.getElementById("classFilterWrap");
  const select = document.getElementById("classFilter");

  if (currentClasses.length <= 1) {
    wrap.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");
  select.innerHTML = currentClasses
    .map((c) => `<option value="${c.classId}" ${c.classId === data.selectedClassId ? "selected" : ""}>${c.label}</option>`)
    .join("");
}

function gpaxBadgeClass(gpax) {
  if (gpax === null) return "bg-gray-100 text-gray-500";
  if (gpax >= 3) return "bg-wprimary-light text-wprimary";
  if (gpax >= 2) return "bg-amber-50 text-amber-600";
  return "bg-rose-50 text-rose-600";
}

function progressBadge(completed, total) {
  if (total === 0) {
    return `<span class="text-xs text-gray-400">ยังไม่มีรายวิชา</span>`;
  }
  if (completed === total) {
    return `<span class="text-xs font-medium px-2.5 py-1 rounded-full bg-wprimary-light text-wprimary"><i class="fa-solid fa-circle-check mr-1"></i>ครบทุกวิชา (${completed}/${total})</span>`;
  }
  if (completed === 0) {
    return `<span class="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">ยังไม่มีผลการเรียน (0/${total})</span>`;
  }
  return `<span class="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">รอผลการเรียน (${completed}/${total})</span>`;
}

function renderHomeroomSummary(data) {
  renderClassFilter(data);

  const content = document.getElementById("homeroomContent");

  if (data.classOptions.length === 0) {
    content.innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
        <i class="fa-solid fa-circle-info mr-1"></i>คุณยังไม่ได้รับมอบหมายให้เป็นครูประจำชั้นห้องใดในปีการศึกษาปัจจุบัน
      </div>`;
    return;
  }

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

  const rowsHtml = data.students.length
    ? data.students
        .map(
          (s) => `
    <tr class="border-b border-gray-100">
      <td class="px-4 py-3 text-center text-gray-600">${s.studentNumber}</td>
      <td class="px-4 py-3 font-medium text-wsecondary">${s.studentId}</td>
      <td class="px-4 py-3 text-gray-700">${s.fullName}</td>
      <td class="px-4 py-3 text-center">
        <span class="text-xs font-medium px-2.5 py-1 rounded-full ${gpaxBadgeClass(s.gpax)}">${s.gpax !== null ? s.gpax.toFixed(2) : "-"}</span>
      </td>
      <td class="px-4 py-3 text-center">${progressBadge(s.completedSubjects, s.totalSubjects)}</td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="text-center text-gray-400 py-6">ยังไม่มีนักเรียนในห้องนี้</td></tr>`;

  content.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      ${cardsHtml}
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="flex items-center justify-between gap-3 p-4 border-b border-gray-100">
        <h2 class="text-sm font-bold text-wsecondary">รายชื่อนักเรียนห้อง ${data.classLabel}</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th class="px-4 py-3 text-center w-16">เลขที่</th>
              <th class="px-4 py-3 text-left">รหัสนักเรียน</th>
              <th class="px-4 py-3 text-left">ชื่อ-นามสกุล</th>
              <th class="px-4 py-3 text-center">GPAX</th>
              <th class="px-4 py-3 text-center">สถานะผลการเรียน</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;
}
