/**
 * W-Score : จัดการห้องเรียน (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 */

let allClasses = [];
let allYears = [];
let allTeachers = [];

document.addEventListener("DOMContentLoaded", async function () {
  await loadPageData();

  document.getElementById("addClassBtn").addEventListener("click", () => openClassModal("add"));
  document.getElementById("classForm").addEventListener("submit", handleSubmitClass);
  document.getElementById("yearFilter").addEventListener("change", renderFilteredClasses);
});

async function loadPageData() {
  const tbody = document.getElementById("classTableBody");
  tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-6">กำลังโหลดข้อมูล...</td></tr>`;

  try {
    const result = await callApiCached("getClassesPageData");
    
    if (result.status !== "success") {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-6">${result.message}</td></tr>`;
      return;
    }

    allYears = result.data.academicYears;
    allTeachers = result.data.homeroomTeachers;
    allClasses = result.data.classes;

    const yearOptions = allYears.map((y) => `<option value="${y.AcademicYearID}">${y.Year}</option>`).join("");
    document.getElementById("yearFilter").innerHTML = yearOptions;
    document.getElementById("f-academicYearId").innerHTML = yearOptions;

    const current = allYears.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE");
    if (current) {
      document.getElementById("yearFilter").value = current.AcademicYearID;
      document.getElementById("f-academicYearId").value = current.AcademicYearID;
    }

    const teacherOptions = allTeachers.map((u) => `<option value="${u.userId}">${u.fullName}</option>`).join("");
    document.getElementById("f-homeroomTeacherUserId").innerHTML = `<option value="">- ยังไม่กำหนด -</option>` + teacherOptions;
    document.getElementById("f-homeroomTeacherUserId2").innerHTML = `<option value="">- ไม่มี -</option>` + teacherOptions;

    renderFilteredClasses();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-6">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</td></tr>`;
  }
}

async function loadClasses() {
  const tbody = document.getElementById("classTableBody");
  tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-6">กำลังโหลดข้อมูล...</td></tr>`;

  try {
    const result = await callApi("getClasses");

    if (result.status !== "success") {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-6">${result.message}</td></tr>`;
      return;
    }

    allClasses = result.data;
    renderFilteredClasses();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-6">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</td></tr>`;
  }
}

function renderFilteredClasses() {
  const yearId = document.getElementById("yearFilter").value;
  const filtered = allClasses.filter((c) => String(c.AcademicYearID) === String(yearId));
  renderClassTable(filtered);
}

function teacherName(userId) {
  if (!userId) return "-";
  const found = allTeachers.find((u) => String(u.userId) === String(userId));
  return found ? found.fullName : userId;
}

function renderClassTable(classes) {
  const tbody = document.getElementById("classTableBody");

  if (classes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-6">ยังไม่มีห้องเรียนในปีการศึกษานี้</td></tr>`;
    return;
  }

  tbody.innerHTML = classes
    .map(
      (c) => `
    <tr class="border-b border-gray-100">
      <td class="px-4 py-3 font-medium text-wsecondary">${c.GradeLevel}/${c.RoomNumber}</td>
      <td class="px-4 py-3 text-gray-600">${c.AcademicYearID}</td>
      <td class="px-4 py-3 text-gray-600">${teacherName(c.HomeroomTeacherUserID)}</td>
      <td class="px-4 py-3 text-gray-600">${teacherName(c.HomeroomTeacherUserID2)}</td>
      <td class="px-4 py-3 text-center text-gray-600">${c.StudentCount || 0}</td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <button onclick='openClassModal("edit", ${JSON.stringify(c)})' class="text-wprimary hover:underline text-xs font-medium mr-3">แก้ไข</button>
        <button onclick="deleteClass('${c.ClassID}')" class="text-red-500 hover:underline text-xs font-medium">ลบ</button>
      </td>
    </tr>`
    )
    .join("");
}

function openClassModal(mode, data) {
  document.getElementById("classForm").reset();
  document.getElementById("f-isEdit").value = mode === "edit" ? "1" : "0";
  document.getElementById("modalTitle").textContent = mode === "edit" ? "แก้ไขห้องเรียน" : "เพิ่มห้องเรียนใหม่";

  document.getElementById("f-gradeLevel").disabled = mode === "edit";
  document.getElementById("f-roomNumber").disabled = mode === "edit";
  document.getElementById("f-academicYearId").disabled = mode === "edit";

  if (mode === "edit" && data) {
    document.getElementById("f-classId").value = data.ClassID;
    document.getElementById("f-gradeLevel").value = data.GradeLevel;
    document.getElementById("f-roomNumber").value = data.RoomNumber;
    document.getElementById("f-academicYearId").value = data.AcademicYearID;
    document.getElementById("f-homeroomTeacherUserId").value = data.HomeroomTeacherUserID || "";
    document.getElementById("f-homeroomTeacherUserId2").value = data.HomeroomTeacherUserID2 || "";
  } else {
    document.getElementById("f-classId").value = "";
    const currentYear = document.getElementById("yearFilter").value;
    document.getElementById("f-academicYearId").value = currentYear;
  }

  document.getElementById("classModal").classList.remove("hidden");
}

function closeClassModal() {
  document.getElementById("classModal").classList.add("hidden");
}

async function handleSubmitClass(e) {
  e.preventDefault();

  const isEdit = document.getElementById("f-isEdit").value === "1";
  const payload = {
    classId: document.getElementById("f-classId").value,
    gradeLevel: document.getElementById("f-gradeLevel").value,
    roomNumber: document.getElementById("f-roomNumber").value,
    academicYearId: document.getElementById("f-academicYearId").value,
    homeroomTeacherUserId: document.getElementById("f-homeroomTeacherUserId").value,
    homeroomTeacherUserId2: document.getElementById("f-homeroomTeacherUserId2").value,
  };

  const submitBtn = document.querySelector("#classForm button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';

  try {
    const result = await callApi(isEdit ? "updateClass" : "addClass", payload);

    if (result.status === "success") {
      closeClassModal();
      clearApiCache("getClassesPageData");
      Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
      loadClasses();
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

async function deleteClass(classId) {
  const confirmResult = await Swal.fire({
    icon: "warning",
    title: "ยืนยันการลบ",
    text: `ต้องการลบห้องเรียน ${classId} ใช่หรือไม่ ข้อมูลนี้ไม่สามารถกู้คืนได้`,
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#d33",
  });

  if (!confirmResult.isConfirmed) return;

  const result = await callApi("deleteClass", { classId });

  if (result.status === "success") {
    clearApiCache("getClassesPageData");
    Swal.fire({ icon: "success", title: "ลบสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    loadClasses();
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}
