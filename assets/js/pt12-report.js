/**
 * W-Score : ออกรายงาน ปถ.12 (สำหรับครูประจำชั้นอนุบาล อ.1-อ.3)
 * บันทึกคะแนน 4 ด้าน (ภาษาไทย/คณิตศาสตร์/ภาษาอังกฤษ/เสริมประสบการณ์) + ความคิดเห็นครูประจำชั้น แยกรายภาคเรียน
 * ไม่คำนวณคะแนนรวม/ค่าเฉลี่ย
 */

const PT12_FIELDS = [
  { key: "thai", label: "ภาษาไทย" },
  { key: "math", label: "คณิตศาสตร์" },
  { key: "english", label: "ภาษาอังกฤษ" },
  { key: "experience", label: "เสริมประสบการณ์" },
];
// ความเห็นครูประจำชั้นแบ่งเป็น 4 ด้าน (ต่อด้านไม่เกิน PT12_COMMENT_MAX ตัวอักษร)
const PT12_COMMENT_FIELDS = [
  { key: "commentPhysical", label: "ด้านร่างกาย" },
  { key: "commentEmotional", label: "ด้านอารมณ์และจิตใจ" },
  { key: "commentSocial", label: "ด้านสังคม" },
  { key: "commentIntellectual", label: "ด้านสติปัญญา" },
];
const PT12_COMMENT_MAX = 500;

