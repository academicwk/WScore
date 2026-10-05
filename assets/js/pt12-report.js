/**
 * W-Score : ออกรายงาน ปถ.12 (สำหรับครูประจำชั้นอนุบาล อ.1-อ.3)
 * บันทึกคะแนน 4 ด้าน (ภาษาไทย/คณิตศาสตร์/ภาษาอังกฤษ/เสริมประสบการณ์) + ความเห็นครูประจำชั้น 4 ด้าน แยกรายภาคเรียน
 * ไม่คำนวณคะแนนรวม/ค่าเฉลี่ย
 *
 * บันทึกอัตโนมัติรายแถว: แก้ช่องคะแนนแล้วออกจากช่อง (หรือกดปุ่ม "บันทึก" ใน Modal ความเห็น) -> ส่งเฉพาะนักเรียนคนนั้นไปบันทึกทันที
 * ปีการศึกษาที่ผ่านมาดูได้อย่างเดียว แก้ไขได้เฉพาะปีการศึกษาปัจจุบัน
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

let pt12User = null;
let pt12Data = null; // ข้อมูลล่าสุดที่โหลดจาก Backend
let pt12Comments = {}; // ความเห็น 4 ด้านของนักเรียนแต่ละคน { studentId: { commentPhysical, ... } }
let pt12SaveChain = Promise.resolve(); // คิวบันทึก (ทีละคำขอตามลำดับ กันบันทึกซ้อนกัน/สลับลำดับ)
let pt12Pending = 0; // จำนวนคำขอบันทึกที่ยังค้างอยู่
let pt12Failed = new Set(); // นักเรียนที่บันทึกไม่สำเร็จและยังไม่ได้ลองใหม่
let pt12ModalStudentId = null;

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", function () {
  pt12User = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  if (!pt12User) return;

  ["yearFilter", "classFilter", "semesterFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("change", reloadFromFilters);
  });

  // เตือนก่อนปิด/รีเฟรชหน้า ถ้ายังมีรายการที่กำลังบันทึกอยู่หรือบันทึกไม่สำเร็จ
  window.addEventListener("beforeunload", function (e) {
    if (pt12Pending > 0 || pt12Failed.size > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  initCommentModal();
  loadPt12(null, null, 1);
});

// เปลี่ยนปี/ห้อง/ภาคเรียน: รอให้รายการที่กำลังบันทึกค้างอยู่เสร็จก่อน แล้วค่อยโหลดข้อมูลใหม่
async function reloadFromFilters() {
  await pt12SaveChain;

  if (pt12Failed.size > 0) {
    const confirmResult = await Swal.fire({
      icon: "warning",
      title: "มีรายการที่บันทึกไม่สำเร็จ",
      text: "หากเปลี่ยนตัวเลือก รายการที่บันทึกไม่สำเร็จจะหายไป ต้องการดำเนินการต่อหรือไม่",
      showCancelButton: true,
      confirmButtonText: "ดำเนินการต่อ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#d33",
    });
    if (!confirmResult.isConfirmed) {
      renderFilters();
      return;
    }
  }

  const yearId = document.getElementById("yearFilter").value || null;
  const classSelect = document.getElementById("classFilter");
  const classId = !classSelect.classList.contains("hidden") && classSelect.value ? classSelect.value : null;
  loadPt12(yearId, classId, Number(document.getElementById("semesterFilter").value));
}

async function loadPt12(yearId, classId, semester) {
  const content = document.getElementById("pt12Content");
  content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>`;

  try {
    const result = await callApi("getPt12PageData", {
      userId: pt12User.userId,
      academicYearId: yearId,
      classId,
      semester,
    });

    if (result.status !== "success") {
      content.innerHTML = `<div class="bg-white rounded-xl shadow p-6 text-center text-red-500 text-sm">${escapeHtml(result.message)}</div>`;
      return;
    }

    pt12Data = result.data;
    pt12Failed = new Set();
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
  if (!pt12Data) return;

  document.getElementById("yearFilter").innerHTML = pt12Data.yearOptions
    .map(
      (y) =>
        `<option value="${escapeHtml(y.academicYearId)}" ${String(y.academicYearId) === String(pt12Data.selectedYearId) ? "selected" : ""}>${escapeHtml(y.year)}</option>`
    )
    .join("");

  const classSelect = document.getElementById("classFilter");
  if (pt12Data.classOptions.length <= 1) {
    classSelect.classList.add("hidden");
  } else {
    classSelect.classList.remove("hidden");
    classSelect.innerHTML = pt12Data.classOptions
      .map(
        (c) =>
          `<option value="${escapeHtml(c.classId)}" ${String(c.classId) === String(pt12Data.selectedClassId) ? "selected" : ""}>${escapeHtml(c.label)}</option>`
      )
      .join("");
  }

  document.getElementById("semesterFilter").value = String(pt12Data.semester);
}

function commentFilledCount(studentId) {
  const c = pt12Comments[studentId] || {};
  return PT12_COMMENT_FIELDS.filter((f) => String(c[f.key] || "").trim() !== "").length;
}

function commentButtonInner(studentId) {
  const n = commentFilledCount(studentId);
  if (!pt12Data.isEditable) return `<i class="fa-solid fa-comment-dots mr-1"></i>ดูความเห็น${n > 0 ? " (" + n + "/4)" : ""}`;
  return `<i class="fa-solid fa-comment-dots mr-1"></i>${n > 0 ? "แก้ไขความเห็น (" + n + "/4)" : "เพิ่มความเห็น"}`;
}

function renderPt12() {
  renderFilters();
  const content = document.getElementById("pt12Content");

  if (pt12Data.classOptions.length === 0) {
    content.innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
        <i class="fa-solid fa-circle-info mr-1"></i>คุณยังไม่ได้รับมอบหมายให้เป็นครูประจำชั้นห้องอนุบาลในปีการศึกษานี้
      </div>`;
    return;
  }

  if (pt12Data.students.length === 0) {
    content.innerHTML = `
      <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
        ยังไม่มีนักเรียนในห้อง ${escapeHtml(pt12Data.classLabel)}
      </div>`;
    return;
  }

  const max = pt12Data.maxScores;
  const editable = pt12Data.isEditable;

  const headCells = PT12_FIELDS.map(
    (f) =>
      `<th class="px-2 py-3 text-center whitespace-nowrap w-28">${f.label}<br><span class="text-[11px] font-normal normal-case text-gray-400">เต็ม ${max[f.key]}</span></th>`
  ).join("");

  const rowsHtml = pt12Data.students
    .map((s) => {
      const sid = escapeHtml(s.studentId);
      const scoreCells = PT12_FIELDS.map(
        (f) => `
        <td class="px-2 py-2 text-center">
          <input type="number" inputmode="decimal" step="0.01" min="0" max="${max[f.key]}"
                 data-student="${sid}" data-field="${f.key}"
                 value="${escapeHtml(s[f.key])}" ${editable ? "" : "disabled"}
                 class="pt12-score w-24 text-center text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-wprimary/30 disabled:bg-gray-100 disabled:text-gray-500">
        </td>`
      ).join("");

      return `
      <tr class="border-b border-gray-100 align-top">
        <td class="px-3 py-3 text-center text-gray-600">${escapeHtml(s.studentNumber)}</td>
        <td class="px-3 py-3 text-gray-700 whitespace-nowrap sticky left-0 bg-white">${escapeHtml(s.fullName)}</td>
        ${scoreCells}
        <td class="px-2 py-2 text-center whitespace-nowrap">
          <button type="button" data-comment-student="${sid}"
                  class="text-xs font-medium px-3 py-1.5 rounded-lg border border-wprimary text-wprimary hover:bg-wprimary-light">
            ${commentButtonInner(s.studentId)}
          </button>
        </td>
        <td class="px-2 py-2 text-center w-12"><span data-status="${sid}"></span></td>
      </tr>`;
    })
    .join("");

  content.innerHTML = `
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-gray-100">
        <h2 class="text-sm font-bold text-wsecondary">ห้อง ${escapeHtml(pt12Data.classLabel)}</h2>
        <div class="flex items-center gap-3">
          ${editable ? "" : `<span class="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">ดูอย่างเดียว</span>`}
          <span id="progressText" class="text-xs text-gray-500"></span>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th class="px-3 py-3 text-center w-14">เลขที่</th>
              <th class="px-3 py-3 text-left sticky left-0 bg-gray-50">ชื่อ-นามสกุล</th>
              ${headCells}
              <th class="px-3 py-3 text-center whitespace-nowrap w-44">ความเห็นครูประจำชั้น</th>
              <th class="px-2 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody id="pt12Body">${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;

  const body = document.getElementById("pt12Body");

  // ตรวจช่วงคะแนนทันทีที่พิมพ์ (ขึ้นสีแดงถ้าเกินคะแนนเต็ม) และอัปเดตตัวนับความคืบหน้า
  body.addEventListener("input", function (e) {
    if (e.target.classList.contains("pt12-score")) {
      markScoreValidity(e.target);
      updateProgressText();
    }
  });

  // ออกจากช่องคะแนน (change) -> บันทึกแถวนั้นทันที ถ้าคะแนนไม่ถูกต้องจะไม่บันทึกและแจ้งเตือน
  body.addEventListener("change", function (e) {
    const el = e.target;
    if (!el.classList.contains("pt12-score")) return;

    markScoreValidity(el);
    if (el.classList.contains("border-red-400")) {
      const field = PT12_FIELDS.find((f) => f.key === el.dataset.field);
      Swal.fire({
        icon: "warning",
        title: "คะแนนไม่ถูกต้อง",
        text: `คะแนน${field ? field.label : ""}ต้องเป็นตัวเลข 0 ถึง ${el.max}`,
        confirmButtonColor: "#268244",
      });
      return;
    }
    saveRow(el.dataset.student);
  });

  body.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-comment-student]");
    if (btn) {
      openCommentModal(btn.dataset.commentStudent);
      return;
    }
    const retry = e.target.closest("[data-retry-student]");
    if (retry) saveRow(retry.dataset.retryStudent);
  });

  updateProgressText();
}

function markScoreValidity(el) {
  const v = el.value;
  const bad = v !== "" && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > Number(el.max));
  el.classList.toggle("border-red-400", bad);
  el.classList.toggle("bg-red-50", bad);
  el.classList.toggle("border-gray-300", !bad);
}

// ค่าของนักเรียน 1 คน ณ ตอนนี้ (คะแนนจากช่องกรอก + ความเห็นจาก pt12Comments)
function collectRow(studentId) {
  const row = { studentId: studentId };
  document.querySelectorAll("#pt12Body input[data-student]").forEach((el) => {
    if (el.dataset.student === String(studentId)) row[el.dataset.field] = el.value;
  });
  PT12_COMMENT_FIELDS.forEach((f) => {
    row[f.key] = (pt12Comments[studentId] && pt12Comments[studentId][f.key]) || "";
  });
  return row;
}

function updateProgressText() {
  const el = document.getElementById("progressText");
  if (!el) return;
  const students = pt12Data.students;
  let complete = 0;
  students.forEach((s) => {
    const row = collectRow(s.studentId);
    if (PT12_FIELDS.every((f) => row[f.key] !== "")) complete++;
  });
  el.textContent = `กรอกคะแนนครบ 4 ด้านแล้ว ${complete} / ${students.length} คน`;
}

function setRowStatus(studentId, state, message) {
  const el = document.querySelector(`[data-status="${CSS.escape(String(studentId))}"]`);
  if (!el) return;
  if (state === "saving") {
    el.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-gray-400" title="กำลังบันทึก"></i>';
  } else if (state === "saved") {
    el.innerHTML = '<i class="fa-solid fa-circle-check text-wprimary" title="บันทึกแล้ว"></i>';
  } else if (state === "error") {
    el.innerHTML = `<button type="button" data-retry-student="${escapeHtml(studentId)}" class="text-red-500 hover:text-red-600" title="${escapeHtml(message || "บันทึกไม่สำเร็จ")} (กดเพื่อลองใหม่)"><i class="fa-solid fa-triangle-exclamation"></i></button>`;
  } else {
    el.innerHTML = "";
  }
}

/**
 * บันทึกข้อมูลของนักเรียน 1 คนทันที (เข้าคิวทีละคำขอ) คืน { ok, message }
 * ค่าที่ส่งถูกอ่านตอน "ถึงคิว" ไม่ใช่ตอนกด จึงเป็นค่าล่าสุดเสมอ
 */
