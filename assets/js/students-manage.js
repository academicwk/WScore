/**
 * W-Score : จัดการข้อมูลนักเรียน (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 */

let allStudents = [];

document.addEventListener("DOMContentLoaded", function () {
  loadStudents();

  document.getElementById("addStudentBtn").addEventListener("click", () => openStudentModal("add"));
  document.getElementById("studentForm").addEventListener("submit", handleSubmitStudent);
  document.getElementById("searchInput").addEventListener("input", handleSearch);

  // คำนำหน้า -> กำหนดเพศอัตโนมัติ
  document.getElementById("f-prefixName").addEventListener("change", function () {
    updateGenderFromPrefix();
  });
});

function updateGenderFromPrefix() {
  const prefix = document.getElementById("f-prefixName").value;
  const genderSelect = document.getElementById("f-gender");
  genderSelect.value = prefix === "เด็กชาย" || prefix === "นาย" ? "ชาย" : "หญิง";
}

async function loadStudents() {
  const tbody = document.getElementById("studentTableBody");
  tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-6">กำลังโหลดข้อมูล...</td></tr>`;

  try {
    const result = await callApi("getStudents");

    if (result.status !== "success") {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-6">${result.message}</td></tr>`;
      return;
    }

    allStudents = result.data;
    renderStudentTable(allStudents);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-6">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</td></tr>`;
  }
}

function renderStudentTable(students) {
  const tbody = document.getElementById("studentTableBody");

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-6">ไม่พบข้อมูลนักเรียน</td></tr>`;
    return;
  }

  tbody.innerHTML = students
    .map(
      (s) => `
    <tr class="border-b border-gray-100">
      <td class="px-4 py-3 font-medium text-wsecondary">${s.StudentID}</td>
      <td class="px-4 py-3 text-gray-700">${s.PrefixName}${s.FirstName} ${s.LastName}</td>
      <td class="px-4 py-3 text-gray-600">${s.Gender}</td>
      <td class="px-4 py-3 text-gray-600">${formatDate(s.BirthDate)}</td>
      <td class="px-4 py-3 text-center">
        <span class="text-xs font-medium px-2.5 py-1 rounded-full ${statusBadgeClass(s.Status)}">${s.Status}</span>
      </td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <button onclick='openStudentModal("edit", ${JSON.stringify(s)})' class="text-wprimary hover:underline text-xs font-medium mr-3">แก้ไข</button>
        <button onclick="deleteStudent('${s.StudentID}')" class="text-red-500 hover:underline text-xs font-medium">ลบ</button>
      </td>
    </tr>`
    )
    .join("");
}

function statusBadgeClass(status) {
  if (status === "กำลังศึกษา") return "bg-wprimary-light text-wprimary";
  if (status === "จบการศึกษา") return "bg-blue-50 text-blue-600";
  return "bg-gray-100 text-gray-500";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function handleSearch() {
  const keyword = this.value.trim().toLowerCase();
  const filtered = allStudents.filter(
    (s) =>
      String(s.StudentID).toLowerCase().includes(keyword) ||
      String(s.FirstName || "").toLowerCase().includes(keyword) ||
      String(s.LastName || "").toLowerCase().includes(keyword)
  );
  renderStudentTable(filtered);
}

function openStudentModal(mode, data) {
  document.getElementById("studentForm").reset();
  document.getElementById("f-isEdit").value = mode === "edit" ? "1" : "0";
  document.getElementById("modalTitle").textContent = mode === "edit" ? "แก้ไขข้อมูลนักเรียน" : "เพิ่มนักเรียนใหม่";
  document.getElementById("f-studentId").disabled = mode === "edit";

  if (mode === "edit" && data) {
    document.getElementById("f-studentId").value = data.StudentID;
    document.getElementById("f-citizenId").value = data.CitizenID || "";
    document.getElementById("f-prefixName").value = data.PrefixName;
    document.getElementById("f-firstName").value = data.FirstName;
    document.getElementById("f-lastName").value = data.LastName;
    document.getElementById("f-birthDate").value = formatDateForInput(data.BirthDate);
    document.getElementById("f-religion").value = data.Religion || "";
    document.getElementById("f-fatherName").value = data.FatherName || "";
    document.getElementById("f-motherName").value = data.MotherName || "";
    document.getElementById("f-previousSchool").value = data.PreviousSchool || "";
    document.getElementById("f-previousSchoolProvince").value = data.PreviousSchoolProvince || "";
    document.getElementById("f-lastGradeLevel").value = data.LastGradeLevel || "";
    document.getElementById("f-status").value = data.Status;
    document.getElementById("f-admissionDate").value = formatDateForInput(data.AdmissionDate);
  } else {
    document.getElementById("f-prefixName").value = "เด็กชาย";
  }

  updateGenderFromPrefix();

  document.getElementById("studentModal").classList.remove("hidden");
}

function formatDateForInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function closeStudentModal() {
  document.getElementById("studentModal").classList.add("hidden");
}

async function handleSubmitStudent(e) {
  e.preventDefault();

  const isEdit = document.getElementById("f-isEdit").value === "1";
  const payload = {
    studentId: document.getElementById("f-studentId").value.trim(),
    citizenId: document.getElementById("f-citizenId").value.trim(),
    prefixName: document.getElementById("f-prefixName").value,
    firstName: document.getElementById("f-firstName").value.trim(),
    lastName: document.getElementById("f-lastName").value.trim(),
    gender: document.getElementById("f-gender").value,
    birthDate: document.getElementById("f-birthDate").value,
    religion: document.getElementById("f-religion").value.trim(),
    fatherName: document.getElementById("f-fatherName").value.trim(),
    motherName: document.getElementById("f-motherName").value.trim(),
    previousSchool: document.getElementById("f-previousSchool").value.trim(),
    previousSchoolProvince: document.getElementById("f-previousSchoolProvince").value.trim(),
    lastGradeLevel: document.getElementById("f-lastGradeLevel").value.trim(),
    status: document.getElementById("f-status").value,
    admissionDate: document.getElementById("f-admissionDate").value,
  };

  setStudentFormLoading(true);

  try {
    const result = await callApi(isEdit ? "updateStudent" : "addStudent", payload);

    if (result.status === "success") {
      closeStudentModal();
      Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
      loadStudents();
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    setStudentFormLoading(false);
  }
}

function setStudentFormLoading(isLoading) {
  const submitBtn = document.querySelector("#studentForm button[type='submit']");
  submitBtn.disabled = isLoading;
  submitBtn.innerHTML = isLoading
    ? '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...'
    : "บันทึก";
}

async function deleteStudent(studentId) {
  const confirmResult = await Swal.fire({
    icon: "warning",
    title: "ยืนยันการลบ",
    text: `ต้องการลบข้อมูลนักเรียนรหัส ${studentId} ใช่หรือไม่ ข้อมูลนี้ไม่สามารถกู้คืนได้`,
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#d33",
  });

  if (!confirmResult.isConfirmed) return;

  const result = await callApi("deleteStudent", { studentId });

  if (result.status === "success") {
    Swal.fire({ icon: "success", title: "ลบสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    loadStudents();
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}
