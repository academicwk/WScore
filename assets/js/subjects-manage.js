/**
 * W-Score : จัดการหลักสูตร/รายวิชา (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 */

let allSubjects = [];
let importPreviewResults = []; // [{ row, error }] ผลตรวจสอบไฟล์ที่นำเข้าล่าสุด

const VALID_SUBJECT_TYPES = ["พื้นฐาน", "เพิ่มเติม", "กิจกรรมพัฒนาผู้เรียน"];
const VALID_GRADE_LEVELS = ["อนุบาล 1", "อนุบาล 2", "อนุบาล 3", "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"];

document.addEventListener("DOMContentLoaded", function () {
  loadSubjects();

  document.getElementById("addSubjectBtn").addEventListener("click", () => openSubjectModal("add"));
  document.getElementById("subjectForm").addEventListener("submit", handleSubmitSubject);
  document.getElementById("searchInput").addEventListener("input", debounce(handleSearch, 250));

  // ประเภทวิชา -> กำหนดรูปแบบการประเมินอัตโนมัติ
  document.getElementById("f-subjectType").addEventListener("change", function () {
    updateEvaluationType();
  });

  // กลุ่มสาระการเรียนรู้ -> กำหนดตัวเลือกกลุ่มสาระย่อยอัตโนมัติ
  document.getElementById("f-subjectGroup").addEventListener("change", function () {
    updateSubGroupOptions();
  });

  // หน่วยกิต -> คำนวณชั่วโมงอัตโนมัติ (1 นก. = 40 ชม.)
  document.getElementById("f-credit").addEventListener("change", function () {
    document.getElementById("f-hours").value = Number(this.value || 0) * 40;
  });

  // นำเข้ารายวิชาจากไฟล์เทมเพลต
  document.getElementById("importSubjectBtn").addEventListener("click", openImportModal);
  document.getElementById("downloadTemplateBtn").addEventListener("click", downloadSubjectTemplate);
  document.getElementById("importFileInput").addEventListener("change", handleImportFileChange);
});

function updateEvaluationType() {
  const subjectType = document.getElementById("f-subjectType").value;
  const evaluationSelect = document.getElementById("f-evaluationType");
  evaluationSelect.value =
    subjectType === "กิจกรรมพัฒนาผู้เรียน" ? "ผ่าน-ไม่ผ่าน (ผ/มผ)" : "ระดับคะแนน (0-4)";
}

function updateSubGroupOptions(selectedValue) {
  const subjectGroup = document.getElementById("f-subjectGroup").value;
  const subGroupSelect = document.getElementById("f-subjectSubGroup");

  let options = ["-"];
  let disabled = true;

  if (subjectGroup === "วิทยาศาสตร์และเทคโนโลยี") {
    options = ["วิทยาศาสตร์", "เทคโนโลยี"];
    disabled = false;
  } else if (subjectGroup === "ภาษาต่างประเทศ") {
    options = ["ภาษาอังกฤษ", "ภาษาจีน"];
    disabled = false;
  }

  subGroupSelect.innerHTML = options.map((o) => `<option value="${o}">${o}</option>`).join("");
  subGroupSelect.disabled = disabled;

  if (selectedValue && options.includes(selectedValue)) {
    subGroupSelect.value = selectedValue;
  }
}

async function loadSubjects() {
  const tbody = document.getElementById("subjectTableBody");
  tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-400 py-6">กำลังโหลดข้อมูล...</td></tr>`;

  try {
    const result = await callApiCached("getSubjects");

    if (result.status !== "success") {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red-500 py-6">${result.message}</td></tr>`;
      return;
    }

    allSubjects = result.data;
    renderSubjectTable(allSubjects);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red-500 py-6">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</td></tr>`;
  }
}

function renderSubjectTable(subjects) {
  const tbody = document.getElementById("subjectTableBody");

  if (subjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-400 py-6">ไม่พบข้อมูลรายวิชา</td></tr>`;
    return;
  }

  tbody.innerHTML = subjects
    .map(
      (s) => `
    <tr class="border-b border-gray-100">
      <td class="px-4 py-3 font-medium text-wsecondary">${s.SubjectID}</td>
      <td class="px-4 py-3 text-gray-700">${s.SubjectName}</td>
      <td class="px-4 py-3 text-gray-600">${s.SubjectType}</td>
      <td class="px-4 py-3 text-gray-600">${s.EvaluationType}</td>
      <td class="px-4 py-3 text-center text-gray-600">${s.Credit}</td>
      <td class="px-4 py-3 text-center text-gray-600">${s.Hours}</td>
      <td class="px-4 py-3 text-gray-600">${s.GradeLevel}</td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <button onclick='openSubjectModal("edit", ${JSON.stringify(s)})' class="text-wprimary hover:underline text-xs font-medium mr-3">แก้ไข</button>
        <button onclick="deleteSubject('${s.SubjectID}')" class="text-red-500 hover:underline text-xs font-medium">ลบ</button>
      </td>
    </tr>`
    )
    .join("");
}