let pt12Data = null; // ข้อมูลล่าสุดที่โหลดจาก Backend
let pt12Dirty = false; // มีการแก้ไขที่ยังไม่ได้บันทึกหรือไม่
let pt12DirtyStudents = new Set(); // รหัสนักเรียนที่ครูแก้ไขจริง (ส่งเฉพาะแถวเหล่านี้ตอนบันทึก กันเขียนทับค่าที่ครูอีกคนเพิ่งบันทึก)
let pt12Comments = {}; // ความเห็นครูประจำชั้น 4 ด้านของนักเรียนแต่ละคน { studentId: { commentPhysical, ... } } (แก้ไขผ่าน Modal)
let pt12ModalStudentId = null; // นักเรียนที่กำลังเปิด Modal ความเห็นอยู่

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  if (!userData) return;

  document.getElementById("classFilter").addEventListener("change", () => reloadWithConfirm(userData));
  document.getElementById("semesterFilter").addEventListener("change", () => reloadWithConfirm(userData));
  document.getElementById("saveAllBtn").addEventListener("click", () => saveAll(userData));

  window.addEventListener("beforeunload", function (e) {
    if (pt12Dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  loadPt12(userData, null, 1);
});

// เปลี่ยนห้อง/ภาคเรียนตอนมีข้อมูลที่ยังไม่ได้บันทึก -> ถามยืนยันก่อน ถ้าไม่ยืนยันให้คืนค่าตัวเลือกเดิม
async function reloadWithConfirm(userData) {
  const classSelect = document.getElementById("classFilter");
  const semesterSelect = document.getElementById("semesterFilter");

  if (pt12Dirty) {
    const confirmResult = await Swal.fire({
      icon: "warning",
      title: "มีข้อมูลที่ยังไม่ได้บันทึก",
      text: "หากเปลี่ยนห้องหรือภาคเรียน ข้อมูลที่แก้ไขไว้จะหายไป ต้องการดำเนินการต่อหรือไม่",
      showCancelButton: true,
      confirmButtonText: "ดำเนินการต่อ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#d33",
    });
    if (!confirmResult.isConfirmed) {
      if (pt12Data) {
        classSelect.value = pt12Data.selectedClassId;
        semesterSelect.value = String(pt12Data.semester);
      }
      return;
    }
  }

  loadPt12(userData, classSelect.value || null, Number(semesterSelect.value));
}

async function loadPt12(userData, classId, semester) {
  const content = document.getElementById("pt12Content");
  content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>`;
  document.getElementById("saveAllBtn").classList.add("hidden");

  try {
    const result = await callApi("getPt12PageData", { userId: userData.userId, classId, semester });

    if (result.status !== "success") {
      content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">${escapeHtml(result.message)}</div>`;
      return;
    }

    pt12Data = result.data;
    pt12Dirty = false;
    pt12DirtyStudents = new Set();
    pt12Comments = {};
    pt12Data.students.forEach((st) => {
      pt12Comments[st.studentId] = {};
      PT12_COMMENT_FIELDS.forEach((f) => (pt12Comments[st.studentId][f.key] = st[f.key] || ""));
    });
    renderPt12();
  } catch (err) {
    content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</div>`;
  }
}

function renderFilters() {
  const wrap = document.getElementById("classFilterWrap");
  const select = document.getElementById("classFilter");

  if (pt12Data.classOptions.length <= 1) {
    wrap.classList.add("hidden");
  } else {
    wrap.classList.remove("hidden");
    select.innerHTML = pt12Data.classOptions
      .map(
        (c) =>
          `<option value="${escapeHtml(c.classId)}" ${String(c.classId) === String(pt12Data.selectedClassId) ? "selected" : ""}>${escapeHtml(c.label)}</option>`
      )
      .join("");
  }

  document.getElementById("semesterFilter").value = String(pt12Data.semester);
}

function renderPt12() {
  renderFilters();
  const content = document.getElementById("pt12Content");

  if (pt12Data.classOptions.length === 0) {
    document.getElementById("progressText").textContent = "";
    content.innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
        <i class="fa-solid fa-circle-info mr-1"></i>คุณยังไม่ได้รับมอบหมายให้เป็นครูประจำชั้นห้องอนุบาลในปีการศึกษาปัจจุบัน
      </div>`;
    return;
  }

  if (pt12Data.students.length === 0) {
    document.getElementById("progressText").textContent = "";
    content.innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
        ยังไม่มีนักเรียนในห้อง ${escapeHtml(pt12Data.classLabel)}
      </div>`;
    return;
  }

  const max = pt12Data.maxScores;

  const headCells = PT12_FIELDS.map(
    (f) =>
      `<th class="px-2 py-3 text-center whitespace-nowrap w-28">${f.label}<br><span class="text-[11px] font-normal normal-case text-gray-400">เต็ม ${max[f.key]}</span></th>`
  ).join("");

  const rowsHtml = pt12Data.students
    .map((s) => {
      const scoreCells = PT12_FIELDS.map(
        (f) => `
        <td class="px-2 py-2 text-center">
          <input type="number" inputmode="decimal" step="0.01" min="0" max="${max[f.key]}"
                 data-student="${escapeHtml(s.studentId)}" data-field="${f.key}"
                 value="${escapeHtml(s[f.key])}"
                 class="pt12-score w-24 text-center text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-wprimary/30">
        </td>`
      ).join("");

      const commentCell = `
        <td class="px-2 py-2 text-center whitespace-nowrap">
          <button type="button" data-comment-student="${escapeHtml(s.studentId)}"
                  class="pt12-comment-btn text-xs font-medium px-3 py-1.5 rounded-lg border border-wprimary text-wprimary hover:bg-wprimary-light">
            ${commentButtonInner(s.studentId)}
          </button>
        </td>`;

      return `
      <tr class="border-b border-gray-100 align-top">
        <td class="px-3 py-3 text-center text-gray-600">${escapeHtml(s.studentNumber)}</td>
        <td class="px-3 py-3 text-gray-700 whitespace-nowrap sticky left-0 bg-white">${escapeHtml(s.fullName)}</td>
        ${scoreCells}
        ${commentCell}
      </tr>`;
    })
    .join("");

  content.innerHTML = `
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="p-4 border-b border-gray-100">
        <h2 class="text-sm font-bold text-wsecondary">ห้อง ${escapeHtml(pt12Data.classLabel)} ปีการศึกษา ${escapeHtml(pt12Data.academicYearLabel)} ภาคเรียนที่ ${escapeHtml(pt12Data.semester)}</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th class="px-3 py-3 text-center w-14">เลขที่</th>
              <th class="px-3 py-3 text-left sticky left-0 bg-gray-50">ชื่อ-นามสกุล</th>
              ${headCells}
              <th class="px-3 py-3 text-center whitespace-nowrap w-40">ความเห็นครูประจำชั้น</th>
            </tr>
          </thead>
          <tbody id="pt12Body">${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("saveAllBtn").classList.remove("hidden");

  const body = document.getElementById("pt12Body");
  body.addEventListener("input", function (e) {
    const el = e.target;
    if (el.classList.contains("pt12-score")) {
      markScoreValidity(el);
    }
    pt12Dirty = true;
    if (el.dataset.student) pt12DirtyStudents.add(el.dataset.student);
    updateProgressText();
  });
  body.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-comment-student]");
    if (btn) openCommentModal(btn.dataset.commentStudent);
  });

  body.querySelectorAll(".pt12-score").forEach(markScoreValidity);
  updateProgressText();
}

