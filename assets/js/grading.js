/**
 * W-Score : บันทึกคะแนนรายวิชา (สำหรับครูประจำวิชา)
 * ขั้นตอนที่ 1: ตั้งค่าหน่วยการเรียนรู้ + ช่องเก็บคะแนน
 */

let allYears = [];
let myAssignments = [];
let currentSetup = [];
let scoreColumns = [];
let entryStudents = [];
let existingScores = [];

document.addEventListener("DOMContentLoaded", async function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  if (!userData) return;

  await loadPageData(userData.userId);

  document.getElementById("yearFilter").addEventListener("change", () => {
    renderSubjectOptionsForYear();
    clearSetup();
  });
  document.getElementById("subjectFilter").addEventListener("change", () => {
    renderClassOptionsForSubject();
    loadSetupIfReady();
    clearGradeEntry();
  });
  document.getElementById("semesterFilter").addEventListener("change", () => {
    loadSetupIfReady();
    loadGradeEntryIfReady();
  });
  document.getElementById("classFilter").addEventListener("change", loadGradeEntryIfReady);
  document.getElementById("subComponentForm").addEventListener("submit", handleSubmitSubComponent);
});

function renderClassOptionsForSubject() {
  const yearId = document.getElementById("yearFilter").value;
  const subjectId = document.getElementById("subjectFilter").value;

  const classesForSubject = myAssignments.filter(
    (a) => String(a.academicYearId) === String(yearId) && String(a.subjectId) === String(subjectId)
  );

  const options = classesForSubject.map((a) => `<option value="${a.classId}">${a.className}</option>`).join("");

  document.getElementById("classFilter").innerHTML = `<option value="">- เลือกห้องเรียน -</option>` + options;
}

function clearGradeEntry() {
  document.getElementById("classFilter").value = "";
  document.getElementById("gradeEntryContent").innerHTML = "";
}

