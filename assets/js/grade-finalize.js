/**
 * W-Score : ตัดสินผลการเรียน (สำหรับครูประจำวิชา)
 * แสดงคะแนนสรุปภาคเรียนที่ 1 และ 2 (ระหว่างภาค 70 + ปลายภาค 30 = 100) ของแต่ละวิชา/ห้องเรียน
 * พร้อมคะแนนปีการศึกษา (เฉลี่ย 2 ภาคเรียน เต็ม 100) และผลการเรียน (0-4)
 * หน้านี้แสดงผลอย่างเดียว ห้ามแก้ไขคะแนน มีเพียงปุ่มส่ง/ดึงผลการเรียนกลับ
 */

let allYears = [];
let myAssignments = [];
let currentResults = [];
let isSubmitted = false;

document.addEventListener("DOMContentLoaded", async function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  if (!userData) return;

  await loadPageData(userData.userId);

  document.getElementById("yearFilter").addEventListener("change", () => {
    renderSubjectOptionsForYear();
    clearFinalize();
  });
  document.getElementById("subjectFilter").addEventListener("change", () => {
    renderClassOptionsForSubject();
    clearFinalize();
  });
  document.getElementById("classFilter").addEventListener("change", loadFinalizeIfReady);
});

async function loadPageData(userId) {
  const result = await callApiCached("getTeacherSubjectsPageData", { userId });
  if (result.status !== "success") return;

  allYears = result.data.academicYears;
  myAssignments = result.data.assignments;

  const yearOptions = allYears.map((y) => `<option value="${y.AcademicYearID}">${y.Year}</option>`).join("");
  document.getElementById("yearFilter").innerHTML = yearOptions;

  const current = allYears.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE");
  if (current) document.getElementById("yearFilter").value = current.AcademicYearID;

  renderSubjectOptionsForYear();
}

function renderSubjectOptionsForYear() {
  const yearId = document.getElementById("yearFilter").value;

  const subjectsInYear = [];
  const seen = {};
  myAssignments
    .filter((a) => String(a.academicYearId) === String(yearId))
    .forEach((a) => {
      if (!seen[a.subjectId]) {
        seen[a.subjectId] = true;
        subjectsInYear.push(a);
      }
    });

  const options = subjectsInYear.map((a) => `<option value="${a.subjectId}">${a.subjectName}</option>`).join("");

  document.getElementById("subjectFilter").innerHTML = `<option value="">- เลือกวิชา -</option>` + options;
  renderClassOptionsForSubject();
}

function renderClassOptionsForSubject() {
  const yearId = document.getElementById("yearFilter").value;
  const subjectId = document.getElementById("subjectFilter").value;

  const classesForSubject = myAssignments.filter(
    (a) => String(a.academicYearId) === String(yearId) && String(a.subjectId) === String(subjectId)
  );

  const options = classesForSubject
    .map((a) => `<option value="${a.classId}">${a.className}</option>`)
    .join("");

  document.getElementById("classFilter").innerHTML = `<option value="">- เลือกห้องเรียน -</option>` + options;
}

