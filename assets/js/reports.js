/**
 * W-Score : รายงานสรุปผู้บริหาร (Executive Report Dashboard) สำหรับผู้อำนวยการสถานศึกษา
 * อ่านอย่างเดียว (Read-only) แสดงเฉพาะปีการศึกษาปัจจุบันของระบบ
 * ตัวเลือก "ระดับชั้น" กรองเฉพาะกราฟ/ตาราง "สรุปผลสัมฤทธิ์แยกตามกลุ่มสาระ" ส่วนการ์ด/กราฟ GPAX-ตามระดับชั้น/ความคืบหน้าเป็นภาพรวมทั้งโรงเรียนเสมอ
 */

const THEME = window.WSCORE_THEME_COLORS || { primary: "#268244", secondary: "#121363", accent: "#D9C94C" };
let gpaxChartInstance = null;
let submissionChartInstance = null;
let achievementChartInstance = null;

// เผื่อกรณีโหลดไลบรารี Chart.js จาก CDN ไม่สำเร็จ (เช่น เครือข่ายโรงเรียนบล็อก CDN) จะได้ไม่ทำให้ทั้งหน้าใช้งานไม่ได้
// การ์ดสรุป/ตารางยังคงแสดงผลได้ตามปกติ เว้นแต่ส่วนกราฟที่จะซ่อนไปแทน
const CHART_AVAILABLE = typeof Chart !== "undefined";
if (CHART_AVAILABLE) {
  Chart.defaults.font.family = "Sarabun, sans-serif";
}

document.addEventListener("DOMContentLoaded", async function () {
  if (!CHART_AVAILABLE) {
    document.querySelectorAll("canvas").forEach((c) => {
      c.closest("div").innerHTML =
        '<p class="text-xs text-gray-400 text-center py-10">ไม่สามารถโหลดไลบรารีสร้างกราฟได้ (เครือข่ายอาจบล็อก CDN) กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</p>';
    });
  }

  await loadReportData("");

  document.getElementById("gradeLevelFilter").addEventListener("change", function () {
    loadReportData(this.value);
  });
});

async function loadReportData(gradeLevel) {
  const isFirstLoad = document.getElementById("gradeLevelFilter").options.length <= 1;

  if (isFirstLoad) {
    document.getElementById("loadingBox").classList.remove("hidden");
    document.getElementById("reportContent").classList.add("hidden");
  }

  try {
    const result = await callApiCached("getDirectorReportData", { gradeLevel: gradeLevel || "" });

    if (result.status !== "success") {
      document.getElementById("loadingBox").innerHTML = `<span class="text-red-500">${result.message}</span>`;
      return;
    }

    const data = result.data;

    if (isFirstLoad) {
      document.getElementById("yearLabel").textContent = "ปีการศึกษา " + data.academicYearLabel;

      const filterEl = document.getElementById("gradeLevelFilter");
      filterEl.innerHTML =
        `<option value="">ภาพรวมทั้งโรงเรียน</option>` +
        data.gradeLevelOptions.map((g) => `<option value="${g}">${g}</option>`).join("");

      document.getElementById("loadingBox").classList.add("hidden");
      document.getElementById("reportContent").classList.remove("hidden");
    }

    renderSummaryCards(data.cards);
    renderGpaxChart(data.gpaxByGradeLevel);
    renderSubmissionChart(data.submissionProgress);
    renderAchievementChart(data.achievementBySubjectGroup);
    renderAchievementTable(data.achievementTable);
  } catch (err) {
    document.getElementById("loadingBox").classList.remove("hidden");
    document.getElementById("loadingBox").innerHTML = `<span class="text-red-500">เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ</span>`;
  }
}

function renderSummaryCards(cards) {
  const items = [
    { icon: "fa-user-graduate", label: "นักเรียนทั้งหมด", value: cards.totalStudents + " คน" },
    { icon: "fa-chart-line", label: "GPAX เฉลี่ยทั้งโรงเรียน", value: cards.schoolGpax !== null ? cards.schoolGpax.toFixed(2) : "ยังไม่มีข้อมูล" },
    { icon: "fa-file-circle-check", label: "ส่งผลภาคเรียนที่ 1 แล้ว", value: cards.sem1SubmittedPercent + "%" },
    { icon: "fa-file-circle-check", label: "ส่งผลภาคเรียนที่ 2 แล้ว", value: cards.sem2SubmittedPercent + "%" },
  ];

  document.getElementById("summaryCards").innerHTML = items
    .map(
      (c) => `
    <div class="bg-white rounded-xl shadow p-4 flex items-center gap-3">
      <div class="w-11 h-11 rounded-lg bg-wprimary-light text-wprimary flex items-center justify-center text-lg flex-shrink-0">
        <i class="fa-solid ${c.icon}"></i>
      </div>
      <div class="min-w-0">
        <p class="text-xs text-gray-400 truncate">${c.label}</p>
        <p class="text-base sm:text-lg font-bold text-wsecondary truncate">${c.value}</p>
      </div>
    </div>`
    )
    .join("");
}

