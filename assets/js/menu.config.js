/**
 * W-Score : Menu & Role Configuration
 * แก้ไข/เพิ่ม/ลบเมนู Sidebar ได้ที่นี่ที่เดียว มีผลกับทุกหน้าที่เรียกใช้ไฟล์นี้
 */

// ป้ายชื่อบทบาทที่แสดงผลบน Header
const ROLE_LABELS = {
  SUBJECT_TEACHER: "ครูประจำวิชา",
  HOMEROOM_TEACHER: "ครูประจำชั้น",
  REGISTRAR: "นายทะเบียน",
  ASSISTANT_REGISTRAR: "ผู้ช่วยนายทะเบียน",
  DIRECTOR: "ผู้อำนวยการสถานศึกษา",
};

// รายการเมนู Sidebar : roles = บทบาทที่มองเห็นเมนูนี้ได้
const MENU_CONFIG = [
  {
    roles: ["SUBJECT_TEACHER"],
    icon: "fa-sliders",
    label: "กำหนดช่องเก็บคะแนน",
    href: "grading.html",
  },
  {
    roles: ["SUBJECT_TEACHER"],
    icon: "fa-pen-to-square",
    label: "บันทึกคะแนนรายวิชา",
    href: "grade-entry.html",
  },
  {
    roles: ["SUBJECT_TEACHER"],
    icon: "fa-gavel",
    label: "ตัดสินผลการเรียน",
    href: "grade-finalize.html",
  },
{
  roles: ["SUBJECT_TEACHER"],
  icon: "fa-file-pdf",
  label: "รายงาน ปถ.05",
  href: "grade-report.html",
},
  {
    roles: ["HOMEROOM_TEACHER"],
    icon: "fa-star",
    label: "คุณลักษณะ/คิดวิเคราะห์อ่านเขียน",
    href: "homeroom-evaluation.html",
    homeroomLevels: ["", "PRIMARY", "MIXED"], // ครูประจำชั้นอนุบาลล้วนไม่เห็นเมนูนี้
  },
  {
    roles: ["HOMEROOM_TEACHER"],
    icon: "fa-file-pdf",
    label: "ออกรายงาน ปถ.06",
    href: "homeroom-report.html",
    homeroomLevels: ["", "PRIMARY", "MIXED"], // ครูประจำชั้นอนุบาลล้วนไม่เห็นเมนูนี้
  },
  {
    roles: ["HOMEROOM_TEACHER"],
    icon: "fa-file-pdf",
    label: "ออกรายงาน ปถ.07",
    href: "pt07-report.html",
    homeroomLevels: ["", "PRIMARY", "MIXED"], // ครูประจำชั้นอนุบาลล้วนไม่เห็นเมนูนี้
  },
  {
    // ครูประจำชั้นอนุบาล (อ.1-อ.3) เห็นเมนูนี้เมนูเดียว (ไม่เห็นเมนูของประถมด้านบน) — 5 ต.ค. 2569
    roles: ["HOMEROOM_TEACHER"],
    icon: "fa-file-pdf",
    label: "ออกรายงาน ปถ.12",
    href: "pt12-report.html",
    homeroomLevels: ["KINDERGARTEN", "MIXED"],
  },
  // ===== นายทะเบียน/ผู้ช่วยนายทะเบียน: จัดกลุ่มเมนูด้วย field "group" (27 ก.ย. 2569) =====
  // เมนูที่ไม่มี field "group" จะแสดงแบบเดิม (ไม่จัดกลุ่ม) — ใช้กับ role อื่นที่มีเมนูน้อยอยู่แล้วด้านล่าง

  // กลุ่ม "การตั้งค่า"
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "การตั้งค่า",
    icon: "fa-calendar-days",
    label: "ตั้งค่าปีการศึกษา",
    href: "settings-academic-year.html",
  },
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "การตั้งค่า",
    icon: "fa-clock",
    label: "ตั้งเวลาบันทึกคะแนน",
    href: "settings-grading-period.html",
  },

  // กลุ่ม "จัดการข้อมูล"
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "จัดการข้อมูล",
    icon: "fa-chalkboard",
    label: "จัดการห้องเรียน",
    href: "classes-manage.html",
  },
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "จัดการข้อมูล",
    icon: "fa-people-group",
    label: "จัดนักเรียนเข้าห้องเรียน",
    href: "enrollments-manage.html",
  },
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "จัดการข้อมูล",
    icon: "fa-user-graduate",
    label: "จัดการข้อมูลนักเรียน",
    href: "students-manage.html",
  },
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "จัดการข้อมูล",
    icon: "fa-book",
    label: "จัดการหลักสูตร/รายวิชา",
    href: "subjects-manage.html",
  },
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "จัดการข้อมูล",
    icon: "fa-chalkboard-user",
    label: "จัดการมอบหมายการสอน",
    href: "teaching-assignments-manage.html",
  },

  // กลุ่ม "บันทึกผลการประเมิน"
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "บันทึกผลการประเมิน",
    icon: "fa-medal",
    label: "กิจกรรมพัฒนาผู้เรียน",
    href: "activity-results-manage.html",
  },
  {
    // ยังไม่ได้สร้างหน้านี้ (จะทำในอนาคต) — 27 ก.ย. 2569
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "บันทึกผลการประเมิน",
    icon: "fa-pen-nib",
    label: "การอ่าน คิดวิเคราะห์และเขียน",
    href: "reading-analysis-manage.html",
  },
  {
    // ยังไม่ได้สร้างหน้านี้ (จะทำในอนาคต) — 27 ก.ย. 2569
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "บันทึกผลการประเมิน",
    icon: "fa-star",
    label: "คุณลักษณะอันพึงประสงค์",
    href: "desirable-characteristics-manage.html",
  },

  // กลุ่ม "เอกสารทางการศึกษา"
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "เอกสารทางการศึกษา",
    icon: "fa-file-pdf",
    label: "ออกรายงาน ปถ.06",
    href: "pt06-report.html",
  },
  {
    // ยังไม่ได้สร้างหน้านี้ (จะทำในอนาคต) — เดิมรวมกับ ปพ.3 อยู่ในเมนู "พิมพ์เอกสาร (ปพ.1/ปพ.3)" แยกออกมาตามที่ผู้ใช้ต้องการ (27 ก.ย. 2569)
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "เอกสารทางการศึกษา",
    icon: "fa-file-lines",
    label: "ออกเอกสาร ปพ.1",
    href: "pp1-document.html",
  },
  {
    // ยังไม่ได้สร้างหน้านี้ (จะทำในอนาคต) — 27 ก.ย. 2569
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "เอกสารทางการศึกษา",
    icon: "fa-file-lines",
    label: "ออกเอกสาร ปพ.3",
    href: "pp3-document.html",
  },

  // กลุ่ม "ตรวจสอบข้อมูล"
  {
    // ยังไม่ได้สร้างหน้านี้ (จะทำในอนาคต) — 27 ก.ย. 2569
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "ตรวจสอบข้อมูล",
    icon: "fa-magnifying-glass",
    label: "ตรวจสอบผลการเรียน",
    href: "grades-check.html",
  },
  {
    // ยังไม่ได้สร้างหน้านี้ (จะทำในอนาคต) — เดิมรวมกับ "ตรวจสอบ" อยู่ในเมนูเดียว แยกออกมาตามที่ผู้ใช้ต้องการ (27 ก.ย. 2569)
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    group: "ตรวจสอบข้อมูล",
    icon: "fa-clipboard-check",
    label: "อนุมัติผลการเรียน",
    href: "grades-approve.html",
  },

  {
    roles: ["DIRECTOR"],
    icon: "fa-chart-pie",
    label: "รายงานสรุปผู้บริหาร",
    href: "reports.html",
  },
];
