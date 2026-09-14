/**
 * W-Score : Theme Color Configuration
 * แก้ไขค่าสี (Hex Code) ของระบบได้ที่นี่ที่เดียว มีผลกับทุกหน้าที่เรียกใช้ไฟล์นี้
 */
window.WSCORE_THEME_COLORS = {
  primary: '#40BD68',       // สีหลัก
  primaryDark: '#329654',   // สีหลัก (เข้ม) - ใช้ตอน hover
  primaryLight: '#E8F8ED',  // สีหลัก (อ่อน)
  secondary: '#121363',     // สีรอง
  secondaryLight: '#1E2080',// สีรอง (อ่อน)
  accent: '#D9C94C',        // สีย่อย
};

tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sarabun', 'sans-serif'],
      },
      colors: {
        wprimary: {
          DEFAULT: window.WSCORE_THEME_COLORS.primary,
          dark: window.WSCORE_THEME_COLORS.primaryDark,
          light: window.WSCORE_THEME_COLORS.primaryLight,
        },
        wsecondary: {
          DEFAULT: window.WSCORE_THEME_COLORS.secondary,
          light: window.WSCORE_THEME_COLORS.secondaryLight,
        },
        waccent: window.WSCORE_THEME_COLORS.accent,
      }
    }
  }
}
