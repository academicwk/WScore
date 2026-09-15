/**
 * W-Score : บันทึกคะแนนรายวิชา (สำหรับครูประจำวิชา)
 * หน้ากรอกคะแนนจริง (แยกออกมาจาก grading.js ซึ่งเหลือแค่หน้ากำหนดช่องเก็บคะแนน)
 *
 * สูตรคะแนนหน่วย (เต็ม 10) = เฉลี่ยของ (คะแนนที่ได้ / คะแนนเต็มของช่อง) ของทุกช่องในหน่วย x 10
 * คะแนนรวมภาคเรียน (ฐาน 100) = (ผลรวมคะแนนหน่วยทั้งหมด + คะแนนปลายภาค) / คะแนนเต็มทั้งหมด x 100
 */

let allYears = [];
let myAssignments = [];
let currentComponents = []; // หน่วย + ปลายภาค (จาก getGradeSetup)
let currentStudents = [];
let currentScores = {}; // key: studentId|componentId|subComponentId -> score
let activeComponentId = null; // หน่วย/ปลายภาคที่กำลังแสดงอยู่ (แบบแท็บ)

document.addEventListener("DOMContentLoaded", async function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  if (!userData) return;

  await loadPageData(userData.userId);

  document.getElementById("yearFilter").addEventListener("change", () => {
    renderSubjectOptionsForYear();
    clearEntry();
  });
  document.getElementById("subjectFilter").addEventListener("change", () => {
    renderClassOptionsForSubject();
    clearEntry();
  });
  document.getElementById("classFilter").addEventListener("change", loadEntryIfReady);
  document.getElementById("semesterFilter").addEventListener("change", loadEntryIfReady);
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

function clearEntry() {
  document.getElementById("classFilter").value = "";
  document.getElementById("semesterFilter").value = "";
  document.getElementById("entryContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
      กรุณาเลือกปีการศึกษา วิชา ห้องเรียน และภาคเรียน เพื่อกรอกคะแนน
    </div>`;
}

async function loadEntryIfReady() {
  const yearId = document.getElementById("yearFilter").value;
  const subjectId = document.getElementById("subjectFilter").value;
  const classId = document.getElementById("classFilter").value;
  const semester = document.getElementById("semesterFilter").value;

  if (!yearId || !subjectId || !classId || !semester) return;

  document.getElementById("entryContent").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>`;

  const result = await callApi("getGradeEntryPageData", {
    subjectId,
    academicYearId: yearId,
    semester,
    classId,
  });

  if (result.status !== "success") {
    document.getElementById("entryContent").innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">${result.message}</div>`;
    return;
  }

  currentComponents = result.data.components;
  currentStudents = result.data.students;

  currentScores = {};
  (result.data.scores || []).forEach((sc) => {
    const key = scoreKey(sc.StudentID, sc.ComponentID, sc.SubComponentID);
    currentScores[key] = Number(sc.Score);
  });

  activeComponentId = currentComponents.length > 0 ? currentComponents[0].componentId : null;

  renderEntryTable();
}

function scoreKey(studentId, componentId, subComponentId) {
  return `${studentId}|${componentId}|${subComponentId || ""}`;
}

// รายการ "ช่อง" ทั้งหมดที่ต้องกรอกคะแนน เรียงตามลำดับ (ใช้ทั้งตอน render และตอน paste)
// ไม่ระบุ componentId = เอาทุกช่องทุกหน่วย (ใช้ตอนบันทึก/ตอนคำนวณคะแนนรวม)
// ระบุ componentId = เอาเฉพาะช่องของหน่วย/แท็บที่กำลังเปิดอยู่ (ใช้ตอนแสดงตาราง)
function getInputColumns(componentId) {
  const cols = [];
  currentComponents.forEach((comp) => {
    if (componentId && comp.componentId !== componentId) return;

    if (comp.componentType === "ปลายภาค") {
      cols.push({ componentId: comp.componentId, subComponentId: "", maxScore: comp.maxScore, label: comp.componentName, isFinal: true });
    } else {
      comp.subComponents.forEach((sc) => {
        cols.push({
          componentId: comp.componentId,
          subComponentId: sc.subComponentId,
          maxScore: sc.maxScore,
          label: sc.subComponentName,
          unitComponentId: comp.componentId,
        });
      });
    }
  });
  return cols;
}

function totalMaxScore() {
  return currentComponents.reduce((sum, comp) => sum + Number(comp.maxScore || 0), 0);
}

// คำนวณคะแนนหน่วย (เต็ม 10) จากค่าเฉลี่ยของช่องย่อยในหน่วยนั้น สำหรับนักเรียน 1 คน
function computeUnitScore(comp, studentId) {
  if (!comp.subComponents || comp.subComponents.length === 0) return 0;

  const ratios = comp.subComponents.map((sc) => {
    const raw = currentScores[scoreKey(studentId, comp.componentId, sc.subComponentId)];
    const score = Number(raw) || 0;
    const max = Number(sc.maxScore) || 1;
    return score / max;
  });

  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return avgRatio * Number(comp.maxScore || 10);
}

function computeRowTotal(studentId) {
  let raw = 0;
  currentComponents.forEach((comp) => {
    if (comp.componentType === "ปลายภาค") {
      raw += Number(currentScores[scoreKey(studentId, comp.componentId, "")]) || 0;
    } else {
      raw += computeUnitScore(comp, studentId);
    }
  });

  const max = totalMaxScore();
  return max > 0 ? (raw / max) * 100 : 0;
}

// คะแนนดิบรวมของหน่วย (ผลรวมคะแนนดิบจากทุกช่องในหน่วยนั้น) แสดงเป็น "ได้/เต็ม"
function formatUnitRaw(comp, studentId) {
  let raw = 0;
  let max = 0;
  comp.subComponents.forEach((sc) => {
    raw += Number(currentScores[scoreKey(studentId, comp.componentId, sc.subComponentId)]) || 0;
    max += Number(sc.maxScore) || 0;
  });
  return `${raw}/${max}`;
}

// สีพื้นหลังของช่องกรอกคะแนน: ยังไม่กรอก = เหลืองอ่อน, กรอกแล้วต่ำกว่า 6 = แดงอ่อน, กรอกแล้ว 6 ขึ้นไป = เขียวอ่อน
function cellBgClass(val) {
  if (val === undefined || val === null || val === "" || isNaN(Number(val))) return "bg-yellow-200";
  return Number(val) < 6 ? "bg-red-200" : "bg-green-200";
}

function renderTabs() {
  return currentComponents
    .map((comp) => {
      const isActive = String(comp.componentId) === String(activeComponentId);
      return `
    <button onclick="switchTab('${comp.componentId}')"
            class="px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
              isActive ? "border-wprimary text-wprimary" : "border-transparent text-gray-500 hover:text-wsecondary"
            }">
      ${comp.componentName}
    </button>`;
    })
    .join("");
}

function switchTab(componentId) {
  activeComponentId = componentId;
  renderEntryTable();
}

function renderEntryTable() {
  const container = document.getElementById("entryContent");

  if (currentStudents.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">ไม่พบนักเรียนในห้องเรียนนี้</div>`;
    return;
  }

  const allCols = getInputColumns();

  if (allCols.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
        ยังไม่ได้กำหนดช่องเก็บคะแนนสำหรับวิชา/ภาคเรียนนี้ กรุณาไปที่หน้า "กำหนดช่องเก็บคะแนน" ก่อน
      </div>`;
    return;
  }

  const cols = getInputColumns(activeComponentId);

  const activeComp = currentComponents.find((c) => String(c.componentId) === String(activeComponentId));
  const showUnitSummaryCols = !!activeComp && activeComp.componentType !== "ปลายภาค";

  const headHtml =
    cols
      .map(
        (c) =>
          `<th class="px-2 py-2 text-center whitespace-nowrap font-medium border-l-2 border-b-2 border-gray-400">${c.label}<br><span class="text-gray-400 font-normal">(เต็ม ${c.maxScore})</span></th>`
      )
      .join("") +
    (showUnitSummaryCols
      ? `<th class="px-2 py-2 text-center whitespace-nowrap font-medium border-l-2 border-b-2 border-gray-400">คะแนนดิบรวม</th>
         <th class="px-2 py-2 text-center whitespace-nowrap font-medium border-l-2 border-b-2 border-gray-400">คะแนนหน่วย<br><span class="text-gray-400 font-normal">(เต็ม ${activeComp.maxScore})</span></th>`
      : "");

  const bodyHtml = currentStudents
    .map((st, si) => {
      const cellsHtml = cols
        .map((c, ci) => {
          const val = currentScores[scoreKey(st.studentId, c.componentId, c.subComponentId)];
          return `
        <td class="px-1 py-1 text-center border-l-2 border-b-2 border-gray-400 ${cellBgClass(val)}">
          <input type="number" min="0" max="${c.maxScore}" step="any"
                 data-si="${si}" data-ci="${ci}"
                 data-student-id="${st.studentId}" data-component-id="${c.componentId}" data-sub-component-id="${c.subComponentId}"
                 value="${val === undefined ? "" : val}"
                 oninput="onScoreInput(this)"
                 class="score-input w-16 text-center border border-gray-300 rounded-lg px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-wprimary/30">
        </td>`;
        })
        .join("");

      const unitSummaryHtml = showUnitSummaryCols
        ? `
      <td class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400 font-medium text-gray-600" data-raw-for="${st.studentId}">
        ${formatUnitRaw(activeComp, st.studentId)}
      </td>
      <td class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400 font-semibold text-wprimary" data-unit-for="${st.studentId}">
        ${computeUnitScore(activeComp, st.studentId).toFixed(2)}
      </td>`
        : "";

      return `
    <tr class="${si % 2 === 0 ? "bg-sky-200" : "bg-slate-300"}" data-row-student="${st.studentId}">
      <td class="px-3 py-2 text-gray-500 text-center whitespace-nowrap border-b-2 border-gray-400">${st.studentNumber}</td>
      <td class="px-3 py-2 text-gray-700 whitespace-nowrap border-l-2 border-b-2 border-gray-400">${st.fullName}</td>
      ${cellsHtml}
      ${unitSummaryHtml}
      <td class="px-3 py-2 text-center font-semibold text-wprimary row-total border-l-2 border-b-2 border-gray-400" data-total-for="${st.studentId}">
        ${computeRowTotal(st.studentId).toFixed(2)}
      </td>
    </tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="flex overflow-x-auto border-b border-gray-100">
        ${renderTabs()}
      </div>
      <div class="overflow-x-auto">
        <table id="scoreTable" class="w-full text-sm border-collapse">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th class="px-3 py-2 text-center w-16 border-b-2 border-gray-400">เลขที่</th>
              <th class="px-3 py-2 text-left border-l-2 border-b-2 border-gray-400">ชื่อ-สกุล</th>
              ${headHtml}
              <th class="px-3 py-2 text-center border-l-2 border-b-2 border-gray-400">คะแนน (ฐาน 100)</th>
            </tr>
          </thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
      <div class="flex justify-end p-4 border-t border-gray-100">
        <button onclick="saveAllScores()" id="saveScoresBtn"
                class="px-5 py-2.5 text-sm font-medium text-white bg-wprimary hover:bg-wprimary-dark rounded-lg">
          <i class="fa-solid fa-floppy-disk mr-1.5"></i>บันทึกคะแนนทั้งหมด
        </button>
      </div>
    </div>`;

  document.getElementById("scoreTable").addEventListener("paste", handleGridPaste);
}

function onScoreInput(input) {
  const studentId = input.dataset.studentId;
  const componentId = input.dataset.componentId;
  const subComponentId = input.dataset.subComponentId;

  // ไม่อนุญาตให้กรอกคะแนนเกินคะแนนเต็มของช่องนั้น (และไม่ต่ำกว่า 0)
  const maxScore = Number(input.max);
  if (input.value !== "" && !isNaN(Number(input.value))) {
    let num = Number(input.value);
    if (maxScore && num > maxScore) num = maxScore;
    if (num < 0) num = 0;
    if (num !== Number(input.value)) input.value = num;
  }

  const key = scoreKey(studentId, componentId, subComponentId);
  const val = input.value === "" ? undefined : Number(input.value);

  if (val === undefined) {
    delete currentScores[key];
  } else {
    currentScores[key] = val;
  }

  // อัปเดตสีพื้นหลังของช่องนี้ตามคะแนนที่กรอก
  const cell = input.closest("td");
  if (cell) {
    cell.classList.remove("bg-yellow-200", "bg-green-200", "bg-red-200");
    cell.classList.add(cellBgClass(val));
  }

  // อัปเดตคะแนนดิบรวม/คะแนนหน่วยของแถวนี้ (เฉพาะตอนเปิดแท็บหน่วยอยู่)
  const activeComp = currentComponents.find((c) => String(c.componentId) === String(activeComponentId));
  if (activeComp && activeComp.componentType !== "ปลายภาค") {
    const rawCell = document.querySelector(`[data-raw-for="${studentId}"]`);
    if (rawCell) rawCell.textContent = formatUnitRaw(activeComp, studentId);

    const unitCell = document.querySelector(`[data-unit-for="${studentId}"]`);
    if (unitCell) unitCell.textContent = computeUnitScore(activeComp, studentId).toFixed(2);
  }

  const totalCell = document.querySelector(`[data-total-for="${studentId}"]`);
  if (totalCell) totalCell.textContent = computeRowTotal(studentId).toFixed(2);
}

function handleGridPaste(e) {
  const target = e.target;
  if (!target.classList || !target.classList.contains("score-input")) return;

  const text = (e.clipboardData || window.clipboardData).getData("text");
  if (!text) return;

  e.preventDefault();

  const rows = text.replace(/\r/g, "").split("\n").filter((r) => r.length > 0);
  const startSi = Number(target.dataset.si);
  const startCi = Number(target.dataset.ci);

  rows.forEach((rowText, rOffset) => {
    const cells = rowText.split("\t");
    cells.forEach((cellText, cOffset) => {
      const si = startSi + rOffset;
      const ci = startCi + cOffset;
      const cellInput = document.querySelector(`input[data-si="${si}"][data-ci="${ci}"]`);
      if (cellInput) {
        cellInput.value = cellText.trim();
        onScoreInput(cellInput);
      }
    });
  });
}

async function saveAllScores() {
  const yearId = document.getElementById("yearFilter").value;
  const subjectId = document.getElementById("subjectFilter").value;
  const classId = document.getElementById("classFilter").value;
  const semester = document.getElementById("semesterFilter").value;

  const cols = getInputColumns();
  const scores = [];

  currentStudents.forEach((st) => {
    cols.forEach((c) => {
      const val = currentScores[scoreKey(st.studentId, c.componentId, c.subComponentId)];
      if (val !== undefined && val !== null && val !== "") {
        scores.push({
          studentId: st.studentId,
          componentId: c.componentId,
          subComponentId: c.subComponentId,
          score: val,
        });
      }
    });
  });

  const btn = document.getElementById("saveScoresBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';

  try {
    const result = await callApi("saveStudentScores", {
      classId,
      subjectId,
      academicYearId: yearId,
      semester,
      scores,
    });

    if (result.status === "success") {
      Swal.fire({ icon: "success", title: "บันทึกคะแนนสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1.5"></i>บันทึกคะแนนทั้งหมด';
  }
}