function markScoreValidity(el) {
  const v = el.value;
  const bad = v !== "" && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > Number(el.max));
  el.classList.toggle("border-red-400", bad);
  el.classList.toggle("bg-red-50", bad);
  el.classList.toggle("border-gray-300", !bad);
}

// เก็บค่าจากฟอร์มเป็นรายการนักเรียน (onlyDirty = true -> เฉพาะแถวที่ครูแก้ไขจริง) คะแนนจากช่องกรอก ความเห็นจาก pt12Comments
function collectResults(onlyDirty) {
  const byStudent = {};
  document.querySelectorAll("#pt12Body [data-student]").forEach((el) => {
    const sid = el.dataset.student;
    if (onlyDirty && !pt12DirtyStudents.has(sid)) return;
    if (!byStudent[sid]) byStudent[sid] = { studentId: sid };
    byStudent[sid][el.dataset.field] = el.value;
  });
  Object.keys(byStudent).forEach((sid) => {
    PT12_COMMENT_FIELDS.forEach((f) => {
      byStudent[sid][f.key] = (pt12Comments[sid] && pt12Comments[sid][f.key]) || "";
    });
  });
  return Object.keys(byStudent).map((sid) => byStudent[sid]);
}

// ===== Modal ความเห็นครูประจำชั้น 4 ด้าน =====
function commentFilledCount(studentId) {
  const c = pt12Comments[studentId] || {};
  return PT12_COMMENT_FIELDS.filter((f) => String(c[f.key] || "").trim() !== "").length;
}

function commentButtonInner(studentId) {
  const n = commentFilledCount(studentId);
  return `<i class="fa-solid fa-comment-dots mr-1"></i>${n > 0 ? "แก้ไขความเห็น (" + n + "/4)" : "เพิ่มความเห็น"}`;
}

function openCommentModal(studentId) {
  const student = pt12Data.students.find((s) => String(s.studentId) === String(studentId));
  if (!student) return;

  pt12ModalStudentId = studentId;
  document.getElementById("commentModalTitle").textContent = `เลขที่ ${student.studentNumber} ${student.fullName}`;

  document.getElementById("commentModalBody").innerHTML = PT12_COMMENT_FIELDS.map(
    (f) => `
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="text-sm font-medium text-gray-700">${f.label}</label>
        <span class="text-xs text-gray-400"><span id="count-${f.key}">0</span>/${PT12_COMMENT_MAX}</span>
      </div>
      <textarea id="modal-${f.key}" rows="4" maxlength="${PT12_COMMENT_MAX}" data-key="${f.key}"
                class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wprimary/30"></textarea>
    </div>`
  ).join("");

  PT12_COMMENT_FIELDS.forEach((f) => {
    const ta = document.getElementById("modal-" + f.key);
    ta.value = (pt12Comments[studentId] && pt12Comments[studentId][f.key]) || "";
    const counter = document.getElementById("count-" + f.key);
    counter.textContent = ta.value.length;
    ta.addEventListener("input", () => (counter.textContent = ta.value.length));
  });

  document.getElementById("commentModal").classList.remove("hidden");
  document.getElementById("modal-" + PT12_COMMENT_FIELDS[0].key).focus();
}

