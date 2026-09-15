/**
 * W-Score : Global Layout (Header + Sidebar)
 * ใช้ร่วมกันทุกหน้ายกเว้นหน้า Login
 * ต้องโหลดไฟล์นี้หลัง theme.config.js และ menu.config.js เสมอ
 */

(function () {
  const userData = JSON.parse(sessionStorage.getItem("wscore_user") || "null");

  // ยังไม่ได้ Login -> เด้งกลับหน้า Login ทันที
  if (!userData) {
    window.location.href = "login.html";
    return;
  }

  const roles = userData.roles || [];
  let currentRole =
    sessionStorage.getItem("wscore_current_role") ||
    (roles[0] && roles[0].roleType) ||
    "";

  document.addEventListener("DOMContentLoaded", function () {
    renderHeader();
    renderSidebar();
    bindEvents();
  });

  function renderHeader() {
    const roleOptions = roles
      .map(
        (r) =>
          `<option value="${r.roleType}" ${r.roleType === currentRole ? "selected" : ""}>${ROLE_LABELS[r.roleType] || r.roleType}</option>`
      )
      .join("");

    const roleSwitcher =
      roles.length > 1
        ? `<select id="roleSwitcher" class="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-wprimary/30">
             ${roleOptions}
           </select>`
        : `<span class="text-sm font-medium text-wsecondary bg-wprimary-light px-3 py-1.5 rounded-lg">
             ${ROLE_LABELS[currentRole] || currentRole}
           </span>`;

    document.getElementById("app-header").innerHTML = `
      <header class="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4 lg:px-6">
        <div class="flex items-center gap-3">
          <button id="sidebarToggle" class="lg:hidden text-wsecondary text-xl">
            <i class="fa-solid fa-bars"></i>
          </button>
          <img src="assets/img/logo.png" alt="W-Score" class="h-12 object-contain">
          <span class="hidden sm:inline text-wsecondary font-bold text-lg">ระบบบริหารจัดการวัดและประเมินผลการเรียนรู้<br>โรงเรียนเทศบาลวัดโขดทิมทาราม</span>
        </div>
        <div class="flex items-center gap-2 sm:gap-4">
          ${roleSwitcher}
          <span class="hidden sm:inline text-sm text-gray-600">
            <i class="fa-solid fa-user-circle mr-1"></i>${userData.fullName || userData.username}
          </span>
          <button id="logoutBtn" class="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium px-2 py-1.5">
            <i class="fa-solid fa-right-from-bracket"></i>
            <span class="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </header>
    `;
  }

  function renderSidebar() {
    const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";

    const items = MENU_CONFIG.filter((item) => item.roles.includes(currentRole));

    const homeLink = `
      <a href="dashboard.html" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
        currentPage === "dashboard.html"
          ? "bg-wprimary-light text-wprimary"
          : "text-gray-600 hover:bg-gray-100"
      }">
        <i class="fa-solid fa-house w-5 text-center"></i>
        <span>หน้าหลัก</span>
      </a>`;

    const menuLinks = items
      .map(
        (item) => `
      <a href="${item.href}" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
          currentPage === item.href
            ? "bg-wprimary-light text-wprimary"
            : "text-gray-600 hover:bg-gray-100"
        }">
        <i class="fa-solid ${item.icon} w-5 text-center"></i>
        <span>${item.label}</span>
      </a>`
      )
      .join("");

    document.getElementById("app-sidebar").innerHTML = `
      <div id="sidebarOverlay" class="fixed inset-0 bg-black/40 z-30 hidden lg:hidden"></div>
      <aside id="sidebarPanel" class="fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-40 -translate-x-full lg:translate-x-0 transition-transform duration-200 overflow-y-auto">
        <nav class="p-3 space-y-1">
          ${homeLink}
          ${menuLinks}
        </nav>
      </aside>
    `;
  }

  function bindEvents() {
    document.getElementById("logoutBtn").addEventListener("click", function () {
      Swal.fire({
        icon: "question",
        title: "ออกจากระบบ?",
        text: "คุณต้องการออกจากระบบใช่หรือไม่",
        showCancelButton: true,
        confirmButtonText: "ออกจากระบบ",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#d33",
      }).then((result) => {
        if (result.isConfirmed) {
          sessionStorage.removeItem("wscore_user");
          sessionStorage.removeItem("wscore_current_role");
          window.location.href = "login.html";
        }
      });
    });

    const roleSwitcher = document.getElementById("roleSwitcher");
    if (roleSwitcher) {
      roleSwitcher.addEventListener("change", function () {
        sessionStorage.setItem("wscore_current_role", this.value);
        window.location.href = "dashboard.html";
      });
    }

    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebarPanel = document.getElementById("sidebarPanel");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    function openSidebar() {
      sidebarPanel.classList.remove("-translate-x-full");
      sidebarOverlay.classList.remove("hidden");
    }
    function closeSidebar() {
      sidebarPanel.classList.add("-translate-x-full");
      sidebarOverlay.classList.add("hidden");
    }

    sidebarToggle.addEventListener("click", openSidebar);
    sidebarOverlay.addEventListener("click", closeSidebar);
  }
})();
