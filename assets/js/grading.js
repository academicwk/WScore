/**
 * W-Score : กำหนดช่องเก็บคะแนน (สำหรับครูประจำวิชา)
 * ตั้งค่าหน่วยการเรียนรู้ + ช่องเก็บคะแนน (เป็นรายวิชา ใช้ร่วมกันทุกห้องที่สอนวิชานี้)
 *
 * สูตรคะแนนหน่วย (เต็ม 10) = เฉลี่ยของ (คะแนนที่ได้ / คะแนนเต็มของช่อง) ของทุกช่องในหน่วย x 10
 * ทุกช่องเก็บคะแนนเต็ม 10 คะแนนตายตัว ไม่ต้องระบุเอง
 * การกรอกคะแนนจริงของนักเรียนอยู่ที่หน้า grade-entry.html แยกต่างหาก
 */

let allYears = [];
let myAssignments = [];
let currentSetup = [];

document.addEventListener("DOMContentLoaded", async function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");
  if (!userData) return;

  await loadPageData(userData.userId);

  document.getElementById("yearFilter").addEventListener("change", () => {
    renderSubjectOptionsForYear();
    clearSetup();
  });
  document.getElementById("subjectFilter").addEventListener("change", loadSetupIfReady);
  document.getElementById("semesterFilter").addEventListener("change", loadSetupIfReady);
  document.getElementById("subComponentForm").addEventListener("submit", handleSubmitSubComponent);
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

  const options = subjectsInYear.map((a) => `<option value="${a.subjectId}">${a.subjectId} ${a.subjectName}</option>`).join("");

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
        <span class="text-gray-700" data-sub-name="${sc.subComponentId}">${sc.subComponentName}</span>
        <div class="flex items-center gap-3">
          <span class="text-gray-500">${sc.maxScore} คะแนน</span>
          <button onclick="renameSubComponent('${sc.subComponentId}')" class="text-wprimary hover:underline text-xs">แก้ชื่อ</button>
          <button onclick="removeSubComponent('${sc.subComponentId}')" class="text-red-500 hover:underline text-xs">ลบ</button>
        </div>
      </div>`
              )
              .join("");

      return `
    <div class="bg-white rounded-xl shadow p-5">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-semibold text-wsecondary"><i class="fa-solid fa-layer-group text-wprimary mr-1.5"></i>${comp.componentName}</h3>
        <span class="text-sm text-gray-500">คะแนนดิบรวม ${comp.subComponents.length * 10} คะแนน (${comp.subComponents.length} ช่อง) &rarr; คะแนนจริง ${comp.maxScore} คะแนน (เฉลี่ย)</span>
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
  const maxScore = 10;

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

// แก้ไขชื่อช่องเก็บคะแนน (เฉพาะชื่อ ไม่กระทบคะแนนที่บันทึกไว้)
async function renameSubComponent(subComponentId) {
  const nameEl = document.querySelector(`[data-sub-name="${CSS.escape(String(subComponentId))}"]`);
  const currentName = nameEl ? nameEl.textContent : "";

  const input = await Swal.fire({
    title: "แก้ไขชื่อช่องเก็บคะแนน",
    input: "text",
    inputValue: currentName,
    inputAttributes: { maxlength: 100 },
    showCancelButton: true,
    confirmButtonText: "บันทึก",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#268244",
    inputValidator: (v) => (!String(v || "").trim() ? "กรุณาระบุชื่อช่องเก็บคะแนน" : undefined),
  });
  if (!input.isConfirmed) return;

  const newName = String(input.value).trim();
  if (newName === currentName) return;

  try {
    const result = await callApi("updateGradeSubComponent", { subComponentId, subComponentName: newName });
    if (result.status === "success") {
      await loadSetupIfReady();
      Swal.fire({ icon: "success", title: "แก้ไขชื่อสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  }
}

// ลบช่องเก็บคะแนน: ถ้ามีคะแนนบันทึกไว้แล้ว Server จะบอกจำนวนที่กระทบ ต้องยืนยันอีกครั้งจึงลบจริง
async function removeSubComponent(subComponentId) {
  try {
    let result = await callApi("deleteGradeSubComponent", { subComponentId });

    if (result.status === "needs_confirm") {
      const d = result.data || {};
      const classNote =
        d.classCount > 1
          ? `<br><b>กระทบ ${d.classCount} ห้องเรียน</b> เพราะช่องเก็บคะแนนใช้ร่วมกันทุกห้องที่เรียนวิชานี้`
          : "";
      const confirmResult = await Swal.fire({
        icon: "warning",
        title: "ช่องนี้มีคะแนนที่บันทึกไว้แล้ว",
        html: `การลบจะ <b>ลบคะแนนของนักเรียน ${d.studentCount} คน (${d.scoreCount} รายการ) ออกถาวร</b> และคะแนนหน่วยของทุกคนจะถูกคำนวณใหม่${classNote}<br><br>ต้องการลบหรือไม่`,
        showCancelButton: true,
        confirmButtonText: "ลบช่องและคะแนน",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#d33",
      });
      if (!confirmResult.isConfirmed) return;
      result = await callApi("deleteGradeSubComponent", { subComponentId, force: true });
    } else if (result.status === "success") {
      // ไม่มีคะแนนในช่องนี้ ลบได้ทันที (ยังขอยืนยันแบบเดิมไม่ได้แล้วเพราะลบสำเร็จไปแล้ว จึงแจ้งผลเท่านั้น)
    }

    if (result.status === "success") {
      await loadSetupIfReady();
      Swal.fire({ icon: "success", title: "ลบสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  }
}
