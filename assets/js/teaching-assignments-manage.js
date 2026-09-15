/**
 * W-Score : จัดการมอบหมายการสอน (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 */

let allYears = [];
let allClasses = [];
let allSubjects = [];
let allTeachers = [];
let allAssignments = [];

document.addEventListener("DOMContentLoaded", async function () {
  await loadPageData();

  document.getElementById("yearFilter").addEventListener("change", () => {
    renderClassOptionsForYear();
    renderAssignmentTable();
  });
  document.getElementById("classFilter").addEventListener("change", renderAssignmentTable);
  document.getElementById("assignForm").addEventListener("submit", handleSubmitAssign);
});

async function loadPageData() {
  const result = await callApiCached("getTeachingAssignmentsPageData");
  if (result.status !== "success") {
    renderEmptyTable(result.message);
    return;
  }

  allYears = result.data.academicYears;
  allClasses = result.data.classes;
  allSubjects = result.data.subjects;
  allTeachers = result.data.teachers;
  allAssignments = result.data.assignments;

  const yearOptions = allYears.map((y) => `<option value="${y.AcademicYearID}">${y.Year}</option>`).join("");
  document.getElementById("yearFilter").innerHTML = yearOptions;

  const current = allYears.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE");
  if (current) document.getElementById("yearFilter").value = current.AcademicYearID;

  renderClassOptionsForYear();
  renderAssignmentTable();
}

function renderClassOptionsForYear() {
  const yearId = document.getElementById("yearFilter").value;
  const classesInYear = allClasses.filter((c) => String(c.AcademicYearID) === String(yearId));

  const options = classesInYear
    .map((c) => `<option value="${c.ClassID}">${c.GradeLevel}/${c.RoomNumber}</option>`)
    .join("");

  document.getElementById("classFilter").innerHTML = `<option value="">- เลือกห้องเรียน -</option>` + options;
}

function renderEmptyTable(message) {
  document.getElementById("assignmentTableBody").innerHTML =
    `<tr><td colspan="4" class="text-center text-gray-400 py-6">${message}</td></tr>`;
}

function teacherName(userId) {
  const found = allTeachers.find((t) => String(t.userId) === String(userId));
  return found ? found.fullName : userId;
}

