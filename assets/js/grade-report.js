/**
 * W-Score : รายงาน ปถ.05 (สำหรับครูประจำวิชา)
 * ให้ครูเลือกปีการศึกษา วิชา และห้องเรียนที่ตนเองสอน แล้วกดสร้างรายงาน
 * แบบบันทึกผลการพัฒนาคุณภาพของผู้เรียนรายวิชา (ปถ.05) เป็นไฟล์ PDF (ดาวน์โหลดทันที)
 */

let allYears = [];
let myAssignments = [];
let selectedInfo = null;

document.addEventListener("DOMContentLoaded", async function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  if (!userData) return;

  await loadPageData(userData.userId);

  document.getElementById("yearFilter").addEventListener("change", () => {
    renderSubjectOptionsForYear();
    clearReport();
  });
  document.getElementById("subjectFilter").addEventListener("change", () => {
    renderClassOptionsForSubject();
    clearReport();
  });
  document.getElementById("classFilter").addEventListener("change", showReportReady);
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

function clearReport() {
  document.getElementById("classFilter").value = "";
  selectedInfo = null;
  document.getElementById("reportContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
      กรุณาเลือกปีการศึกษา วิชา และห้องเรียน เพื่อออกรายงาน
    </div>`;
}

function showReportReady() {
  const yearId = document.getElementById("yearFilter").value;
  const subjectId = document.getElementById("subjectFilter").value;
  const classId = document.getElementById("classFilter").value;

  if (!yearId || !subjectId || !classId) {
    clearReport();
    return;
  }

  const yearOption = document.getElementById("yearFilter").selectedOptions[0];
  const subjectOption = document.getElementById("subjectFilter").selectedOptions[0];
  const classOption = document.getElementById("classFilter").selectedOptions[0];

  selectedInfo = {
    yearId,
    subjectId,
    classId,
    yearText: yearOption ? yearOption.textContent : "",
    subjectText: subjectOption ? subjectOption.textContent : "",
    classText: classOption ? classOption.textContent : "",
  };

  document.getElementById("reportContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="text-sm text-gray-600">
          <div><span class="text-gray-400">ปีการศึกษา:</span> <span class="font-medium text-gray-700">${selectedInfo.yearText}</span></div>
          <div><span class="text-gray-400">รายวิชา:</span> <span class="font-medium text-gray-700">${selectedInfo.subjectText}</span></div>
          <div><span class="text-gray-400">ห้องเรียน:</span> <span class="font-medium text-gray-700">${selectedInfo.classText}</span></div>
        </div>
        <button onclick="generateReport()" id="generateReportBtn"
          class="px-5 py-2.5 text-sm font-medium text-white bg-wprimary hover:bg-wprimary-dark rounded-lg whitespace-nowrap">
          <i class="fa-solid fa-file-pdf mr-1.5"></i>สร้างรายงาน ปถ.05 (PDF)
        </button>
      </div>
    </div>`;
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

async function generateReport() {
  if (!selectedInfo) return;

  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  const btn = document.getElementById("generateReportBtn");

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>กำลังสร้างรายงาน...`;
  }

  try {
    const result = await callApi("generateSubjectReport", {
      subjectId: selectedInfo.subjectId,
      academicYearId: selectedInfo.yearId,
      classId: selectedInfo.classId,
      userId: userData ? userData.userId : "",
    });

    if (result.status === "success") {
      downloadPdfFromBase64(result.data.base64, result.data.fileName);
      Swal.fire({ icon: "success", title: "สร้างรายงานสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-file-pdf mr-1.5"></i>สร้างรายงาน ปถ.05 (PDF)`;
    }
  }
}
