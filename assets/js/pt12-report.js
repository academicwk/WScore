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
const PT12_COMMENT_MAX = 1000;

let pt12Data = null; // ข้อมูลล่าสุดที่โหลดจาก Backend
let pt12Dirty = false; // มีการแก้ไขที่ยังไม่ได้บันทึกหรือไม่

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

      return `
      <tr class="border-b border-gray-100 align-top">
        <td class="px-3 py-3 text-center text-gray-600">${escapeHtml(s.studentNumber)}</td>
        <td class="px-3 py-3 text-gray-700 whitespace-nowrap sticky left-0 bg-white">${escapeHtml(s.fullName)}</td>
        ${scoreCells}
        <td class="px-2 py-2">
          <textarea rows="2" maxlength="${PT12_COMMENT_MAX}" data-student="${escapeHtml(s.studentId)}" data-field="comment"
                    placeholder="ความคิดเห็นของครูประจำชั้น"
                    class="pt12-comment w-full min-w-[260px] text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-wprimary/30">${escapeHtml(s.comment)}</textarea>
        </td>
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
              <th class="px-3 py-3 text-left">ความคิดเห็นครูประจำชั้น</th>
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
    updateProgressText();
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

// เก็บค่าจากฟอร์มทั้งหมดเป็นรายการที่ส่งให้ Backend
function collectResults() {
  const byStudent = {};
  document.querySelectorAll("#pt12Body [data-student]").forEach((el) => {
    const sid = el.dataset.student;
    if (!byStudent[sid]) byStudent[sid] = { studentId: sid };
    byStudent[sid][el.dataset.field] = el.value;
  });
  return Object.keys(byStudent).map((sid) => byStudent[sid]);
}

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

  const btn = document.getElementById("saveAllBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>กำลังบันทึก...';

  try {
    const result = await callApi("savePt12Results", {
      userId: userData.userId,
      classId: pt12Data.selectedClassId,
      semester: pt12Data.semester,
      results: collectResults(),
    });

    if (result.status === "success") {
      pt12Dirty = false;
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