async function loadGradeEntryIfReady() {
  const yearId = document.getElementById("yearFilter").value;
  const subjectId = document.getElementById("subjectFilter").value;
  const semester = document.getElementById("semesterFilter").value;
  const classId = document.getElementById("classFilter").value;

  if (!yearId || !subjectId || !semester || !classId) {
    document.getElementById("gradeEntryContent").innerHTML = "";
    return;
  }

  document.getElementById("gradeEntryContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กำลังโหลดข้อมูลนักเรียน...</div>`;

  const result = await callApi("getGradeEntryPageData", { classId, subjectId, academicYearId: yearId, semester });

  if (result.status !== "success") {
    document.getElementById("gradeEntryContent").innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">${result.message}</div>`;
    return;
  }

  entryStudents = result.data.students;
  existingScores = result.data.scores;

  scoreColumns = [];
  result.data.components.forEach((comp) => {
    if (comp.componentType === "ปลายภาค") {
      scoreColumns.push({
        componentId: comp.componentId,
        subComponentId: "",
        label: comp.componentName,
        maxScore: comp.maxScore,
      });
    } else {
      comp.subComponents.forEach((sc) => {
        scoreColumns.push({
          componentId: comp.componentId,
          subComponentId: sc.subComponentId,
          label: comp.componentName + " - " + sc.subComponentName,
          maxScore: sc.maxScore,
        });
      });
    }
  });

  renderGradeEntryTable();
}

function scoreOf(studentId, col) {
  const found = existingScores.find(
    (s) =>
      String(s.StudentID) === String(studentId) &&
      String(s.ComponentID) === String(col.componentId) &&
      String(s.SubComponentID || "") === String(col.subComponentId || "")
  );
  return found ? found.Score : "";
}

function renderGradeEntryTable() {
  const container = document.getElementById("gradeEntryContent");

  if (scoreColumns.length === 0) {
    container.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กรุณาตั้งค่าช่องเก็บคะแนนของแต่ละหน่วยก่อน</div>`;
    return;
  }

  if (entryStudents.length === 0) {
    container.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">ห้องนี้ยังไม่มีนักเรียน</div>`;
    return;
  }

  const totalMax = scoreColumns.reduce((sum, c) => sum + Number(c.maxScore || 0), 0);

  const headerHtml = scoreColumns
    .map((c) => `<th class="px-2 py-2 text-center whitespace-nowrap border-l border-gray-100">${c.label}<br><span class="text-gray-400">(${c.maxScore})</span></th>`)
    .join("");

  const rowsHtml = entryStudents
    .map((st, si) => {
      const cellsHtml = scoreColumns
        .map(
          (col, ci) => `
      <td class="px-1 py-1 border-l border-gray-100">
        <input type="number" min="0" max="${col.maxScore}" step="0.5"
               data-si="${si}" data-ci="${ci}"
               value="${scoreOf(st.studentId, col)}"
               oninput="onScoreInput(${si})"
               class="score-input w-16 text-center border border-gray-200 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-wprimary/30">
      </td>`
        )
        .join("");

      return `
    <tr class="border-b border-gray-100">
      <td class="px-3 py-2 text-gray-600">${st.studentNumber}</td>
      <td class="px-3 py-2 text-gray-600 whitespace-nowrap">${st.studentId}</td>
      <td class="px-3 py-2 font-medium text-wsecondary whitespace-nowrap">${st.fullName}</td>
      ${cellsHtml}
      <td class="px-3 py-2 text-center font-semibold text-wprimary border-l border-gray-100" id="rowTotal_${si}">-</td>
    </tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p class="text-xs text-gray-500">
          <i class="fa-solid fa-circle-info mr-1"></i>คลิกช่องแล้ววางข้อมูล (Ctrl+V) ที่คัดลอกจาก Excel ได้ทันที คะแนนดิบเต็ม ${totalMax} คะแนน
        </p>
        <button onclick="saveAllScores()" class="bg-wprimary hover:bg-wprimary-dark text-white text-sm font-medium px-4 py-2 rounded-lg">
          <i class="fa-solid fa-floppy-disk"></i> บันทึกคะแนนทั้งหมด
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" id="scoreTable">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th class="px-3 py-2 text-left">เลขที่</th>
              <th class="px-3 py-2 text-left">รหัสนักเรียน</th>
              <th class="px-3 py-2 text-left">ชื่อ-นามสกุล</th>
              ${headerHtml}
              <th class="px-3 py-2 text-center border-l border-gray-100">คะแนน (ฐาน 100)</th>
            </tr>
          </thead>
          <tbody id="scoreTableBody">${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("scoreTable").addEventListener("paste", handleGridPaste);

  entryStudents.forEach((st, si) => updateRowTotal(si));
}

function updateRowTotal(si) {
  const totalMax = scoreColumns.reduce((sum, c) => sum + Number(c.maxScore || 0), 0);
  let raw = 0;
  scoreColumns.forEach((col, ci) => {
    const input = document.querySelector(`input[data-si="${si}"][data-ci="${ci}"]`);
    raw += Number(input && input.value ? input.value : 0);
  });
  const scaled = totalMax > 0 ? ((raw / totalMax) * 100).toFixed(2) : "-";
  const cell = document.getElementById("rowTotal_" + si);
  if (cell) cell.textContent = scaled;
}

function onScoreInput(si) {
  updateRowTotal(si);
}

function handleGridPaste(e) {
  const active = document.activeElement;
  if (!active || !active.classList.contains("score-input")) return;

  e.preventDefault();

  const text = (e.clipboardData || window.clipboardData).getData("text");
  const rows = text.replace(/\r/g, "").split("\n").filter((r) => r !== "");

  const startSi = Number(active.dataset.si);
  const startCi = Number(active.dataset.ci);

  rows.forEach((rowText, r) => {
    const cols = rowText.split("\t");
    cols.forEach((val, c) => {
      const targetSi = startSi + r;
      const targetCi = startCi + c;
      const input = document.querySelector(`input[data-si="${targetSi}"][data-ci="${targetCi}"]`);
      if (input) {
        input.value = val.trim();
      }
    });
    updateRowTotal(startSi + r);
  });
}

async function saveAllScores() {
  const scores = [];

  entryStudents.forEach((st, si) => {
    scoreColumns.forEach((col, ci) => {
      const input = document.querySelector(`input[data-si="${si}"][data-ci="${ci}"]`);
      const val = input ? input.value.trim() : "";
      scores.push({
        studentId: st.studentId,
        componentId: col.componentId,
        subComponentId: col.subComponentId,
        score: val,
      });
    });
  });

  const yearId = document.getElementById("yearFilter").value;
  const subjectId = document.getElementById("subjectFilter").value;
  const semester = document.getElementById("semesterFilter").value;
  const classId = document.getElementById("classFilter").value;

  Swal.fire({ title: "กำลังบันทึก...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    const result = await callApi("saveStudentScores", { classId, subjectId, academicYearId: yearId, semester, scores });

    if (result.status === "success") {
      Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  }
}

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
}

function clearSetup() {
  document.getElementById("subjectFilter").value = "";
  document.getElementById("semesterFilter").value = "";
  document.getElementById("setupContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
      กรุณาเลือกปีการศึกษา วิชา และภาคเรียน เพื่อตั้งค่าคะแนน
    </div>`;
}

async function loadSetupIfReady() {
  const yearId = document.getElementById("yearFilter").value;
  const subjectId = document.getElementById("subjectFilter").value;
  const semester = document.getElementById("semesterFilter").value;

  if (!yearId || !subjectId || !semester) return;

  document.getElementById("setupContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>`;

  const result = await callApi("getGradeSetup", { subjectId, academicYearId: yearId, semester });

  if (result.status !== "success") {
    document.getElementById("setupContent").innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">${result.message}</div>`;
    return;
  }

  currentSetup = result.data;
  renderSetup();
}

function renderSetup() {
  const container = document.getElementById("setupContent");

  container.innerHTML = currentSetup
    .map((comp) => {
      if (comp.componentType === "ปลายภาค") {
        return `
    <div class="bg-white rounded-xl shadow p-5">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-wsecondary"><i class="fa-solid fa-file-signature text-wprimary mr-1.5"></i>${comp.componentName}</h3>
        <span class="text-sm text-gray-500">คะแนนเต็ม ${comp.maxScore} คะแนน (ช่องเดียว ไม่ต้องแบ่งย่อย)</span>
      </div>
    </div>`;
      }

      const subRowsHtml =
        comp.subComponents.length === 0
          ? `<div class="text-gray-400 text-xs py-2">ยังไม่มีช่องเก็บคะแนน</div>`
          : comp.subComponents
              .map(
                (sc) => `
      <div class="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
        <span class="text-gray-700">${sc.subComponentName}</span>
        <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">${comp.subComponents.length} ช่อง (คิดคะแนนหน่วยจากค่าเฉลี่ย เต็ม ${comp.maxScore} คะแนน)</span>
        <button onclick="removeSubComponent('${sc.subComponentId}')" class="text-red-500 hover:underline text-xs">ลบ</button>
        </div>
      </div>`
              )
              .join("");

      return `
    <div class="bg-white rounded-xl shadow p-5">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-semibold text-wsecondary"><i class="fa-solid fa-layer-group text-wprimary mr-1.5"></i>${comp.componentName}</h3>
        <span class="text-sm text-gray-500">${comp.subComponents.length} ช่อง (คิดคะแนนหน่วยจากค่าเฉลี่ย เต็ม ${comp.maxScore} คะแนน)</span>
        </div>
      <div class="divide-y divide-gray-100">${subRowsHtml}</div>
      <button onclick='openSubComponentModal(${JSON.stringify(comp.componentId)})' class="mt-3 text-wprimary hover:underline text-xs font-medium">
        <i class="fa-solid fa-plus"></i> เพิ่มช่องเก็บคะแนน
      </button>
    </div>`;
    })
    .join("");
}

function openSubComponentModal(componentId) {
  document.getElementById("subComponentForm").reset();
  document.getElementById("f-componentId").value = componentId;
  document.getElementById("subComponentModal").classList.remove("hidden");
}

function closeSubComponentModal() {
  document.getElementById("subComponentModal").classList.add("hidden");
}

async function handleSubmitSubComponent(e) {
  e.preventDefault();

  const componentId = document.getElementById("f-componentId").value;
  const subComponentName = document.getElementById("f-subComponentName").value.trim();
  const maxScore = document.getElementById("f-subComponentMaxScore").value;

  const submitBtn = document.querySelector("#subComponentForm button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';

  try {
    const result = await callApi("addGradeSubComponent", { componentId, subComponentName, maxScore });

    if (result.status === "success") {
      closeSubComponentModal();
      await loadSetupIfReady();
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

async function removeSubComponent(subComponentId) {
  const confirmResult = await Swal.fire({
    icon: "warning",
    title: "ยืนยันการลบ",
    text: "ต้องการลบช่องเก็บคะแนนนี้ใช่หรือไม่ คะแนนที่กรอกไว้ในช่องนี้จะหายไปด้วย",
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#d33",
  });

  if (!confirmResult.isConfirmed) return;

  const result = await callApi("deleteGradeSubComponent", { subComponentId });

  if (result.status === "success") {
    await loadSetupIfReady();
    Swal.fire({ icon: "success", title: "ลบสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}
