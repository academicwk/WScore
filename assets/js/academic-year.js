/**
 * W-Score : ตั้งค่าปีการศึกษา (สำหรับนายทะเบียน / ผู้ช่วยนายทะเบียน)
 */

document.addEventListener("DOMContentLoaded", function () {
  loadAcademicYears();
  document.getElementById("addYearBtn").addEventListener("click", openAddYearModal);
});

async function loadAcademicYears() {
  const tbody = document.getElementById("yearTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-6">กำลังโหลดข้อมูล...</td></tr>`;

  try {
    const result = await callApi("getAcademicYears");

    if (result.status !== "success") {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-6">${result.message}</td></tr>`;
      return;
    }

    renderYearTable(result.data);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-6">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</td></tr>`;
  }
}

function renderYearTable(years) {
  const tbody = document.getElementById("yearTableBody");

  if (years.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-6">ยังไม่มีข้อมูลปีการศึกษา</td></tr>`;
    return;
  }

  tbody.innerHTML = years
    .map((y) => {
      const isCurrent = y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE";
      return `
    <tr class="border-b border-gray-100">
      <td class="px-4 py-3 font-medium text-wsecondary">${y.Year}</td>
      <td class="px-4 py-3 text-gray-600">${formatDate(y.StartDate)}</td>
      <td class="px-4 py-3 text-gray-600">${formatDate(y.EndDate)}</td>
      <td class="px-4 py-3 text-center">
        ${
          isCurrent
            ? `<span class="inline-flex items-center gap-1 text-xs font-medium text-wprimary bg-wprimary-light px-2.5 py-1 rounded-full"><i class="fa-solid fa-circle-check"></i>ปีปัจจุบัน</span>`
            : `<span class="text-xs text-gray-400">-</span>`
        }
      </td>
      <td class="px-4 py-3 text-right">
        ${
          isCurrent
            ? ""
            : `<button onclick="setCurrentYear('${y.AcademicYearID}')" class="text-xs font-medium text-wprimary hover:underline">ตั้งเป็นปีปัจจุบัน</button>`
        }
      </td>
    </tr>`;
    })
    .join("");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

async function setCurrentYear(academicYearId) {
  const confirmResult = await Swal.fire({
    icon: "question",
    title: "ยืนยันการตั้งค่า",
    text: "ต้องการตั้งปีการศึกษานี้เป็นปีปัจจุบันใช่หรือไม่ ระบบทั้งหมดจะใช้ข้อมูลของปีนี้เป็นค่าเริ่มต้น",
    showCancelButton: true,
    confirmButtonText: "ยืนยัน",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#268244",
  });

  if (!confirmResult.isConfirmed) return;

  const result = await callApi("setCurrentAcademicYear", { academicYearId });

  if (result.status === "success") {
    Swal.fire({ icon: "success", title: "สำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    loadAcademicYears();
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}

async function openAddYearModal() {
  const { value: formValues } = await Swal.fire({
    title: "เพิ่มปีการศึกษาใหม่",
    html:
      `<input id="swal-year" type="number" class="swal2-input" placeholder="ปีการศึกษา เช่น 2570">` +
      `<input id="swal-start" type="date" class="swal2-input">` +
      `<input id="swal-end" type="date" class="swal2-input">`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "บันทึก",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#268244",
    preConfirm: () => {
      const year = document.getElementById("swal-year").value.trim();
      const startDate = document.getElementById("swal-start").value;
      const endDate = document.getElementById("swal-end").value;

      if (!year || !startDate || !endDate) {
        Swal.showValidationMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
        return false;
      }
      return { year, startDate, endDate };
    },
  });

  if (!formValues) return;

  const result = await callApi("addAcademicYear", formValues);

  if (result.status === "success") {
    Swal.fire({ icon: "success", title: "เพิ่มสำเร็จ", confirmButtonColor: "#268244", timer: 1200, showConfirmButton: false });
    loadAcademicYears();
  } else {
    Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: result.message, confirmButtonColor: "#268244" });
  }
}
