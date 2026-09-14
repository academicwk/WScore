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

async function openEnrollmentModal(data) {
  const classId = document.getElementById("classFilter").value;
  if (!classId) {
    Swal.fire({ icon: "warning", title: "กรุณาเลือกห้องเรียนก่อน", confirmButtonColor: "#268244" });
    return;
  }

  document.getElementById("enrollmentForm").reset();
  const isEdit = !!(data && data.enrollmentId);
  document.getElementById("f-isEdit").value = isEdit ? "1" : "0";
  document.getElementById("f-enrollmentId").value = isEdit ? data.enrollmentId : "";
  document.getElementById("modalTitle").textContent = isEdit ? "แก้ไขเลขที่ในห้อง" : "เพิ่มนักเรียนเข้าห้อง";

  const studentSelect = document.getElementById("f-studentId");

  if (isEdit) {
    studentSelect.innerHTML = `<option value="${data.studentId}">${data.studentId} - ${data.fullName}</option>`;
    studentSelect.disabled = true;
    document.getElementById("f-studentNumber").value = data.studentNumber;
  } else {
    studentSelect.disabled = false;
    const yearId = document.getElementById("yearFilter").value;
    const result = await callApi("getAvailableStudents", { academicYearId: yearId });
    if (result.status === "success") {
      studentSelect.innerHTML =
        `<option value="">- เลือกนักเรียน -</option>` +
        result.data.map((s) => `<option value="${s.studentId}">${s.studentId} - ${s.fullName}</option>`).join("");
    }
  }

  document.getElementById("enrollmentModal").classList.remove("hidden");
}

function closeEnrollmentModal() {
  document.getElementById("enrollmentModal").classList.add("hidden");
}

async function handleSubmitEnrollment(e) {
  e.preventDefault();

  const isEdit = document.getElementById("f-isEdit").value === "1";
  const classId = document.getElementById("classFilter").value;
  const yearId = document.getElementById("yearFilter").value;

  const payload = {
    enrollmentId: document.getElementById("f-enrollmentId").value,
    studentId: document.getElementById("f-studentId").value,
    classId: classId,
    academicYearId: yearId,
    studentNumber: document.getElementById("f-studentNumber").value,
  };

  const submitBtn = document.querySelector("#enrollmentForm button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';

  try {
    const result = await callApi(isEdit ? "updateEnrollmentNumber" : "addEnrollment", payload);

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
