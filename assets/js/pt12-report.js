/**
 * W-Score : ออกรายงาน ปถ.12 (สำหรับครูประจำชั้นอนุบาล อ.1-อ.3)
 * บันทึกคะแนน 4 ด้าน (ภาษาไทย/คณิตศาสตร์/ภาษาอังกฤษ/เสริมประสบการณ์) + ความเห็นครูประจำชั้น 4 ด้าน แยกรายภาคเรียน
 * ไม่คำนวณคะแนนรวม/ค่าเฉลี่ย
 *
 * คะแนน: พิมพ์/วางหลายแถวได้ (copy จาก Excel/Sheets) แล้วกดปุ่ม "บันทึกคะแนน" -> ส่งเฉพาะแถวที่แก้ไขในคำขอเดียว
 * ความเห็น: กดปุ่ม "บันทึก" ใน Modal -> บันทึกนักเรียนคนนั้นทันที
 * ปุ่ม PDF รายแถว: กดได้เมื่อคะแนน 4 ด้าน + ความเห็น 4 ด้านครบ และบันทึกลงระบบแล้ว -> ออกรายงาน ปถ.12 รายบุคคล (แยกตามภาคเรียน)
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
let pt12Dirty = new Set(); // นักเรียนที่แก้ไขคะแนนแล้วแต่ยังไม่ได้บันทึก
let pt12Version = {}; // ตัวนับการแก้ไขรายคน (กันล้างสถานะ "ยังไม่บันทึก" ผิดเมื่อมีการแก้ซ้ำระหว่างรอบันทึก)
let pt12Inputs = {}; // { studentId: { thai: input, ... } }

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
    if (pt12Pending > 0 || pt12Failed.size > 0 || pt12Dirty.size > 0) {
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

  if (pt12Failed.size > 0 || pt12Dirty.size > 0) {
    const confirmResult = await Swal.fire({
      icon: "warning",
      title: "มีคะแนนที่ยังไม่ได้บันทึก",
      text: "หากเปลี่ยนตัวเลือก คะแนนที่ยังไม่ได้บันทึกจะหายไป ต้องการดำเนินการต่อหรือไม่",
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
    pt12Dirty = new Set();
    pt12Version = {};
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
      `<th class="px-2 py-3 text-center whitespace-nowrap w-28 border-l-2 border-b-2 border-gray-400">${f.label}<br><span class="text-[11px] font-normal normal-case text-gray-400">เต็ม ${max[f.key]}</span></th>`
  ).join("");

  const rowsHtml = pt12Data.students
    .map((s) => {
      const sid = escapeHtml(s.studentId);
      const scoreCells = PT12_FIELDS.map(
        (f) => `
        <td class="px-1 py-1 text-center border-l-2 border-b-2 border-gray-400 ${scoreBgClass(s[f.key], max[f.key])}">
          <input type="number" inputmode="decimal" step="0.01" min="0" max="${max[f.key]}"
                 data-student="${sid}" data-field="${f.key}"
                 value="${escapeHtml(s[f.key])}" ${editable ? "" : "disabled"}
                 class="pt12-score w-20 text-center text-sm border border-gray-300 rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-wprimary/30 ${editable ? "" : "opacity-60 cursor-not-allowed"}">
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
        <td class="px-2 py-2 text-center whitespace-nowrap">
          <button type="button" data-pdf-student="${sid}" disabled
                  class="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-400 cursor-not-allowed">
            <i class="fa-solid fa-file-pdf mr-1"></i>PDF
          </button>
        </td>
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
          ${editable ? `<span id="saveStatus" class="text-xs text-gray-500"></span>` : ""}
          ${
            editable
              ? `<button id="saveScoresBtn" type="button" disabled
                    class="px-4 py-2 text-sm font-medium text-white bg-wprimary hover:bg-wprimary-dark rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
                    <i class="fa-solid fa-floppy-disk mr-1.5"></i>บันทึกคะแนน<span id="saveScoresCount"></span>
                  </button>`
              : ""
          }
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
              <th class="px-3 py-3 text-center whitespace-nowrap w-24">รายงาน</th>
            </tr>
          </thead>
          <tbody id="pt12Body">${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;

  const body = document.getElementById("pt12Body");

  // แผนที่ช่องกรอก (ใช้ตอนวางหลายแถว/เก็บค่า)
  pt12Inputs = {};
  body.querySelectorAll("input.pt12-score").forEach((el) => {
    (pt12Inputs[el.dataset.student] = pt12Inputs[el.dataset.student] || {})[el.dataset.field] = el;
  });

  // พิมพ์คะแนน: ปรับให้อยู่ในช่วง 0 ถึงคะแนนเต็มทันที (เหมือนหน้าบันทึกคะแนนรายวิชา) + เปลี่ยนสีช่อง + ทำเครื่องหมาย "ยังไม่ได้บันทึก"
  body.addEventListener("input", function (e) {
    if (e.target.classList.contains("pt12-score")) {
      clampScore(e.target);
      applyScoreColor(e.target);
      markDirty(e.target.dataset.student);
      updateProgressText();
    }
  });

  // วางข้อมูลหลายแถว/หลายคอลัมน์ (copy จาก Excel / Google Sheets) เริ่มจากช่องที่วาง
  body.addEventListener("paste", function (e) {
    const el = e.target;
    if (!el.classList || !el.classList.contains("pt12-score") || el.disabled) return;
    const text = (e.clipboardData || window.clipboardData).getData("text");
    if (!/[\t\r\n]/.test(text)) return; // ค่าเดียวธรรมดา ใช้การวางปกติ
    e.preventDefault();
    pasteScores(el, text);
  });

  // Enter = ไปช่องเดียวกันของแถวถัดไป
  body.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target.classList.contains("pt12-score")) return;
    e.preventDefault();
    const ids = pt12Data.students.map((s) => String(s.studentId));
    const next = ids[ids.indexOf(e.target.dataset.student) + 1];
    const nextEl = next !== undefined && pt12Inputs[next] && pt12Inputs[next][e.target.dataset.field];
    if (nextEl) {
      nextEl.focus();
      nextEl.select();
    }
  });

  body.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-comment-student]");
    if (btn) {
      openCommentModal(btn.dataset.commentStudent);
      return;
    }
    const retry = e.target.closest("[data-retry-student]");
    if (retry) saveRows([retry.dataset.retryStudent]);
    const pdf = e.target.closest("[data-pdf-student]");
    if (pdf && !pdf.disabled) generatePdf(pdf.dataset.pdfStudent);
  });

  const saveBtn = document.getElementById("saveScoresBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveDirtyScores);

  updateProgressText();
}

function markDirty(studentId) {
  const sid = String(studentId);
  pt12Dirty.add(sid);
  pt12Version[sid] = (pt12Version[sid] || 0) + 1;
  setRowStatus(sid, "dirty");
  updateSaveButton();
  refreshPdfButtons();
}

function updateSaveButton() {
  const btn = document.getElementById("saveScoresBtn");
  if (!btn) return;
  const n = pt12Dirty.size;
  if (pt12Pending > 0) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>กำลังบันทึก...';
    return;
  }
  btn.disabled = n === 0;
  btn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1.5"></i>บันทึกคะแนน${n > 0 ? ` (${n})` : ""}`;
}

// ข้อความแจ้งผลการบันทึกข้างปุ่ม (เหมือนหน้าบันทึกคะแนนรายวิชา)
function setSaveStatus(state, message) {
  const el = document.getElementById("saveStatus");
  if (!el) return;
  if (state === "saving") {
    el.className = "text-xs text-gray-500";
    el.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i>กำลังบันทึก...';
  } else if (state === "success") {
    const t = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    el.className = "text-xs text-green-600";
    el.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i>บันทึกสำเร็จเมื่อ ${t} น.`;
  } else {
    el.className = "text-xs text-red-600";
    el.innerHTML = `<i class="fa-solid fa-circle-xmark mr-1"></i>${escapeHtml(message || "บันทึกไม่สำเร็จ")}`;
  }
}

// วางข้อมูลจากคลิปบอร์ด: แถว = นักเรียนเรียงตามเลขที่ต่อจากช่องที่วาง, คอลัมน์ = ภาษาไทย > คณิต > อังกฤษ > เสริมประสบการณ์
function pasteScores(startEl, text) {
  const lines = text.replace(/\r/g, "").split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();

  const ids = pt12Data.students.map((s) => String(s.studentId));
  const startRow = ids.indexOf(startEl.dataset.student);
  const startCol = PT12_FIELDS.findIndex((f) => f.key === startEl.dataset.field);
  let filled = 0;
  let nonNumeric = 0;
  let outOfRange = 0;
  let extraRows = 0;

  lines.forEach((line, i) => {
    const sid = ids[startRow + i];
    if (sid === undefined) {
      extraRows++;
      return;
    }
    let touched = false;
    line.split("\t").forEach((raw, j) => {
      const f = PT12_FIELDS[startCol + j];
      if (!f) return;
      const input = pt12Inputs[sid] && pt12Inputs[sid][f.key];
      if (!input) return;
      let v = raw.trim().replace(/^(\d+),(\d+)$/, "$1.$2");
      if (v !== "" && isNaN(Number(v))) {
        nonNumeric++;
        return;
      }
      input.value = v;
      if (clampScore(input)) outOfRange++;
      applyScoreColor(input);
      touched = true;
      filled++;
    });
    if (touched) markDirty(sid);
  });

  updateProgressText();

  const notes = [];
  if (outOfRange) notes.push(`ปรับ ${outOfRange} ช่องที่เกินช่วงให้อยู่ในช่วง 0 ถึงคะแนนเต็ม`);
  if (nonNumeric) notes.push(`ข้าม ${nonNumeric} ช่องที่ไม่ใช่ตัวเลข`);
  if (extraRows) notes.push(`ข้าม ${extraRows} แถวที่เกินจำนวนนักเรียน`);
  if (notes.length) {
    Swal.fire({
      icon: "warning",
      title: `วางข้อมูลแล้ว ${filled} ช่อง`,
      html: notes.map(escapeHtml).join("<br>"),
      confirmButtonColor: "#268244",
    });
  }
}

// กดปุ่ม "บันทึกคะแนน": ส่งเฉพาะนักเรียนที่แก้ไขในคำขอเดียว
async function saveDirtyScores() {
  if (!pt12Data || !pt12Data.isEditable || pt12Dirty.size === 0) return;

  const count = pt12Dirty.size;
  const result = await saveRows(Array.from(pt12Dirty));
  if (result.ok) {
    Swal.fire({ icon: "success", title: `บันทึกคะแนนแล้ว ${count} คน`, confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
  }
}

// สีช่องกรอกคะแนน (เหมือนระบบอื่น): ยังไม่กรอก = เหลืองอ่อน, กรอกแล้วต่ำกว่า 50% ของคะแนนเต็ม = แดงอ่อน, ตั้งแต่ 50% ขึ้นไป = เขียวอ่อน
function scoreBgClass(val, max) {
  if (val === undefined || val === null || val === "" || isNaN(Number(val))) return "bg-yellow-200";
  return Number(val) < Number(max) / 2 ? "bg-red-200" : "bg-green-200";
}

function applyScoreColor(el) {
  const cell = el.closest("td");
  if (!cell) return;
  cell.classList.remove("bg-yellow-200", "bg-green-200", "bg-red-200");
  cell.classList.add(scoreBgClass(el.value, el.max));
}

// ปรับค่าให้อยู่ในช่วง 0..คะแนนเต็ม คืน true ถ้ามีการปรับ
function clampScore(el) {
  if (el.value === "") return false;
  const max = Number(el.max);
  let num = Number(el.value);
  if (isNaN(num)) return false;
  if (num > max) num = max;
  else if (num < 0) num = 0;
  else return false;
  el.value = num;
  return true;
}

// ค่าของนักเรียน 1 คน ณ ตอนนี้ (คะแนนจากช่องกรอก + ความเห็นจาก pt12Comments)
function collectRow(studentId) {
  const row = { studentId: studentId };
  const inputs = pt12Inputs[String(studentId)] || {};
  PT12_FIELDS.forEach((f) => {
    row[f.key] = inputs[f.key] ? inputs[f.key].value : "";
  });
  PT12_COMMENT_FIELDS.forEach((f) => {
    row[f.key] = (pt12Comments[studentId] && pt12Comments[studentId][f.key]) || "";
  });
  return row;
}

// รายการที่ยังไม่ครบของนักเรียน 1 คน (คะแนน 4 ด้าน + ความเห็น 4 ด้าน + ต้องบันทึกลงระบบแล้ว)
function getPt12Missing(studentId) {
  const sid = String(studentId);
  const row = collectRow(sid);
  const missing = [];
  PT12_FIELDS.forEach((f) => {
    if (row[f.key] === "") missing.push("คะแนน" + f.label);
  });
  PT12_COMMENT_FIELDS.forEach((f) => {
    if (String(row[f.key] || "").trim() === "") missing.push("ความเห็น" + f.label);
  });
  if (missing.length === 0 && (pt12Dirty.has(sid) || pt12Failed.has(sid))) missing.push("ยังไม่ได้บันทึกลงระบบ");
  return missing;
}

let pt12PdfBusy = new Set(); // นักเรียนที่กำลังสร้าง PDF

// เปิด/ปิดปุ่ม PDF รายแถว: กดได้เมื่อข้อมูลครบทุกอย่างและบันทึกลงระบบแล้วเท่านั้น
function refreshPdfButtons() {
  if (!pt12Data) return;
  pt12Data.students.forEach((s) => {
    const btn = document.querySelector(`[data-pdf-student="${CSS.escape(String(s.studentId))}"]`);
    if (!btn) return;
    if (pt12PdfBusy.has(String(s.studentId))) return;
    const missing = getPt12Missing(s.studentId);
    const ready = missing.length === 0 && pt12Pending === 0;
    btn.disabled = !ready;
    btn.className = ready
      ? "text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500 text-red-600 hover:bg-red-50"
      : "text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-400 cursor-not-allowed";
    btn.title = ready ? "ออกรายงาน ปถ.12 (PDF)" : missing.length ? "ยังไม่ครบ: " + missing.join(", ") : "กำลังบันทึก...";
  });
}

function downloadPdfFromBase64(base64, fileName) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function generatePdf(studentId) {
  const sid = String(studentId);
  if (pt12PdfBusy.has(sid) || getPt12Missing(sid).length > 0) return;

  const btn = document.querySelector(`[data-pdf-student="${CSS.escape(sid)}"]`);
  pt12PdfBusy.add(sid);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i>กำลังสร้าง';
  }

  try {
    const result = await callApi("generatePt12StudentReport", {
      userId: pt12User.userId,
      academicYearId: pt12Data.selectedYearId,
      classId: pt12Data.selectedClassId,
      semester: pt12Data.semester,
      studentId: sid,
    });
    if (result.status === "success") {
      downloadPdfFromBase64(result.data.base64, result.data.fileName);
      Swal.fire({ icon: "success", title: "ออกรายงานสำเร็จ", text: result.data.fileName, confirmButtonColor: "#268244", timer: 1800, showConfirmButton: false });
    } else {
      Swal.fire({ icon: "error", title: "ออกรายงานไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    pt12PdfBusy.delete(sid);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-file-pdf mr-1"></i>PDF';
    refreshPdfButtons();
  }
}

function updateProgressText() {
  refreshPdfButtons();
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
  } else if (state === "dirty") {
    el.innerHTML = '<i class="fa-solid fa-circle text-amber-400 text-[9px]" title="ยังไม่ได้บันทึก"></i>';
  } else if (state === "error") {
    el.innerHTML = `<button type="button" data-retry-student="${escapeHtml(studentId)}" class="text-red-500 hover:text-red-600" title="${escapeHtml(message || "บันทึกไม่สำเร็จ")} (กดเพื่อลองใหม่)"><i class="fa-solid fa-triangle-exclamation"></i></button>`;
  } else {
    el.innerHTML = "";
  }
}

function saveRow(studentId) {
  return saveRows([studentId]);
}

/**
 * บันทึกนักเรียนหลายคนในคำขอเดียว (เข้าคิวทีละคำขอ) คืน { ok, message }
 * ค่าที่ส่งถูกอ่านตอน "ถึงคิว" ไม่ใช่ตอนกด จึงเป็นค่าล่าสุดเสมอ
 */
