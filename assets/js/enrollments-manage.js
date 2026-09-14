/**
 * W-Score : จัดนักเรียนเข้าห้องเรียน (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 */

let allYears = [];
let allClasses = [];
let currentEnrollments = [];

document.addEventListener("DOMContentLoaded", async function () {
  await loadYearsIntoFilter();
  await loadClassesIntoFilter();

  document.getElementById("yearFilter").addEventListener("change", async () => {
    await loadClassesIntoFilter();
    renderEmptyTable("กรุณาเลือกห้องเรียน");
  });
  document.getElementById("classFilter").addEventListener("change", loadEnrollments);
  document.getElementById("addEnrollmentBtn").addEventListener("click", openEnrollmentModal);
  document.getElementById("enrollmentForm").addEventListener("submit", handleSubmitEnrollment);
});

async function loadYearsIntoFilter() {
  const result = await callApi("getAcademicYears");
  if (result.status !== "success") return;

  allYears = result.data;
  const options = allYears.map((y) => `<option value="${y.AcademicYearID}">${y.Year}</option>`).join("");
  document.getElementById("yearFilter").innerHTML = options;

  const current = allYears.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE");
  if (current) document.getElementById("yearFilter").value = current.AcademicYearID;
}

async function loadClassesIntoFilter() {
  const yearId = document.getElementById("yearFilter").value;
  const result = await callApi("getClasses");
  if (result.status !== "success") return;

  allClasses = result.data.filter((c) => String(c.AcademicYearID) === String(yearId));
  const options = allClasses
    .map((c) => `<option value="${c.ClassID}">${c.GradeLevel}/${c.RoomNumber}</option>`)
    .join("");

  document.getElementById("classFilter").innerHTML = `<option value="">- เลือกห้องเรียน -</option>` + options;
}

function renderEmptyTable(message) {
  document.getElementById("enrollmentTableBody").innerHTML =
    `<tr><td colspan="4" class="text-center text-gray-400 py-6">${message}</td></tr>`;
}