function handleSearch() {
  const keyword = this.value?.trim().toLowerCase() ?? document.getElementById("searchInput").value.trim().toLowerCase();
  const filtered = allSubjects.filter(
    (s) =>
      String(s.SubjectID).toLowerCase().includes(keyword) ||
      String(s.SubjectName).toLowerCase().includes(keyword)
  );
  renderSubjectTable(filtered);
}

function openSubjectModal(mode, data) {
  document.getElementById("subjectForm").reset();
  document.getElementById("f-isEdit").value = mode === "edit" ? "1" : "0";
  document.getElementById("modalTitle").textContent = mode === "edit" ? "แก้ไขรายวิชา" : "เพิ่มรายวิชาใหม่";
  document.getElementById("f-subjectId").disabled = mode === "edit";

  if (mode === "edit" && data) {
    document.getElementById("f-subjectId").value = data.SubjectID;
    document.getElementById("f-subjectName").value = data.SubjectName;
    document.getElementById("f-subjectType").value = data.SubjectType;
    document.getElementById("f-subjectGroup").value = data.SubjectGroup || "";
    document.getElementById("f-credit").value = data.Credit;
    document.getElementById("f-hours").value = data.Hours;
    document.getElementById("f-gradeLevel").value = data.GradeLevel;
    updateEvaluationType();
    updateSubGroupOptions(data.SubjectSubGroup);
  } else {
    updateEvaluationType();
    updateSubGroupOptions();
    document.getElementById("f-hours").value = Number(document.getElementById("f-credit").value || 1) * 40;
  }

  document.getElementById("subjectModal").classList.remove("hidden");
}
function closeSubjectModal() {
  document.getElementById("subjectModal").classList.add("hidden");
}

async function handleSubmitSubject(e) {
  e.preventDefault();

  const isEdit = document.getElementById("f-isEdit").value === "1";
  const payload = {
    subjectId: document.getElementById("f-subjectId").value.trim(),
    subjectName: document.getElementById("f-subjectName").value.trim(),
    subjectType: document.getElementById("f-subjectType").value,
    evaluationType: document.getElementById("f-evaluationType").value,
    subjectGroup: document.getElementById("f-subjectGroup").value.trim(),
    subjectSubGroup: document.getElementById("f-subjectSubGroup").value.trim(),
    credit: document.getElementById("f-credit").value,
    hours: document.getElementById("f-hours").value,
    gradeLevel: document.getElementById("f-gradeLevel").value,
  };

  setSubjectFormLoading(true);

  try {
    const result = await callApi(isEdit ? "updateSubject" : "addSubject", payload);

    if (result.status === "success") {
      closeSubjectModal();
      clearApiCache("getSubjects");
      Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
      loadSubjects();
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    setSubjectFormLoading(false);
  }
}

function setSubjectFormLoading(isLoading) {
  const submitBtn = document.querySelector("#subjectForm button[type='submit']");
  submitBtn.disabled = isLoading;
  submitBtn.innerHTML = isLoading
    ? '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...'
    : "บันทึก";
}

async function deleteSubject(subjectId) {
  const confirmResult = await Swal.fire({
    icon: "warning",
    title: "ยืนยันการลบ",
    text: `ต้องการลบรายวิชา ${subjectId} ใช่หรือไม่ ข้อมูลนี้ไม่สามารถกู้คืนได้`,
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#d33",
  });

  if (!confirmResult.isConfirmed) return;

  const result = await callApi("deleteSubject", { subjectId });

  if (result.status === "success") {
    clearApiCache("getSubjects");
    Swal.fire({ icon: "success", title: "ลบสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    loadSubjects();
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}

// ===== นำเข้ารายวิชาจากไฟล์เทมเพลต =====

function openImportModal() {
  importPreviewResults = [];
  document.getElementById("importFileInput").value = "";
  document.getElementById("importFileName").textContent = "";
  document.getElementById("importPreviewWrap").classList.add("hidden");
  document.getElementById("importPreviewBody").innerHTML = "";
  document.getElementById("importSummaryText").textContent = "";
  document.getElementById("confirmImportBtn").disabled = true;
  document.getElementById("importModal").classList.remove("hidden");
}

function closeImportModal() {
  document.getElementById("importModal").classList.add("hidden");
}

function downloadSubjectTemplate() {
  const headers = ["รหัสวิชา", "ชื่อวิชา", "ประเภทวิชา", "กลุ่มสาระการเรียนรู้", "กลุ่มย่อย", "หน่วยกิต", "ระดับชั้น"];
  const exampleRows = [
    ["ท11101", "ภาษาไทย", "พื้นฐาน", "ภาษาไทย", "", 1, "ป.1"],
    ["ค11101", "คณิตศาสตร์", "พื้นฐาน", "คณิตศาสตร์", "", 1, "ป.1"],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "รายวิชา");
  XLSX.writeFile(wb, "เทมเพลตนำเข้ารายวิชา.xlsx");
}

function handleImportFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById("importFileName").textContent = file.name;

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const parsedRows = rows.map((r) => ({
        subjectId: String(r["รหัสวิชา"] || "").trim(),
        subjectName: String(r["ชื่อวิชา"] || "").trim(),
        subjectType: String(r["ประเภทวิชา"] || "").trim(),
        subjectGroup: String(r["กลุ่มสาระการเรียนรู้"] || "").trim(),
        subjectSubGroup: String(r["กลุ่มย่อย"] || "").trim(),
        credit: r["หน่วยกิต"],
        gradeLevel: String(r["ระดับชั้น"] || "").trim(),
      }));

      renderImportPreview(parsedRows);
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "อ่านไฟล์ไม่สำเร็จ",
        text: "กรุณาตรวจสอบว่าไฟล์เป็น .xlsx หรือ .csv ที่ถูกต้อง และมีหัวตารางตรงตามเทมเพลต",
        confirmButtonColor: "#268244",
      });
    }
  };
  reader.readAsArrayBuffer(file);
}

