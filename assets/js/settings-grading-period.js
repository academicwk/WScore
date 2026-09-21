/**
 * W-Score : ตั้งเวลาเปิด/ปิดการบันทึกคะแนน (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 * ตั้งแยกอิสระรายปีการศึกษา x ภาคเรียน เมื่อหมดเวลาที่กำหนด ครูประจำวิชาจะดูข้อมูลได้อย่างเดียวทันที
 * มีปุ่ม "บังคับเปิด/บังคับปิด" แบบไม่กำหนดเวลา ซึ่งจะ override ทับช่วงเวลาที่ตั้งไว้เสมอ
 */

let allYears = [];
let allPeriods = [];

document.addEventListener("DOMContentLoaded", async function () {
  await loadPageData();

  document.getElementById("yearFilter").addEventListener("change", renderPeriodCards);
  document.getElementById("periodForm1").addEventListener("submit", (e) => handleSubmitPeriod(e, 1));
  document.getElementById("periodForm2").addEventListener("submit", (e) => handleSubmitPeriod(e, 2));
});

async function loadPageData() {
  const result = await callApi("getGradingPeriods");

  if (result.status !== "success") {
    Swal.fire({ icon: "error", title: "โหลดข้อมูลไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
    return;
  }

  allYears = result.data.academicYears;
  allPeriods = result.data.periods;

  const options = allYears.map((y) => `<option value="${y.AcademicYearID}">${y.Year}</option>`).join("");
  document.getElementById("yearFilter").innerHTML = options;

  const current = allYears.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE");
  if (current) document.getElementById("yearFilter").value = current.AcademicYearID;

  renderPeriodCards();
}

function findPeriod(academicYearId, semester) {
  return allPeriods.find(
    (p) => String(p.AcademicYearID) === String(academicYearId) && String(p.Semester) === String(semester)
  );
}

function toDatetimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderPeriodCards() {
  const yearId = document.getElementById("yearFilter").value;

  [1, 2].forEach((semester) => {
    const period = findPeriod(yearId, semester);
    document.getElementById(`start${semester}`).value = toDatetimeLocalValue(period ? period.StartDateTime : "");
    document.getElementById(`end${semester}`).value = toDatetimeLocalValue(period ? period.EndDateTime : "");
    renderStatusBadge(semester, period);
    renderManualButtons(semester, period);
  });
}

function getManualStatus(period) {
  return period ? String(period.ManualStatus || "").trim().toUpperCase() : "";
}

function renderStatusBadge(semester, period) {
  const badge = document.getElementById(`status${semester}`);
  const manualStatus = getManualStatus(period);

  if (manualStatus === "OPEN") {
    badge.className = "text-xs font-medium px-2.5 py-1 rounded-full bg-wprimary-light text-wprimary";
    badge.textContent = "บังคับเปิดไม่จำกัดเวลา";
    return;
  }
  if (manualStatus === "CLOSED") {
    badge.className = "text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600";
    badge.textContent = "บังคับปิดอยู่";
    return;
  }

  if (!period || !period.StartDateTime || !period.EndDateTime) {
    badge.className = "text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500";
    badge.textContent = "ยังไม่ได้ตั้งค่า (เปิดตลอด)";
    return;
  }

  const now = Date.now();
  const start = new Date(period.StartDateTime).getTime();
  const end = new Date(period.EndDateTime).getTime();
  const isOpen = now >= start && now <= end;

  badge.className = isOpen
    ? "text-xs font-medium px-2.5 py-1 rounded-full bg-wprimary-light text-wprimary"
    : "text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600";
  badge.textContent = isOpen ? "กำลังเปิดให้บันทึกคะแนน" : now < start ? "ยังไม่ถึงเวลาเปิด" : "ปิดการบันทึกคะแนนแล้ว";
}

function renderManualButtons(semester, period) {
  const manualStatus = getManualStatus(period);
  const openBtn = document.getElementById(`manualOpenBtn${semester}`);
  const closedBtn = document.getElementById(`manualClosedBtn${semester}`);
  const clearBtn = document.getElementById(`manualClearBtn${semester}`);

  [openBtn, closedBtn, clearBtn].forEach((btn) => btn.classList.remove("ring-2", "ring-offset-1"));

  if (manualStatus === "OPEN") {
    openBtn.classList.add("ring-2", "ring-offset-1");
    openBtn.style.setProperty("--tw-ring-color", "#268244");
  } else if (manualStatus === "CLOSED") {
    closedBtn.classList.add("ring-2", "ring-offset-1");
    closedBtn.style.setProperty("--tw-ring-color", "#dc2626");
  } else {
    clearBtn.classList.add("ring-2", "ring-offset-1");
    clearBtn.style.setProperty("--tw-ring-color", "#9ca3af");
  }
}

async function handleSubmitPeriod(e, semester) {
  e.preventDefault();

  const academicYearId = document.getElementById("yearFilter").value;
  const startDateTime = document.getElementById(`start${semester}`).value;
  const endDateTime = document.getElementById(`end${semester}`).value;

  if (!academicYearId || !startDateTime || !endDateTime) {
    Swal.fire({ icon: "warning", title: "กรุณากรอกข้อมูลให้ครบถ้วน", confirmButtonColor: "#268244" });
    return;
  }

  const result = await callApi("setGradingPeriod", { academicYearId, semester, startDateTime, endDateTime });

  if (result.status === "success") {
    Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    await loadPageData();
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}

async function handleSetManualStatus(semester, manualStatus) {
  const academicYearId = document.getElementById("yearFilter").value;
  if (!academicYearId) return;

  const labels = {
    OPEN: "บังคับเปิดไม่จำกัดเวลา",
    CLOSED: "บังคับปิดทันที",
    "": "เคลียร์กลับไปใช้ตามช่วงเวลาที่ตั้งไว้",
  };

  const confirmResult = await Swal.fire({
    icon: "question",
    title: "ยืนยันการเปลี่ยนสถานะ",
    text: `ต้องการ "${labels[manualStatus]}" สำหรับภาคเรียนที่ ${semester} ใช่หรือไม่`,
    showCancelButton: true,
    confirmButtonText: "ยืนยัน",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#268244",
  });

  if (!confirmResult.isConfirmed) return;

  const result = await callApi("setGradingPeriodManualStatus", { academicYearId, semester, manualStatus });

  if (result.status === "success") {
    Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    await loadPageData();
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}
