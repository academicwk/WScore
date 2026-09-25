/**
 * W-Score : ออกรายงาน ปถ.06 (สำหรับครูประจำชั้น)
 * แสดงผลการเรียนทุกวิชาของนักเรียนรายบุคคลที่เลือก (ในห้องที่ตนเองเป็นครูประจำชั้น)
 * ปุ่มออกรายงาน PDF (รายบุคคล/รายห้อง) ยังปิดใช้งานอยู่ รอไฟล์เทมเพลต ปถ.06 (.xlsx) จากผู้ใช้งานก่อน
 * จึงจะผูก action สร้าง PDF จริงได้ (รูปแบบเดียวกับ generateSubjectReport ของรายงาน ปถ.05)
 */

let currentClasses = [];
let currentStudents = [];
let currentClassId = null;

document.addEventListener("DOMContentLoaded", function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  if (!userData) return;

  document.getElementById("classFilter").addEventListener("change", function () {
    currentClassId = this.value;
    loadClassData(userData.userId, currentClassId);
  });
  document.getElementById("studentFilter").addEventListener("change", function () {
    if (!this.value) {
      clearReport();
      return;
    }
    loadStudentReport(userData.userId, currentClassId, this.value);
  });

  loadClassData(userData.userId, null);
});

async function loadClassData(userId, classId) {
  const studentSelect = document.getElementById("studentFilter");
  studentSelect.innerHTML = `<option value="">- กำลังโหลดข้อมูล... -</option>`;
  clearReport();

  try {
    const result = await callApi("getHomeroomSummaryPageData", { userId, classId });

    if (result.status !== "success") {
      studentSelect.innerHTML = `<option value="">- เกิดข้อผิดพลาด -</option>`;
      return;
    }

    renderClassFilter(result.data);
    currentClassId = result.data.selectedClassId;
    currentStudents = result.data.students;

    if (currentStudents.length === 0) {
      studentSelect.innerHTML = `<option value="">- ไม่มีนักเรียนในห้องนี้ -</option>`;
      return;
    }

    studentSelect.innerHTML =
      `<option value="">- เลือกนักเรียน -</option>` +
      currentStudents
        .map((s) => `<option value="${s.studentId}">เลขที่ ${s.studentNumber} - ${s.fullName}</option>`)
        .join("");
  } catch (err) {
    studentSelect.innerHTML = `<option value="">- เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ -</option>`;
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

function clearReport() {
  document.getElementById("reportContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
      กรุณาเลือกนักเรียน เพื่อดูผลการเรียนทุกวิชา
    </div>`;
}

async function loadStudentReport(userId, classId, studentId) {
  const content = document.getElementById("reportContent");
  content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>`;

  try {
    const result = await callApi("getHomeroomStudentReportData", { userId, classId, studentId });

    if (result.status !== "success") {
      content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">${result.message}</div>`;
      return;
    }

    renderStudentReport(result.data);
  } catch (err) {
    content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</div>`;
  }
}

function scoreText(value) {
  return value === null || value === undefined ? "-" : Number(value).toFixed(2);
}

function submitStatusBadge(isSubmitted) {
  return isSubmitted
    ? `<span class="text-[11px] text-green-600 font-medium"><i class="fa-solid fa-circle-check mr-1"></i>ส่งแล้ว</span>`
    : `<span class="text-[11px] text-gray-400"><i class="fa-regular fa-circle mr-1"></i>ยังไม่ส่ง</span>`;
}

function renderStudentReport(data) {
  const rowsHtml = data.subjects.length
    ? data.subjects
        .map(
          (s) => `
    <tr class="border-b border-gray-100">
      <td class="px-4 py-3 text-gray-600">${s.subjectGroup}</td>
      <td class="px-4 py-3 font-medium text-wsecondary">${s.subjectName}</td>
      <td class="px-4 py-3 text-center text-gray-600">${s.credit}</td>
      <td class="px-4 py-3 text-center">
        <div>${scoreText(s.semester1Total100)}</div>
        <div class="mt-0.5">${submitStatusBadge(s.isSubmittedSem1)}</div>
      </td>
      <td class="px-4 py-3 text-center">
        <div>${scoreText(s.semester2Total100)}</div>
        <div class="mt-0.5">${submitStatusBadge(s.isSubmittedSem2)}</div>
      </td>
      <td class="px-4 py-3 text-center text-gray-600">${scoreText(s.yearScore100)}</td>
      <td class="px-4 py-3 text-center font-medium text-wsecondary">${s.gradePoint !== null ? s.gradePoint.toFixed(1) : "-"}</td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="text-center text-gray-400 py-6">ยังไม่มีรายวิชาที่มอบหมายให้ห้องนี้ในปีการศึกษานี้</td></tr>`;

  document.getElementById("reportContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-5 mb-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="text-sm text-gray-600">
          <div><span class="text-gray-400">ปีการศึกษา:</span> <span class="font-medium text-gray-700">${data.academicYearLabel}</span></div>
          <div><span class="text-gray-400">ห้องเรียน:</span> <span class="font-medium text-gray-700">${data.classLabel}</span></div>
          <div><span class="text-gray-400">นักเรียน:</span> <span class="font-medium text-gray-700">เลขที่ ${data.student.studentNumber} - ${data.student.fullName} (${data.student.studentId})</span></div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <p class="text-xs text-gray-400">เกรดเฉลี่ย (GPAX)</p>
            <p class="text-xl font-bold text-wsecondary">${data.gpax !== null ? data.gpax.toFixed(2) : "-"}</p>
          </div>
          <button disabled title="รอไฟล์เทมเพลต ปถ.06 จากผู้ดูแลระบบ"
                  class="px-4 py-2.5 text-sm font-medium text-gray-400 bg-gray-200 rounded-lg whitespace-nowrap cursor-not-allowed">
            <i class="fa-solid fa-lock mr-1.5"></i>ออกรายงาน (PDF)
          </button>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th class="px-4 py-3 text-left">กลุ่มสาระ</th>
              <th class="px-4 py-3 text-left">รายวิชา</th>
              <th class="px-4 py-3 text-center">หน่วยกิต</th>
              <th class="px-4 py-3 text-center">ภาคเรียนที่ 1</th>
              <th class="px-4 py-3 text-center">ภาคเรียนที่ 2</th>
              <th class="px-4 py-3 text-center">รวมทั้งปี</th>
              <th class="px-4 py-3 text-center">ผลการเรียน</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;
}