function validateImportRow(row, seenIds) {
  if (!row.subjectId || !row.subjectName || !row.subjectType || !row.gradeLevel) {
    return "ข้อมูลไม่ครบ (ต้องมีรหัสวิชา/ชื่อวิชา/ประเภทวิชา/ระดับชั้น)";
  }
  if (!VALID_SUBJECT_TYPES.includes(row.subjectType)) {
    return `ประเภทวิชาไม่ถูกต้อง (ต้องเป็น ${VALID_SUBJECT_TYPES.join(" / ")})`;
  }
  if (!VALID_GRADE_LEVELS.includes(row.gradeLevel)) {
    return "ระดับชั้นไม่ถูกต้อง";
  }
  if (allSubjects.some((s) => String(s.SubjectID) === String(row.subjectId))) {
    return "มีรหัสวิชานี้อยู่ในระบบแล้ว";
  }
  if (seenIds.has(row.subjectId)) {
    return "รหัสวิชาซ้ำกันในไฟล์";
  }
  return null;
}

function renderImportPreview(parsedRows) {
  const seenIds = new Set();

  importPreviewResults = parsedRows.map((row) => {
    const error = validateImportRow(row, seenIds);
    if (!error) seenIds.add(row.subjectId);
    return { row, error };
  });

  const validCount = importPreviewResults.filter((r) => !r.error).length;
  const invalidCount = importPreviewResults.length - validCount;

  document.getElementById("importPreviewWrap").classList.remove("hidden");
  document.getElementById("importSummaryText").textContent =
    `พร้อมนำเข้า ${validCount} รายการ` + (invalidCount > 0 ? ` / ข้าม ${invalidCount} รายการ` : "");

  document.getElementById("importPreviewBody").innerHTML = importPreviewResults
    .map(
      ({ row, error }) => `
    <tr class="border-b border-gray-100 ${error ? "bg-red-50" : ""}">
      <td class="px-3 py-2">${row.subjectId}</td>
      <td class="px-3 py-2">${row.subjectName}</td>
      <td class="px-3 py-2">${row.subjectType}</td>
      <td class="px-3 py-2">${row.gradeLevel}</td>
      <td class="px-3 py-2 text-xs ${error ? "text-red-600" : "text-wprimary"}">${error || "พร้อมนำเข้า"}</td>
    </tr>`
    )
    .join("");

  document.getElementById("confirmImportBtn").disabled = validCount === 0;
}

async function handleConfirmImport() {
  const validRows = importPreviewResults.filter((r) => !r.error).map((r) => r.row);
  if (validRows.length === 0) {
    Swal.fire({ icon: "warning", title: "ไม่มีรายวิชาที่พร้อมนำเข้า", confirmButtonColor: "#268244" });
    return;
  }

  const confirmResult = await Swal.fire({
    icon: "question",
    title: "ยืนยันการนำเข้า",
    text: `พบรายวิชาที่พร้อมนำเข้า ${validRows.length} รายการ ต้องการนำเข้าใช่หรือไม่`,
    showCancelButton: true,
    confirmButtonText: "นำเข้า",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#268244",
  });

  if (!confirmResult.isConfirmed) return;

  const btn = document.getElementById("confirmImportBtn");
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังนำเข้า...';

  try {
    const result = await callApi("addSubjectsBulk", { subjects: validRows });

    if (result.status === "success") {
      closeImportModal();
      clearApiCache("getSubjects");
      await loadSubjects();
      Swal.fire({ icon: "success", title: "นำเข้าเสร็จสิ้น", text: result.message, confirmButtonColor: "#268244" });
    } else {
      Swal.fire({ icon: "error", title: "นำเข้าไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    const context = this;
    timer = setTimeout(() => fn.apply(context, args), delay);
  };
}