function clearFinalize() {
  document.getElementById("classFilter").value = "";
  document.getElementById("finalizeContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
      กรุณาเลือกปีการศึกษา วิชา และห้องเรียน เพื่อดูผลการเรียน
    </div>`;
}

async function loadFinalizeIfReady() {
  const yearId = document.getElementById("yearFilter").value;
  const subjectId = document.getElementById("subjectFilter").value;
  const classId = document.getElementById("classFilter").value;

  if (!yearId || !subjectId || !classId) return;

  document.getElementById("finalizeContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>`;

  const result = await callApi("getFinalizePageData", {
    subjectId,
    academicYearId: yearId,
    classId,
  });

  if (result.status !== "success") {
    document.getElementById("finalizeContent").innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">${result.message}</div>`;
    return;
  }

  currentResults = result.data.students;
  isSubmitted = result.data.isSubmitted;

  renderFinalizeTable();
}

function gradePointClass(gp) {
  if (gp >= 3.5) return "text-green-600";
  if (gp >= 2) return "text-wprimary";
  if (gp > 0) return "text-amber-600";
  return "text-red-600";
}

function renderFinalizeTable() {
  const container = document.getElementById("finalizeContent");

  if (currentResults.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">ไม่พบนักเรียนในห้องเรียนนี้</div>`;
    return;
  }

  const rowsHtml = currentResults
    .map(
      (r, si) => `
    <tr class="${si % 2 === 0 ? "bg-sky-200" : "bg-slate-300"}">
      <td class="px-3 py-2 text-gray-500 text-center whitespace-nowrap border-b-2 border-gray-400">${r.studentNumber}</td>
      <td class="px-3 py-2 text-gray-700 whitespace-nowrap border-l-2 border-b-2 border-gray-400">${r.fullName}</td>
      <td class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400">${r.semester1Raw70.toFixed(2)}</td>
      <td class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400">${r.semester1Exam30.toFixed(2)}</td>
      <td class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400 font-semibold text-wprimary">${r.semester1Total100.toFixed(2)}</td>
      <td class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400">${r.semester2Raw70.toFixed(2)}</td>
      <td class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400">${r.semester2Exam30.toFixed(2)}</td>
      <td class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400 font-semibold text-wprimary">${r.semester2Total100.toFixed(2)}</td>
      <td class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400 font-semibold text-wprimary">${r.yearScore100.toFixed(2)}</td>
      <td class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400 font-bold ${gradePointClass(r.gradePoint)}">${r.gradePoint.toFixed(1)}</td>
    </tr>`
    )
    .join("");

  const buttonHtml = isSubmitted
    ? `<button onclick="withdrawFinalResults()" id="finalizeActionBtn"
        class="px-5 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg">
        <i class="fa-solid fa-rotate-left mr-1.5"></i>ดึงผลการเรียนกลับ
      </button>`
    : `<button onclick="submitFinalResults()" id="finalizeActionBtn"
        class="px-5 py-2.5 text-sm font-medium text-white bg-wprimary hover:bg-wprimary-dark rounded-lg">
        <i class="fa-solid fa-paper-plane mr-1.5"></i>ส่งผลการเรียน
      </button>`;

  container.innerHTML = `
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th rowspan="2" class="px-3 py-2 text-center w-16 border-b-2 border-gray-400">เลขที่</th>
              <th rowspan="2" class="px-3 py-2 text-left border-l-2 border-b-2 border-gray-400">ชื่อ-สกุล</th>
              <th colspan="3" class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400">ภาคเรียนที่ 1</th>
              <th colspan="3" class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400">ภาคเรียนที่ 2</th>
              <th rowspan="2" class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400">คะแนนปีการศึกษา<br><span class="text-gray-400 font-normal">(เต็ม 100)</span></th>
              <th rowspan="2" class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400">ผลการเรียน<br><span class="text-gray-400 font-normal">(0-4)</span></th>
            </tr>
            <tr>
              <th class="px-2 py-2 text-center border-l-2 border-b-2 border-gray-400 font-normal">ระหว่างภาค<br>(70)</th>
              <th class="px-2 py-2 text-center border-l-2 border-b-2 border-gray-400 font-normal">ปลายภาค<br>(30)</th>
              <th class="px-2 py-2 text-center border-l-2 border-b-2 border-gray-400 font-normal">รวม<br>(100)</th>
              <th class="px-2 py-2 text-center border-l-2 border-b-2 border-gray-400 font-normal">ระหว่างภาค<br>(70)</th>
              <th class="px-2 py-2 text-center border-l-2 border-b-2 border-gray-400 font-normal">ปลายภาค<br>(30)</th>
              <th class="px-2 py-2 text-center border-l-2 border-b-2 border-gray-400 font-normal">รวม<br>(100)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="flex items-center justify-end gap-3 p-4 border-t border-gray-100">
        <span id="finalizeStatus" class="text-xs text-gray-500">${isSubmitted ? '<i class="fa-solid fa-circle-check text-green-600 mr-1"></i>ส่งผลการเรียนแล้ว' : ""}</span>
        ${buttonHtml}
      </div>
    </div>`;
}

async function submitFinalResults() {
  const confirmResult = await Swal.fire({
    icon: "question",
    title: "ยืนยันการส่งผลการเรียน",
    text: "ระบบจะบันทึกผลการเรียนของนักเรียนทุกคนในห้องนี้ลงฐานข้อมูล ต้องการดำเนินการต่อหรือไม่",
    showCancelButton: true,
    confirmButtonText: "ส่งผลการเรียน",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#268244",
  });

  if (!confirmResult.isConfirmed) return;

  await runFinalizeAction("submitFinalResults", "กำลังส่งผลการเรียน...", "ส่งผลการเรียนสำเร็จ");
}

async function withdrawFinalResults() {
  const confirmResult = await Swal.fire({
    icon: "warning",
    title: "ยืนยันการดึงผลการเรียนกลับ",
    text: "ผลการเรียนที่บันทึกไว้ของนักเรียนทุกคนในห้องนี้จะถูกลบออกจากฐานข้อมูล ต้องการดำเนินการต่อหรือไม่",
    showCancelButton: true,
    confirmButtonText: "ดึงผลการเรียนกลับ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#d33",
  });

  if (!confirmResult.isConfirmed) return;

  await runFinalizeAction("withdrawFinalResults", "กำลังดึงผลการเรียนกลับ...", "ดึงผลการเรียนกลับสำเร็จ");
}

async function runFinalizeAction(action, loadingText, successText) {
  const yearId = document.getElementById("yearFilter").value;
  const subjectId = document.getElementById("subjectFilter").value;
  const classId = document.getElementById("classFilter").value;
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");

  const btn = document.getElementById("finalizeActionBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${loadingText}`;
  }

  try {
    const result = await callApi(action, {
      subjectId,
      academicYearId: yearId,
      classId,
      userId: userData ? userData.userId : "",
    });

    if (result.status === "success") {
      Swal.fire({ icon: "success", title: successText, confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
      await loadFinalizeIfReady();
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
      renderFinalizeTable();
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
    renderFinalizeTable();
  }
}
