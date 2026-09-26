/**
 * W-Score : ออกรายงาน ปถ.06 (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 * ย้ายมาจากฝั่งครูประจำชั้นเดิม (homeroom-report.js) — นายทะเบียนเลือกได้ทุกปีการศึกษา/ทุกห้องเรียน/ทุกคนในโรงเรียน ไม่จำกัดเฉพาะห้องที่ตนดูแล
 * เทมเพลตมีคอลัมน์แยกภาคเรียนที่ 1/ภาคเรียนที่ 2/สรุปผลปลายปีอยู่ในตารางเดียวกันแล้ว
 * รายงานจึงแสดง "สถานะจริง ณ ตอนออกรายงาน" เสมอ (คอลัมน์ไหนยังไม่ส่งผลจะเป็น "-" อัตโนมัติ) ไม่มีโหมดพรีวิวอีกต่อไป (ตัดออกตามที่ผู้ใช้ต้องการ)
 * ออกได้ทั้งรายบุคคลและรวมทั้งห้อง (รวมห้อง = ไฟล์ PDF เดียว นักเรียน 1 คน = 1 หน้า)
 */

let allYears = [];
let rawClassesData = [];
let currentClassId = null;

document.addEventListener("DOMContentLoaded", async function () {
  await loadPageData();

  document.getElementById("yearFilter").addEventListener("change", () => {
    renderClassOptionsForYear();
    clearStudentSelect();
    clearReport();
  });
  document.getElementById("classFilter").addEventListener("change", function () {
    currentClassId = this.value;
    if (!currentClassId) {
      clearStudentSelect();
      clearReport();
      return;
    }
    loadClassStudents(currentClassId);
  });
  document.getElementById("studentFilter").addEventListener("change", function () {
    if (!this.value) {
      clearReport();
      return;
    }
    loadStudentReport(currentClassId, this.value);
  });
  document.getElementById("printClassBtn").addEventListener("click", function () {
    generateClassReport(currentClassId);
  });
});

async function loadPageData() {
  const result = await callApi("getEnrollmentsPageData");
  if (result.status !== "success") return;

  allYears = result.data.academicYears;
  rawClassesData = result.data.classes;

  const yearOptions = allYears.map((y) => `<option value="${y.AcademicYearID}">${y.Year}</option>`).join("");
  document.getElementById("yearFilter").innerHTML = yearOptions;

  const current = allYears.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE");
  if (current) document.getElementById("yearFilter").value = current.AcademicYearID;

  renderClassOptionsForYear();
}

function renderClassOptionsForYear() {
  const yearId = document.getElementById("yearFilter").value;
  const classesInYear = rawClassesData.filter((c) => String(c.AcademicYearID) === String(yearId));

  const options = classesInYear
    .map((c) => `<option value="${c.ClassID}">${c.GradeLevel}/${c.RoomNumber}</option>`)
    .join("");

  document.getElementById("classFilter").innerHTML = `<option value="">- เลือกห้องเรียน -</option>` + options;
  currentClassId = null;
}

function clearStudentSelect() {
  document.getElementById("studentFilter").innerHTML = `<option value="">- เลือกนักเรียน -</option>`;
}

function clearReport() {
  document.getElementById("reportContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
      กรุณาเลือกปีการศึกษา ห้องเรียน และนักเรียน เพื่อดูผลการเรียนทุกวิชา
    </div>`;
}

async function loadClassStudents(classId) {
  const studentSelect = document.getElementById("studentFilter");
  studentSelect.innerHTML = `<option value="">- กำลังโหลดข้อมูล... -</option>`;
  clearReport();

  try {
    const result = await callApi("getEnrollmentsByClass", { classId });

    if (result.status !== "success") {
      studentSelect.innerHTML = `<option value="">- เกิดข้อผิดพลาด -</option>`;
      return;
    }

    if (result.data.length === 0) {
      studentSelect.innerHTML = `<option value="">- ไม่มีนักเรียนในห้องนี้ -</option>`;
      return;
    }

    studentSelect.innerHTML =
      `<option value="">- เลือกนักเรียน -</option>` +
      result.data
        .map((s) => `<option value="${s.studentId}">เลขที่ ${s.studentNumber} - ${s.fullName}</option>`)
        .join("");
  } catch (err) {
    studentSelect.innerHTML = `<option value="">- เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ -</option>`;
  }
}

function downloadPdfFromBase64(base64, fileName) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function generateStudentReport(classId, studentId) {
  Swal.fire({
    title: "กำลังสร้างรายงาน...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  try {
    const result = await callApi("generatePt06StudentReport", { classId, studentId });
    Swal.close();
    if (result.status === "success") {
      downloadPdfFromBase64(result.data.base64, result.data.fileName);
      Swal.fire({ icon: "success", title: "สร้างรายงานสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.close();
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  }
}

async function generateClassReport(classId) {
  if (!classId) {
    Swal.fire({ icon: "warning", title: "กรุณาเลือกห้องเรียนก่อน", confirmButtonColor: "#268244" });
    return;
  }

  const confirmResult = await Swal.fire({
    icon: "question",
    title: "ออกรายงาน ปถ.06 รวมทั้งห้อง",
    text: "ระบบจะสร้างไฟล์ PDF ไฟล์เดียว โดยนักเรียน 1 คน = 1 หน้า เรียงตามเลขที่ ต้องการดำเนินการต่อหรือไม่",
    showCancelButton: true,
    confirmButtonText: "ออกรายงาน",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#268244",
  });
  if (!confirmResult.isConfirmed) return;

  Swal.fire({
    title: "กำลังสร้างรายงาน (อาจใช้เวลาสักครู่)...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  try {
    const result = await callApi("generatePt06ClassReport", { classId });
    Swal.close();
    if (result.status === "success") {
      downloadPdfFromBase64(result.data.base64, result.data.fileName);
      Swal.fire({
        icon: "success",
        title: "สร้างรายงานสำเร็จ (" + result.data.studentCount + " คน)",
        confirmButtonColor: "#268244",
        timer: 1500,
        showConfirmButton: false,
      });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.close();
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  }
}

async function loadStudentReport(classId, studentId) {
  const content = document.getElementById("reportContent");
  content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>`;

  try {
    const result = await callApi("getPt06StudentReportData", { classId, studentId });

    if (result.status !== "success") {
      content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">${result.message}</div>`;
      return;
    }

    renderStudentReport(result.data, classId, studentId);
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

function renderStudentReport(data, classId, studentId) {
  const rowsHtml = data.subjects.length
    ? data.subjects
        .map(
          (s) => `
    <tr class="border-b border-gray-100">
      <td class="px-4 py-3">
        <div class="font-medium text-wsecondary">${s.subjectName}</div>
        ${s.teacherName ? `<div class="text-xs text-gray-400 mt-0.5">${s.teacherName}</div>` : ""}
      </td>
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
    : `<tr><td colspan="6" class="text-center text-gray-400 py-6">ยังไม่มีรายวิชาที่มอบหมายให้ห้องนี้ในปีการศึกษานี้</td></tr>`;

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
          <button id="printStudentBtn"
                  class="px-4 py-2.5 text-sm font-medium text-white bg-wprimary hover:bg-wprimary-dark rounded-lg whitespace-nowrap">
            <i class="fa-solid fa-file-pdf mr-1.5"></i>ออกรายงาน (PDF)
          </button>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
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

  document.getElementById("printStudentBtn").addEventListener("click", function () {
    generateStudentReport(classId, studentId);
  });
}
