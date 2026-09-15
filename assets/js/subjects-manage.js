/**
 * W-Score : จัดการหลักสูตร/รายวิชา (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 */

let allSubjects = [];

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
    const result = await callApi("getSubjects");

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
    Swal.fire({ icon: "success", title: "ลบสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    loadSubjects();
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
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