async function loadEnrollments() {
  const classId = document.getElementById("classFilter").value;
  if (!classId) {
    renderEmptyTable("กรุณาเลือกห้องเรียน");
    return;
  }

  renderEmptyTable("กำลังโหลดข้อมูล...");

  try {
    const result = await callApi("getEnrollmentsByClass", { classId });

    if (result.status !== "success") {
      renderEmptyTable(result.message);
      return;
    }

    currentEnrollments = result.data;
    renderEnrollmentTable(currentEnrollments);
  } catch (err) {
    renderEmptyTable("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
  }
}

function renderEnrollmentTable(enrollments) {
  const tbody = document.getElementById("enrollmentTableBody");

  if (enrollments.length === 0) {
    renderEmptyTable("ยังไม่มีนักเรียนในห้องนี้");
    return;
  }

  tbody.innerHTML = enrollments
    .map(
      (en) => `
    <tr class="border-b border-gray-100">
      <td class="px-4 py-3 font-medium text-wsecondary">${en.studentNumber}</td>
      <td class="px-4 py-3 text-gray-600">${en.studentId}</td>
      <td class="px-4 py-3 text-gray-700">${en.fullName}</td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <button onclick='openEnrollmentModal(${JSON.stringify(en)})' class="text-wprimary hover:underline text-xs font-medium mr-3">แก้ไขเลขที่</button>
        <button onclick="deleteEnrollment('${en.enrollmentId}')" class="text-red-500 hover:underline text-xs font-medium">นำออก</button>
      </td>
    </tr>`
    )
    .join("");
}

let availableStudentsMap = {};
let importedValidStudentIds = [];

async function openEnrollmentModal(data) {
  const classId = document.getElementById("classFilter").value;
  if (!classId) {
    Swal.fire({ icon: "warning", title: "กรุณาเลือกห้องเรียนก่อน", confirmButtonColor: "#268244" });
    return;
  }

  document.getElementById("enrollmentForm").reset();
  document.getElementById("importPreview").classList.add("hidden");
  document.getElementById("importInvalidNote").classList.add("hidden");
  importedValidStudentIds = [];

  const isEdit = !!(data && data.enrollmentId);
  document.getElementById("f-isEdit").value = isEdit ? "1" : "0";
  document.getElementById("f-enrollmentId").value = isEdit ? data.enrollmentId : "";
  document.getElementById("modalTitle").textContent = isEdit ? "แก้ไขเลขที่ในห้อง" : "เพิ่มนักเรียนเข้าห้อง (นำเข้าจากไฟล์)";

  document.getElementById("f-editWrap").classList.toggle("hidden", !isEdit);
  document.getElementById("f-importWrap").classList.toggle("hidden", isEdit);

  if (isEdit) {
    document.getElementById("f-studentId").innerHTML = `<option value="${data.studentId}">${data.studentId} - ${data.fullName}</option>`;
    document.getElementById("f-studentNumber").value = data.studentNumber;
    document.getElementById("f-studentNumber").required = true;
  } else {
    document.getElementById("f-studentNumber").required = false;

    const yearId = document.getElementById("yearFilter").value;
    const result = await callApi("getAvailableStudents", { academicYearId: yearId });
    availableStudentsMap = {};
    if (result.status === "success") {
      result.data.forEach((s) => {
        availableStudentsMap[String(s.studentId)] = s.fullName;
      });
    }

    document.getElementById("f-importFile").value = "";
    document.getElementById("downloadTemplateBtn").onclick = downloadImportTemplate;
    document.getElementById("f-importFile").onchange = handleImportFileChange;
  }

  document.getElementById("enrollmentModal").classList.remove("hidden");
}

function downloadImportTemplate() {
  const wsData = [["รหัสประจำตัวนักเรียน"], ["S0001"], ["S0002"]];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "รายชื่อนักเรียน");
  XLSX.writeFile(wb, "แบบฟอร์มนำเข้านักเรียนเข้าห้อง.xlsx");
}

function handleImportFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const header = (rows[0] || []).map((h) => String(h).trim());
      let colIndex = header.findIndex((h) => h.indexOf("รหัสประจำตัว") !== -1);
      if (colIndex === -1) colIndex = 0;

      const rawIds = rows
        .slice(1)
        .map((r) => (r[colIndex] !== undefined ? String(r[colIndex]).trim() : ""))
        .filter((id) => id !== "");

      renderImportPreview(rawIds);
    } catch (err) {
      Swal.fire({ icon: "error", title: "ไม่สามารถอ่านไฟล์นี้ได้", text: "กรุณาตรวจสอบรูปแบบไฟล์", confirmButtonColor: "#268244" });
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderImportPreview(rawIds) {
  const validIds = [];
  const invalidIds = [];

  rawIds.forEach((id) => {
    if (availableStudentsMap.hasOwnProperty(id)) {
      validIds.push(id);
    } else {
      invalidIds.push(id);
    }
  });

  validIds.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  importedValidStudentIds = validIds;

  const listEl = document.getElementById("importPreviewList");
  document.getElementById("importPreview").classList.remove("hidden");
  document.getElementById("importValidCount").textContent = validIds.length;

  if (validIds.length === 0) {
    listEl.innerHTML = `<div class="text-center text-gray-400 text-sm py-4">ไม่พบรหัสนักเรียนที่นำเข้าได้</div>`;
  } else {
    listEl.innerHTML = validIds.map((id) => `<div class="px-3 py-2">${id} - ${availableStudentsMap[id]}</div>`).join("");
  }

  const invalidNote = document.getElementById("importInvalidNote");
  if (invalidIds.length > 0) {
    invalidNote.textContent = `พบ ${invalidIds.length} รหัสที่ไม่ถูกต้อง หรือถูกจัดเข้าห้องเรียนไปแล้ว: ${invalidIds.join(", ")}`;
    invalidNote.classList.remove("hidden");
  } else {
    invalidNote.classList.add("hidden");
  }
}

function renderStudentCheckboxList(students) {
  const container = document.getElementById("studentCheckboxList");

  if (students.length === 0) {
    container.innerHTML = `<div class="text-center text-gray-400 text-sm py-4">ไม่พบนักเรียนที่ยังไม่ถูกจัดห้อง</div>`;
    return;
  }

  container.innerHTML = students
    .map(
      (s) => `
    <label class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer student-checkbox-row" data-label="${s.studentId} ${s.fullName}">
      <input type="checkbox" class="student-checkbox" value="${s.studentId}" onchange="updateSelectedCount()">
      <span>${s.studentId} - ${s.fullName}</span>
    </label>`
    )
    .join("");

  updateSelectedCount();
}

function filterStudentCheckboxList() {
  const keyword = document.getElementById("f-studentSearch").value.trim().toLowerCase();
  document.querySelectorAll("#studentCheckboxList .student-checkbox-row").forEach((row) => {
    const label = row.getAttribute("data-label").toLowerCase();
    row.style.display = label.includes(keyword) ? "" : "none";
  });
}

function toggleSelectAll() {
  const checked = document.getElementById("f-selectAll").checked;
  document.querySelectorAll("#studentCheckboxList .student-checkbox-row").forEach((row) => {
    if (row.style.display !== "none") {
      row.querySelector(".student-checkbox").checked = checked;
    }
  });
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = document.querySelectorAll("#studentCheckboxList .student-checkbox:checked").length;
  document.getElementById("selectedCount").textContent = `เลือกแล้ว ${count} คน`;
}

function getSelectedStudentIds() {
  return Array.from(document.querySelectorAll("#studentCheckboxList .student-checkbox:checked")).map((el) => el.value);
}
function closeEnrollmentModal() {
  document.getElementById("enrollmentModal").classList.add("hidden");
}

async function handleSubmitEnrollment(e) {
  e.preventDefault();

  const isEdit = document.getElementById("f-isEdit").value === "1";
  const classId = document.getElementById("classFilter").value;
  const yearId = document.getElementById("yearFilter").value;

  const submitBtn = document.querySelector("#enrollmentForm button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';

  try {
    let result;

    if (isEdit) {
  const submitBtn = document.querySelector("#enrollmentForm button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';

  try {
    let result;

    if (isEdit) {
      const payload = {
        enrollmentId: document.getElementById("f-enrollmentId").value,
        studentNumber: document.getElementById("f-studentNumber").value,
      };
      result = await callApi("updateEnrollmentNumber", payload);
    } else {
      if (importedValidStudentIds.length === 0) {
        Swal.fire({ icon: "warning", title: "กรุณาอัพโหลดไฟล์รายชื่อนักเรียนก่อน", confirmButtonColor: "#268244" });
        submitBtn.disabled = false;
        submitBtn.innerHTML = "บันทึก";
        return;
      }
      result = await callApi("addEnrollmentsBulk", { studentIds: importedValidStudentIds, classId, academicYearId: yearId });
    }

    if (result.status === "success") {
      closeEnrollmentModal();
      Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
      loadEnrollments();
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = "บันทึก";
  }
}

async function deleteEnrollment(enrollmentId) {
  const confirmResult = await Swal.fire({
    icon: "warning",
    title: "ยืนยันการนำออก",
    text: "ต้องการนำนักเรียนออกจากห้องนี้ใช่หรือไม่",
    showCancelButton: true,
    confirmButtonText: "นำออก",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#d33",
  });

  if (!confirmResult.isConfirmed) return;

  const result = await callApi("deleteEnrollment", { enrollmentId });

  if (result.status === "success") {
    Swal.fire({ icon: "success", title: "นำออกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    loadEnrollments();
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}