function renderAssignmentTable() {
  const classId = document.getElementById("classFilter").value;
  const yearId = document.getElementById("yearFilter").value;

  const classesToShow = classId
    ? allClasses.filter((c) => String(c.ClassID) === String(classId))
    : allClasses.filter((c) => String(c.AcademicYearID) === String(yearId));

  if (classesToShow.length === 0) {
    renderEmptyTable("ไม่พบห้องเรียนในปีการศึกษานี้");
    return;
  }

  const rows = [];
  classesToShow.forEach((cls) => {
    allSubjects
      .filter((s) => s.GradeLevel === cls.GradeLevel)
      .forEach((subj) => rows.push({ cls, subj }));
  });

  if (rows.length === 0) {
    renderEmptyTable("ไม่พบรายวิชาสำหรับระดับชั้นนี้");
    return;
  }

  const tbody = document.getElementById("assignmentTableBody");

  tbody.innerHTML = rows
    .map(({ cls, subj }) => {
      const assignedTeachers = allAssignments.filter(
        (a) =>
          String(a.ClassID) === String(cls.ClassID) &&
          String(a.SubjectID) === String(subj.SubjectID) &&
          String(a.AcademicYearID) === String(cls.AcademicYearID)
      );

      const chipsHtml =
        assignedTeachers.length === 0
          ? `<span class="text-gray-400 text-xs">ยังไม่มีครูผู้สอน</span>`
          : assignedTeachers
              .map(
                (a) => `
          <span class="inline-flex items-center gap-1.5 bg-wprimary-light text-wprimary text-xs font-medium px-2.5 py-1 rounded-full mr-1.5 mb-1">
            ${teacherName(a.TeacherUserID)}
            <button onclick="removeAssignment('${a.TeachingAssignmentID}')" class="hover:text-red-500">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </span>`
              )
              .join("");

      const canAddMore = assignedTeachers.length < 4;

      return `
    <tr class="border-b border-gray-100">
      <td class="px-4 py-3 text-gray-600 align-top whitespace-nowrap">${cls.GradeLevel}/${cls.RoomNumber}</td>
      <td class="px-4 py-3 font-medium text-wsecondary align-top">${subj.SubjectName}</td>
      <td class="px-4 py-3 align-top">${chipsHtml}</td>
      <td class="px-4 py-3 text-right align-top">
        ${
          canAddMore
            ? `<button onclick='openAssignModal(${JSON.stringify(cls.ClassID)}, ${JSON.stringify(cls.AcademicYearID)}, ${JSON.stringify(cls.GradeLevel + "/" + cls.RoomNumber)}, ${JSON.stringify(subj.SubjectID)}, ${JSON.stringify(subj.SubjectName)})' class="text-wprimary hover:underline text-xs font-medium">+ เพิ่มครู</button>`
            : `<span class="text-gray-400 text-xs">ครบ 4 คนแล้ว</span>`
        }
      </td>
    </tr>`;
    })
    .join("");
}
function openAssignModal(classId, yearId, className, subjectId, subjectName) {
  const assignedTeacherIds = allAssignments
    .filter(
      (a) =>
        String(a.ClassID) === String(classId) &&
        String(a.SubjectID) === String(subjectId) &&
        String(a.AcademicYearID) === String(yearId)
    )
    .map((a) => String(a.TeacherUserID));

  const availableTeachers = allTeachers.filter((t) => assignedTeacherIds.indexOf(String(t.userId)) === -1);

  if (availableTeachers.length === 0) {
    Swal.fire({ icon: "info", title: "ไม่มีครูที่สามารถเพิ่มได้แล้ว", confirmButtonColor: "#268244" });
    return;
  }

  document.getElementById("f-classId").value = classId;
  document.getElementById("f-academicYearId").value = yearId;
  document.getElementById("f-className").value = className;
  document.getElementById("f-subjectId").value = subjectId;
  document.getElementById("f-subjectName").value = subjectName;
  document.getElementById("f-teacherUserId").innerHTML = availableTeachers
    .map((t) => `<option value="${t.userId}">${t.fullName}</option>`)
    .join("");

  document.getElementById("assignModal").classList.remove("hidden");
}

function closeAssignModal() {
  document.getElementById("assignModal").classList.add("hidden");
}

async function handleSubmitAssign(e) {
  e.preventDefault();

  const classId = document.getElementById("f-classId").value;
  const yearId = document.getElementById("f-academicYearId").value;
  const subjectId = document.getElementById("f-subjectId").value;
  const teacherUserId = document.getElementById("f-teacherUserId").value;

  const submitBtn = document.querySelector("#assignForm button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';

  try {
    const result = await callApi("addTeachingAssignment", {
      classId,
      subjectId,
      academicYearId: yearId,
      teacherUserId,
    });

    if (result.status === "success") {
      closeAssignModal();
      clearApiCache("getTeachingAssignmentsPageData");
      await loadPageData();
      Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
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

async function removeAssignment(teachingAssignmentId) {
  const confirmResult = await Swal.fire({
    icon: "warning",
    title: "ยืนยันการนำออก",
    text: "ต้องการนำครูผู้สอนออกจากวิชานี้ใช่หรือไม่",
    showCancelButton: true,
    confirmButtonText: "นำออก",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#d33",
  });

  if (!confirmResult.isConfirmed) return;

  const result = await callApi("deleteTeachingAssignment", { teachingAssignmentId });

  if (result.status === "success") {
    clearApiCache("getTeachingAssignmentsPageData");
    await loadPageData();
    Swal.fire({ icon: "success", title: "นำออกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}