function renderGpaxChart(rows) {
  if (!CHART_AVAILABLE) return;
  const ctx = document.getElementById("gpaxChart").getContext("2d");
  if (gpaxChartInstance) gpaxChartInstance.destroy();
  gpaxChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.gradeLevel),
      datasets: [
        {
          label: "GPAX เฉลี่ย",
          data: rows.map((r) => r.avgGpax),
          backgroundColor: THEME.primary,
          borderRadius: 6,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 4, ticks: { stepSize: 1 } } },
    },
  });
}

function renderSubmissionChart(progress) {
  if (!CHART_AVAILABLE) return;
  const ctx = document.getElementById("submissionChart").getContext("2d");
  if (submissionChartInstance) submissionChartInstance.destroy();
  submissionChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["ภาคเรียนที่ 1", "ภาคเรียนที่ 2"],
      datasets: [
        {
          label: "ส่งผลแล้ว (%)",
          data: [progress.sem1.percent, progress.sem2.percent],
          backgroundColor: THEME.primary,
          borderRadius: 6,
          maxBarThickness: 60,
        },
        {
          label: "ยังไม่ส่ง (%)",
          data: [Math.round((100 - progress.sem1.percent) * 100) / 100, Math.round((100 - progress.sem2.percent) * 100) / 100],
          backgroundColor: "#E5E7EB",
          borderRadius: 6,
          maxBarThickness: 60,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: { legend: { position: "bottom" } },
      scales: { x: { stacked: true, beginAtZero: true, max: 100 }, y: { stacked: true } },
    },
  });
}

function renderAchievementChart(rows) {
  if (!CHART_AVAILABLE) return;
  const ctx = document.getElementById("achievementChart").getContext("2d");
  if (achievementChartInstance) achievementChartInstance.destroy();
  achievementChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.subjectGroup),
      datasets: [
        {
          label: "เกรดเฉลี่ย",
          data: rows.map((r) => r.avgGradePoint),
          backgroundColor: THEME.secondary,
          borderRadius: 6,
          maxBarThickness: 44,
          yAxisID: "y",
        },
        {
          label: "% ผ่านเกณฑ์ดี (เกรด >= 3)",
          data: rows.map((r) => (r.passPercent === "-" ? null : r.passPercent)),
          type: "line",
          borderColor: THEME.accent,
          backgroundColor: THEME.accent,
          tension: 0.3,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { beginAtZero: true, max: 4, position: "left", title: { display: true, text: "เกรดเฉลี่ย" } },
        y1: { beginAtZero: true, max: 100, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "% ผ่านเกณฑ์ดี" } },
      },
    },
  });
}

function renderAchievementTable(table) {
  const fmt = (v) => (v === "-" || v === null || v === undefined ? "-" : v);

  const rowHtml = (row, isTotal) => `
    <tr class="${isTotal ? "" : "border-b border-gray-100"}">
      <td class="px-4 py-2 ${isTotal ? "" : "font-medium text-wsecondary"} whitespace-nowrap">${isTotal ? "รวมทั้งหมด" : row.subjectGroup}</td>
      <td class="px-3 py-2 text-center">${row.total}</td>
      ${row.counts.map((c) => `<td class="px-3 py-2 text-center">${c > 0 ? c : "-"}</td>`).join("")}
      <td class="px-3 py-2 text-center">${row.avgGradePoint !== null ? row.avgGradePoint.toFixed(2) : "-"}</td>
      <td class="px-3 py-2 text-center">${fmt(row.passPercent)}${row.passPercent !== "-" ? "%" : ""}</td>
    </tr>`;

  document.getElementById("achievementTableBody").innerHTML =
    table.rows.length > 0
      ? table.rows.map((r) => rowHtml(r, false)).join("")
      : `<tr><td colspan="12" class="px-4 py-6 text-center text-gray-400">ยังไม่มีข้อมูลผลการเรียนที่ส่งครบทั้งปีในขอบเขตที่เลือก</td></tr>`;

  document.getElementById("achievementTableFoot").innerHTML = rowHtml(table.totalRow, true);
}
