/**
 * W-Score : บันทึกผลกิจกรรมพัฒนาผู้เรียน (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 * กิจกรรมพัฒนาผู้เรียนไม่มีครูประจำวิชาโดยตรง นายทะเบียนเป็นผู้บันทึกผล ผ/มผ แทนทั้งระดับชั้นในหน้าเดียว
 * เลือกปีการศึกษา + ระดับชั้น -> ระบบโชว์ตาราง (นักเรียนทุกคนทุกห้องของระดับชั้นนั้น x กิจกรรมทุกกิจกรรมของระดับชั้นนั้น)
 * ค่าเริ่มต้นติ๊ก "ผ่าน" ทุกคน ติ๊กออกเฉพาะคนที่ไม่ผ่าน แล้วกดบันทึกครั้งเดียวจบทั้งตาราง (ประเมินรายปี ไม่มีภาคเรียน)
 */

let currentActivities = [];

document.addEventListener("DOMContentLoaded", async function () {
  await loadPageData();

  document.getElementById("yearFilter").addEventListener("change", loadMatrix);
  document.getElementById("gradeLevelFilter").addEventListener("change", loadMatrix);
  document.getElementById("saveAllBtn").addEventListener("click", handleSaveAll);
});

async function loadPageData() {
  const result = await callApiCached("getActivityResultsPageData");
  if (result.status !== "success") {
    Swal.fire({ icon: "error", title: "โหลดข้อมูลไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    return;
  }

  const years = result.data.academicYears;
  const yearOptions = years.map((y) => `<option value="${y.AcademicYearID}">${y.Year}</option>`).join("");
  document.getElementById("yearFilter").innerHTML = yearOptions;

  const current = years.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE");
  if (current) document.getElementById("yearFilter").value = current.AcademicYearID;

  document.getElementById("gradeLevelFilter").innerHTML =
    `<option value="">- เลือกระดับชั้น -</option>` +
    result.data.gradeLevels.map((g) => `<option value="${g}">${g}</option>`).join("");
}

function clearMatrix(message) {
  document.getElementById("saveAllBtn").classList.add("hidden");
  document.getElementById("matrixContainer").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">${message}</div>`;
}

async function loadMatrix() {
  const academicYearId = document.getElementById("yearFilter").value;
  const gradeLevel = document.getElementById("gradeLevelFilter").value;

  if (!academicYearId || !gradeLevel) {
    clearMatrix("กรุณาเลือกปีการศึกษาและระดับชั้น");
    return;
  }

  document.getElementById("matrixContainer").innerHTML = `
    <div class="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>`;
  document.getElementById("saveAllBtn").classList.add("hidden");

  try {
    const result = await callApi("getActivityResultMatrix", { academicYearId, gradeLevel });
    if (result.status !== "success") {
      clearMatrix(result.message);
      return;
    }
    renderMatrix(result.data);
  } catch (err) {
    clearMatrix("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
  }
}

function renderMatrix(data) {
  currentActivities = data.activities;

  if (data.students.length === 0) {
    clearMatrix("ไม่พบนักเรียนในระดับชั้นนี้");
    return;
  }

  const activityHeadersHtml = currentActivities
    .map((act) => `<th class="px-3 py-3 text-center whitespace-nowrap">${act.subjectId} ${act.subjectName}</th>`)
    .join("");

  let currentClassId = null;
  const rowsHtml = data.students
    .map((st) => {
      const isNewClass = st.classId !== currentClassId;
      currentClassId = st.classId;

      const classDividerHtml = isNewClass
        ? `<tr class="bg-gray-50"><td colspan="${3 + currentActivities.length}" class="px-4 py-1.5 text-xs font-semibold text-gray-500">ห้อง ${st.className}</td></tr>`
        : "";

      const cellsHtml = currentActivities
        .map((act) => {
          const checked = st.results[act.subjectId] !== "มผ";
          return `
        <td class="px-3 py-2 text-center">
          <input type="checkbox" class="activity-checkbox w-4 h-4 accent-wprimary"
                 data-student-id="${st.studentId}" data-class-id="${st.classId}" data-subject-id="${act.subjectId}"
                 ${checked ? "checked" : ""}>
        </td>`;
        })
        .join("");

      return `
      ${classDividerHtml}
      <tr class="border-b border-gray-100">
        <td class="px-4 py-2 text-center text-gray-500">${st.studentNumber}</td>
        <td class="px-4 py-2 font-medium text-wsecondary whitespace-nowrap">${st.fullName}</td>
        <td class="px-3 py-2 text-center text-gray-500 whitespace-nowrap">${st.className}</td>
        ${cellsHtml}
      </tr>`;
    })
    .join("");

  document.getElementById("matrixContainer").innerHTML = `
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th class="px-4 py-3 text-center w-16">เลขที่</th>
              <th class="px-4 py-3 text-left">ชื่อ-สกุล</th>
              <th class="px-3 py-3 text-center">ห้อง</th>
              ${activityHeadersHtml}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("saveAllBtn").classList.remove("hidden");
}

async function handleSaveAll() {
  const checkboxes = document.querySelectorAll(".activity-checkbox");
  if (checkboxes.length === 0) return;

  const academicYearId = document.getElementById("yearFilter").value;
  const gradeLevel = document.getElementById("gradeLevelFilter").value;

  const results = Array.from(checkboxes).map((el) => ({
    studentId: el.dataset.studentId,
    classId: el.dataset.classId,
    subjectId: el.dataset.subjectId,
    result: el.checked ? "ผ" : "มผ",
  }));

  const failedCount = results.filter((r) => r.result === "มผ").length;

  const confirmResult = await Swal.fire({
    icon: "question",
    title: "ยืนยันการบันทึกผลกิจกรรมพัฒนาผู้เรียน",
    text:
      "ระดับชั้น " + gradeLevel + " จำนวน " + results.length + " รายการ (ไม่ผ่าน " + failedCount + " รายการ) ต้องการบันทึกหรือไม่",
    showCancelButton: true,
    confirmButtonText: "บันทึก",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#268244",
  });
  if (!confirmResult.isConfirmed) return;

  const btn = document.getElementById("saveAllBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';

  try {
    const result = await callApi("saveActivityResultsBulk", { academicYearId, results });
    if (result.status === "success") {
      Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", text: result.message, confirmButtonColor: "#268244", timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    }
  } catch (err) {
    Swal.fire({ icon: "error", title: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", confirmButtonColor: "#268244" });
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1.5"></i>บันทึกผลทั้งหมด';
  }
}