function saveRow(studentId) {
  if (!pt12Data || !pt12Data.isEditable) {
    return Promise.resolve({ ok: false, message: "ปีการศึกษาที่ผ่านมาดูข้อมูลได้อย่างเดียว" });
  }

  const classId = pt12Data.selectedClassId;
  const yearId = pt12Data.selectedYearId;
  const semester = pt12Data.semester;

  pt12Pending++;
  setRowStatus(studentId, "saving");

  const task = pt12SaveChain.then(async () => {
    // ผู้ใช้เปลี่ยนห้อง/ปี/ภาคเรียนไปแล้วระหว่างรอคิว -> ข้ามคำขอเก่า (ห้ามส่งค่าไปผิดห้อง)
    if (
      !pt12Data ||
      pt12Data.selectedClassId !== classId ||
      pt12Data.selectedYearId !== yearId ||
      pt12Data.semester !== semester
    ) {
      return { ok: false, message: "ข้ามคำขอเก่า" };
    }

    try {
      const result = await callApi("savePt12Results", {
        userId: pt12User.userId,
        academicYearId: yearId,
        classId: classId,
        semester: semester,
        results: [collectRow(studentId)],
      });

      if (result.status === "success") {
        pt12Failed.delete(studentId);
        setRowStatus(studentId, "saved");
        return { ok: true };
      }
      pt12Failed.add(studentId);
      setRowStatus(studentId, "error", result.message);
      return { ok: false, message: result.message };
    } catch (err) {
      pt12Failed.add(studentId);
      setRowStatus(studentId, "error", "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
      return { ok: false, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" };
    }
  });

  pt12SaveChain = task.then(
    () => {},
    () => {}
  );

  return task.then((r) => {
    pt12Pending--;
    if (!r.ok && r.message && r.message !== "ข้ามคำขอเก่า") {
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: r.message, confirmButtonColor: "#268244" });
    }
    return r;
  });
}

