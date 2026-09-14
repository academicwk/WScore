/**
 * W-Score : Login Page Logic
 * เชื่อมต่อกับ Google Apps Script Web App (ทำหน้าที่เป็น Backend API)
 */


document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("yearNow").textContent = new Date().getFullYear() + 543;

  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  const togglePassword = document.getElementById("togglePassword");
  const togglePasswordIcon = document.getElementById("togglePasswordIcon");
  const passwordInput = document.getElementById("password");

  // สลับแสดง/ซ่อนรหัสผ่าน
  togglePassword.addEventListener("click", function () {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePasswordIcon.classList.toggle("fa-eye");
    togglePasswordIcon.classList.toggle("fa-eye-slash");
  });

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      Swal.fire({
        icon: "warning",
        title: "กรอกข้อมูลไม่ครบถ้วน",
        text: "กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน",
        confirmButtonColor: "#40BD68",
      });
      return;
    }

    handleLogin(username, password);
  });

  async function handleLogin(username, password) {
    setLoading(true);

    try {
      const result = await callApi("login", { username, password });

      if (result.status === "success") {
        // เก็บข้อมูล Session ของผู้ใช้งาน (User + Roles) ไว้ใช้ทั่วทั้งระบบ
        sessionStorage.setItem("wscore_user", JSON.stringify(result.data));

        Swal.fire({
          icon: "success",
          title: "เข้าสู่ระบบสำเร็จ",
          confirmButtonColor: "#40BD68",
          timer: 1200,
          showConfirmButton: false,
        }).then(() => {
          window.location.href = "dashboard.html";
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "เข้าสู่ระบบไม่สำเร็จ",
          text: result.message || "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง",
          confirmButtonColor: "#40BD68",
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "เชื่อมต่อระบบไม่สำเร็จ",
        text: "ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง",
        confirmButtonColor: "#40BD68",
      });
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtn.innerHTML = isLoading
      ? '<i class="fa-solid fa-circle-notch fa-spin"></i><span>กำลังตรวจสอบ...</span>'
      : '<i class="fa-solid fa-right-to-bracket"></i><span>เข้าสู่ระบบ</span>';
  }
});