function closeCommentModal() {
  document.getElementById("commentModal").classList.add("hidden");
  pt12ModalStudentId = null;
}

// กด "ตกลง" ใน Modal = เก็บค่าไว้ในหน้า (ยังไม่ส่งไปเซิร์ฟเวอร์ ต้องกด "บันทึกทั้งหมด" อีกครั้ง)
function confirmCommentModal() {
  const sid = pt12ModalStudentId;
  if (sid === null) return;

  let changed = false;
  PT12_COMMENT_FIELDS.forEach((f) => {
    const newValue = document.getElementById("modal-" + f.key).value.trim();
    if (newValue !== ((pt12Comments[sid] && pt12Comments[sid][f.key]) || "")) changed = true;
    pt12Comments[sid][f.key] = newValue;
  });

  if (changed) {
    pt12Dirty = true;
    pt12DirtyStudents.add(String(sid));
    const btn = document.querySelector(`[data-comment-student="${CSS.escape(String(sid))}"]`);
    if (btn) btn.innerHTML = commentButtonInner(sid);
  }
  closeCommentModal();
}

document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("commentModal");
  if (!modal) return;
  document.getElementById("commentModalCancel").addEventListener("click", closeCommentModal);
  document.getElementById("commentModalClose").addEventListener("click", closeCommentModal);
  document.getElementById("commentModalOk").addEventListener("click", confirmCommentModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeCommentModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeCommentModal();
  });
});

function updateProgressText() {
  const rows = collectResults();
  const complete = rows.filter((r) => PT12_FIELDS.every((f) => r[f.key] !== "")).length;
  document.getElementById("progressText").textContent = `กรอกคะแนนครบ 4 ด้านแล้ว ${complete} / ${rows.length} คน`;
}

async function saveAll(userData) {
  const invalid = document.querySelectorAll(".pt12-score.border-red-400");
  if (invalid.length > 0) {
    Swal.fire({
      icon: "warning",
      title: "มีคะแนนที่ไม่ถูกต้อง",
      text: "กรุณาแก้ไขช่องที่ขึ้นสีแดง (คะแนนต้องอยู่ระหว่าง 0 ถึงคะแนนเต็มของด้านนั้น) ก่อนบันทึก",
      confirmButtonColor: "#268244",
    });
    invalid[0].focus();
    return;
  }

  // ส่งเฉพาะแถวที่แก้ไขจริงเท่านั้น (กันเขียนทับข้อมูลที่ครูประจำชั้นอีกคน/แท็บอื่นเพิ่งบันทึกไว้)
  const resultsToSave = collectResults(true);
  if (resultsToSave.length === 0) {
    Swal.fire({ icon: "info", title: "ไม่มีข้อมูลที่แก้ไข", text: "ยังไม่มีการเปลี่ยนแปลงที่ต้องบันทึก", confirmButtonColor: "#268244" });
    return;
  }

  const btn = document.getElementById("saveAllBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>กำลังบันทึก...';

  try {
    const result = await callApi("savePt12Results", {
      userId: userData.userId,
      classId: pt12Data.selectedClassId,
      semester: pt12Data.semester,
      results: resultsToSave,
    });

    if (result.status === "success") {
      pt12Dirty = false;
      pt12DirtyStudents = new Set();
      Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", text: result.message, confirmButtonColor: "#268244", timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1.5"></i>บันทึกทั้งหมด';
  }
}
