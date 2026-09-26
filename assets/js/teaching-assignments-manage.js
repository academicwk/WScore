/**
 * W-Score : จัดการมอบหมายการสอน (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 * ลำดับการมอบหมาย: เลือกปีการศึกษา -> เลือกครูประจำวิชา -> เลือกวิชาที่สอน -> เลือกห้องที่สอน (เลือกได้หลายห้อง)
 */

let allYears = [];
let allClasses = [];
let allSubjects = [];
let allTeachers = [];
let allAssignments = [];

document.addEventListener("DOMContentLoaded", async function () {
  await loadPageData();

  document.getElementById("yearFilter").addEventListener("change", () => {
    renderClassCheckboxes();
    renderAssignmentTable();
  });
  document.getElementById("f-teacherUserId").addEventListener("change", () => {
    renderClassCheckboxes();
    renderAssignmentTable();
  });
  document.getElementById("f-subjectId").addEventListener("change", renderClassCheckboxes);
  document.getElementById("teacherSearch").addEventListener("input", filterTeacherOptions);
  document.getElementById("assignForm").addEventListener("submit", handleSubmitAssign);
  document.getElementById("editAssignForm").addEventListener("submit", handleSubmitEditAssign);
  document.getElementById("edit-subjectId").addEventListener("change", () => {
    renderEditClassOptions(document.getElementById("edit-academicYearId").value);
  });
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

  const sortedTeachers = allTeachers.slice().sort((a, b) => a.fullName.localeCompare(b.fullName, "th"));
  const teacherOptions = sortedTeachers.map((t) => `<option value="${t.userId}">${t.fullName}</option>`).join("");
  document.getElementById("f-teacherUserId").innerHTML = teacherOptions;

  const sortedSubjects = allSubjects
    .slice()
    .sort(
      (a, b) =>
        String(a.GradeLevel).localeCompare(String(b.GradeLevel), "th") ||
        a.SubjectName.localeCompare(b.SubjectName, "th")
    );
  document.getElementById("f-subjectId").innerHTML = sortedSubjects
    .map((s) => `<option value="${s.SubjectID}">${s.SubjectID} ${s.SubjectName} (${s.GradeLevel})</option>`)
    .join("");

  renderClassCheckboxes();
  renderAssignmentTable();
}

function filterTeacherOptions() {
  const q = this.value.trim().toLowerCase();
  const select = document.getElementById("f-teacherUserId");
  let firstVisible = null;

  Array.from(select.options).forEach((opt) => {
    const match = opt.text.toLowerCase().indexOf(q) !== -1;
    opt.hidden = !match;
    if (match && !firstVisible) firstVisible = opt;
  });

  if (firstVisible) {
    select.value = firstVisible.value;
  }
  renderClassCheckboxes();
  renderAssignmentTable();
}

function teacherName(userId) {
  const found = allTeachers.find((t) => String(t.userId) === String(userId));
  return found ? found.fullName : userId;
}

function subjectName(subjectId) {
  const found = allSubjects.find((s) => String(s.SubjectID) === String(subjectId));
  return found ? `${found.SubjectID} ${found.SubjectName}` : subjectId;
}

function renderClassCheckboxes() {
  const container = document.getElementById("classCheckboxList");
  const yearId = document.getElementById("yearFilter").value;
  const teacherUserId = document.getElementById("f-teacherUserId").value;
  const subjectId = document.getElementById("f-subjectId").value;

  if (!yearId || !teacherUserId || !subjectId) {
    container.innerHTML = `<span class="text-xs text-gray-400 col-span-full">กรุณาเลือกครูและวิชาก่อน</span>`;
    return;
  }

  const subject = allSubjects.find((s) => String(s.SubjectID) === String(subjectId));
  const classesForGrade = allClasses.filter(
    (c) => String(c.AcademicYearID) === String(yearId) && String(c.GradeLevel) === String(subject.GradeLevel)
  );

  if (classesForGrade.length === 0) {
    container.innerHTML = `<span class="text-xs text-gray-400 col-span-full">ไม่พบห้องเรียนระดับชั้น ${subject.GradeLevel} ในปีการศึกษานี้</span>`;
    return;
  }

  container.innerHTML = classesForGrade
    .map((c) => {
      const sameGroup = allAssignments.filter(
        (a) =>
          String(a.ClassID) === String(c.ClassID) &&
          String(a.SubjectID) === String(subjectId) &&
          String(a.AcademicYearID) === String(yearId)
      );
      const alreadyAssigned = sameGroup.some((a) => String(a.TeacherUserID) === String(teacherUserId));
      const isFull = sameGroup.length >= 4;
      const disabled = alreadyAssigned || isFull;
      const noteText = alreadyAssigned ? "มอบหมายแล้ว" : isFull ? "เต็มแล้ว" : "";

      return `
      <label class="flex items-center gap-2 text-sm ${disabled ? "text-gray-400" : "text-gray-700"}">
        <input type="checkbox" value="${c.ClassID}" class="class-checkbox" ${disabled ? "disabled" : ""}>
        <span>${c.GradeLevel}/${c.RoomNumber}${noteText ? ` (${noteText})` : ""}</span>
      </label>`;
    })
    .join("");
}

async function handleSubmitAssign(e) {
  e.preventDefault();

  const academicYearId = document.getElementById("yearFilter").value;
  const teacherUserId = document.getElementById("f-teacherUserId").value;
  const subjectId = document.getElementById("f-subjectId").value;
  const classIds = Array.from(document.querySelectorAll(".class-checkbox:checked")).map((el) => el.value);

  if (!academicYearId || !teacherUserId || !subjectId || classIds.length === 0) {
    Swal.fire({ icon: "warning", title: "กรุณาเลือกครู วิชา และห้องที่สอนอย่างน้อย 1 ห้อง", confirmButtonColor: "#268244" });
    return;
  }

  const submitBtn = document.getElementById("saveAssignBtn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';

  try {
    const result = await callApi("addTeachingAssignmentsBulk", {
      academicYearId,
      teacherUserId,
      subjectId,
      classIds,
    });

    if (result.status === "success") {
      clearApiCache("getTeachingAssignmentsPageData");
      await loadPageData();
      Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1.5"></i>บันทึกมอบหมาย';
  }
}

function renderEmptyTable(message) {
  document.getElementById("assignmentTableBody").innerHTML =
    `<tr><td colspan="4" class="text-center text-gray-400 py-6">${message}</td></tr>`;
}

function renderAssignmentTable() {
  const yearId = document.getElementById("yearFilter").value;
  // กรองตามครูที่เลือกไว้ในข้อ 1. ครูประจำวิชา ของฟอร์มด้านบนโดยตรง ไม่ต้องมีตัวเลือกกรองแยกต่างหากอีก — 26 ก.ย. 2569
  const teacherFilterId = document.getElementById("f-teacherUserId").value;

  let rows = allAssignments.filter((a) => String(a.AcademicYearID) === String(yearId));
  if (teacherFilterId) {
    rows = rows.filter((a) => String(a.TeacherUserID) === String(teacherFilterId));
  }

  if (rows.length === 0) {
    renderEmptyTable("ยังไม่มีการมอบหมายการสอนในปีการศึกษานี้");
    return;
  }

  const enriched = rows
    .map((a) => {
      const cls = allClasses.find((c) => String(c.ClassID) === String(a.ClassID));
      return {
        id: a.TeachingAssignmentID,
        teacher: teacherName(a.TeacherUserID),
        subject: subjectName(a.SubjectID),
        className: cls ? `${cls.GradeLevel}/${cls.RoomNumber}` : a.ClassID,
      };
    })
    .sort(
      (a, b) =>
        a.teacher.localeCompare(b.teacher, "th") ||
        a.subject.localeCompare(b.subject, "th") ||
        a.className.localeCompare(b.className, "th")
    );

  document.getElementById("assignmentTableBody").innerHTML = enriched
    .map(
      (r) => `
    <tr class="border-b border-gray-100">
      <td class="px-4 py-3 font-medium text-wsecondary">${r.teacher}</td>
      <td class="px-4 py-3 text-gray-600">${r.subject}</td>
      <td class="px-4 py-3 text-gray-600">${r.className}</td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <button onclick="openEditAssignModal('${r.id}')" class="text-wprimary hover:underline text-xs font-medium mr-3">แก้ไข</button>
        <button onclick="removeAssignment('${r.id}')" class="text-red-500 hover:underline text-xs font-medium">นำออก</button>
      </td>
    </tr>`
    )
    .join("");
}

function openEditAssignModal(teachingAssignmentId) {
  const assignment = allAssignments.find((a) => String(a.TeachingAssignmentID) === String(teachingAssignmentId));
  if (!assignment) return;

  document.getElementById("edit-teachingAssignmentId").value = assignment.TeachingAssignmentID;
  document.getElementById("edit-academicYearId").value = assignment.AcademicYearID;

  const sortedTeachers = allTeachers.slice().sort((a, b) => a.fullName.localeCompare(b.fullName, "th"));
  document.getElementById("edit-teacherUserId").innerHTML = sortedTeachers
    .map((t) => `<option value="${t.userId}">${t.fullName}</option>`)
    .join("");
  document.getElementById("edit-teacherUserId").value = assignment.TeacherUserID;

  const sortedSubjects = allSubjects
    .slice()
    .sort(
      (a, b) =>
        String(a.GradeLevel).localeCompare(String(b.GradeLevel), "th") ||
        a.SubjectName.localeCompare(b.SubjectName, "th")
    );
  document.getElementById("edit-subjectId").innerHTML = sortedSubjects
    .map((s) => `<option value="${s.SubjectID}">${s.SubjectID} ${s.SubjectName} (${s.GradeLevel})</option>`)
    .join("");
  document.getElementById("edit-subjectId").value = assignment.SubjectID;

  renderEditClassOptions(assignment.AcademicYearID, assignment.ClassID);

  document.getElementById("editAssignModal").classList.remove("hidden");
}

function closeEditAssignModal() {
  document.getElementById("editAssignModal").classList.add("hidden");
}

function renderEditClassOptions(academicYearId, selectedClassId) {
  const subjectId = document.getElementById("edit-subjectId").value;
  const subject = allSubjects.find((s) => String(s.SubjectID) === String(subjectId));
  const classSelect = document.getElementById("edit-classId");

  if (!subject) {
    classSelect.innerHTML = `<option value="">- เลือกวิชาก่อน -</option>`;
    return;
  }

  const classesForGrade = allClasses.filter(
    (c) => String(c.AcademicYearID) === String(academicYearId) && String(c.GradeLevel) === String(subject.GradeLevel)
  );

  if (classesForGrade.length === 0) {
    classSelect.innerHTML = `<option value="">- ไม่พบห้องเรียนระดับชั้นนี้ -</option>`;
    return;
  }

  classSelect.innerHTML = classesForGrade
    .map((c) => `<option value="${c.ClassID}">${c.GradeLevel}/${c.RoomNumber}</option>`)
    .join("");

  if (selectedClassId) classSelect.value = selectedClassId;
}

async function handleSubmitEditAssign(e) {
  e.preventDefault();

  const teachingAssignmentId = document.getElementById("edit-teachingAssignmentId").value;
  const academicYearId = document.getElementById("edit-academicYearId").value;
  const teacherUserId = document.getElementById("edit-teacherUserId").value;
  const subjectId = document.getElementById("edit-subjectId").value;
  const classId = document.getElementById("edit-classId").value;

  if (!teacherUserId || !subjectId || !classId) {
    Swal.fire({ icon: "warning", title: "กรุณาเลือกข้อมูลให้ครบถ้วน", confirmButtonColor: "#268244" });
    return;
  }

  const btn = document.getElementById("saveEditAssignBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';

  try {
    let result = await callApi("updateTeachingAssignment", {
      teachingAssignmentId,
      academicYearId,
      teacherUserId,
      subjectId,
      classId,
    });

    if (result.status === "confirm_required") {
      const secondConfirm = await Swal.fire({
        icon: "warning",
        title: "มีคะแนนที่กรอกไว้แล้ว",
        text: result.message,
        showCancelButton: true,
        confirmButtonText: "ดำเนินการต่อ",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#d33",
      });

      if (!secondConfirm.isConfirmed) {
        btn.disabled = false;
        btn.innerHTML = "บันทึก";
        return;
      }

      result = await callApi("updateTeachingAssignment", {
        teachingAssignmentId,
        academicYearId,
        teacherUserId,
        subjectId,
        classId,
        force: true,
      });
    }

    if (result.status === "success") {
      closeEditAssignModal();
      clearApiCache("getTeachingAssignmentsPageData");
      await loadPageData();
      Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    btn.disabled = false;
    btn.innerHTML = "บันทึก";
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

  let result = await callApi("deleteTeachingAssignment", { teachingAssignmentId });

  if (result.status === "confirm_required") {
    const secondConfirm = await Swal.fire({
      icon: "warning",
      title: "มีคะแนนที่กรอกไว้แล้ว",
      text: result.message,
      showCancelButton: true,
      confirmButtonText: "นำออกต่อไป",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#d33",
    });

    if (!secondConfirm.isConfirmed) return;

    result = await callApi("deleteTeachingAssignment", { teachingAssignmentId, force: true });
  }

  if (result.status === "success") {
    clearApiCache("getTeachingAssignmentsPageData");
    await loadPageData();
    Swal.fire({ icon: "success", title: "นำออกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}