// ===== Modal ความเห็นครูประจำชั้น 4 ด้าน =====
function openCommentModal(studentId) {
  const student = pt12Data.students.find((s) => String(s.studentId) === String(studentId));
  if (!student) return;

  const editable = pt12Data.isEditable;
  pt12ModalStudentId = studentId;
  document.getElementById("commentModalTitle").textContent = `เลขที่ ${student.studentNumber} ${student.fullName}`;

  document.getElementById("commentModalBody").innerHTML = PT12_COMMENT_FIELDS.map(
    (f) => `
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="text-sm font-medium text-gray-700">${f.label}</label>
        <span class="text-xs text-gray-400"><span id="count-${f.key}">0</span>/${PT12_COMMENT_MAX}</span>
      </div>
      <textarea id="modal-${f.key}" rows="4" maxlength="${PT12_COMMENT_MAX}" ${editable ? "" : "readonly"}
                class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wprimary/30 read-only:bg-gray-50"></textarea>
    </div>`
  ).join("");

  PT12_COMMENT_FIELDS.forEach((f) => {
    const ta = document.getElementById("modal-" + f.key);
    ta.value = (pt12Comments[studentId] && pt12Comments[studentId][f.key]) || "";
    const counter = document.getElementById("count-" + f.key);
    counter.textContent = ta.value.length;
    ta.addEventListener("input", () => (counter.textContent = ta.value.length));
  });

  document.getElementById("commentModalOk").classList.toggle("hidden", !editable);
  document.getElementById("commentModalCancel").textContent = editable ? "ยกเลิก" : "ปิด";
  document.getElementById("commentModal").classList.remove("hidden");
  document.getElementById("modal-" + PT12_COMMENT_FIELDS[0].key).focus();
}