function saveRows(studentIds) {
  if (!pt12Data || !pt12Data.isEditable) {
    return Promise.resolve({ ok: false, message: "ปีการศึกษาที่ผ่านมาดูข้อมูลได้อย่างเดียว" });
  }

  const ids = studentIds.map(String);
  const classId = pt12Data.selectedClassId;
  const yearId = pt12Data.selectedYearId;
  const semester = pt12Data.semester;
  const versions = {};
  ids.forEach((id) => (versions[id] = pt12Version[id] || 0));

  pt12Pending++;
  ids.forEach((id) => setRowStatus(id, "saving"));
  setSaveStatus("saving");
  updateSaveButton();
  refreshPdfButtons();

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

    const markError = (msg) => {
      ids.forEach((id) => {
        pt12Failed.add(id);
        setRowStatus(id, "error", msg);
      });
    };

    try {
      const result = await callApi("savePt12Results", {
        userId: pt12User.userId,
        academicYearId: yearId,
        classId: classId,
        semester: semester,
        results: ids.map(collectRow),
      });

      if (result.status === "success") {
        ids.forEach((id) => {
          pt12Failed.delete(id);
          if ((pt12Version[id] || 0) === versions[id]) {
            pt12Dirty.delete(id);
            setRowStatus(id, "saved");
          } else {
            setRowStatus(id, "dirty"); // มีการแก้ไขซ้ำระหว่างรอ -> ยังต้องบันทึกอีกรอบ
          }
        });
        return { ok: true };
      }
      markError(result.message);
      return { ok: false, message: result.message };
    } catch (err) {
      markError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
      return { ok: false, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" };
    }
  });

  pt12SaveChain = task.then(
    () => {},
    () => {}
  );

  return task.then((r) => {
    pt12Pending--;
    updateSaveButton();
    refreshPdfButtons();
    if (r.message !== "ข้ามคำขอเก่า") setSaveStatus(r.ok ? "success" : "error", r.ok ? "" : r.message);
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
  refreshPdfButtons();

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