function closeCommentModal() {
  document.getElementById("commentModal").classList.add("hidden");
  pt12ModalStudentId = null;
}

// กด "บันทึก" ใน Modal = บันทึกลงระบบทันที สำเร็จแล้วปิด Modal ถ้าไม่สำเร็จคง Modal ไว้ให้ลองใหม่
async function saveCommentModal() {
  const sid = pt12ModalStudentId;
  if (sid === null) return;

  const newValues = {};
  let changed = false;
  PT12_COMMENT_FIELDS.forEach((f) => {
    newValues[f.key] = document.getElementById("modal-" + f.key).value.trim();
    if (newValues[f.key] !== ((pt12Comments[sid] && pt12Comments[sid][f.key]) || "")) changed = true;
  });

  // ไม่มีการเปลี่ยนแปลง และแถวนี้ไม่ได้ค้างบันทึกไม่สำเร็จ -> แค่ปิด ไม่ต้องส่งคำขอ
  if (!changed && !pt12Failed.has(sid)) {
    closeCommentModal();
    return;
  }

  const okBtn = document.getElementById("commentModalOk");
  okBtn.disabled = true;
  okBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>กำลังบันทึก...';

  PT12_COMMENT_FIELDS.forEach((f) => (pt12Comments[sid][f.key] = newValues[f.key]));
  const btn = document.querySelector(`[data-comment-student="${CSS.escape(String(sid))}"]`);
  if (btn) btn.innerHTML = commentButtonInner(sid);

  const result = await saveRow(sid);

  okBtn.disabled = false;
  okBtn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1.5"></i>บันทึก';

  if (result.ok) {
    closeCommentModal();
    Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", confirmButtonColor: "#268244", timer: 1000, showConfirmButton: false });
  }
}

function initCommentModal() {
  const modal = document.getElementById("commentModal");
  if (!modal) return;
  document.getElementById("commentModalCancel").addEventListener("click", closeCommentModal);
  document.getElementById("commentModalClose").addEventListener("click", closeCommentModal);
  document.getElementById("commentModalOk").addEventListener("click", saveCommentModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeCommentModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeCommentModal();
  });
}
