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
    icon: "fa-pen-to-square",
    label: "บันทึกคะแนนรายวิชา",
    href: "grading.html",
  },
  {
    roles: ["HOMEROOM_TEACHER"],
    icon: "fa-chalkboard-user",
    label: "สรุปข้อมูลประจำชั้น",
    href: "homeroom.html",
  },
  {
    roles: ["HOMEROOM_TEACHER"],
    icon: "fa-user-check",
    label: "เวลาเรียน / กิจกรรมโฮมรูม",
    href: "homeroom-activity.html",
  },
  {
    roles: ["HOMEROOM_TEACHER"],
    icon: "fa-star",
    label: "คุณลักษณะ / อ่านคิดวิเคราะห์",
    href: "homeroom-evaluation.html",
  },
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    icon: "fa-calendar-days",
    label: "ตั้งค่าปีการศึกษา",
    href: "settings-academic-year.html",
  },
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    icon: "fa-book",
    label: "จัดการหลักสูตร/รายวิชา",
    href: "subjects-manage.html",
  },  

  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    icon: "fa-user-graduate",
    label: "จัดการข้อมูลนักเรียน",
    href: "students-manage.html",
  },
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    icon: "fa-clipboard-check",
    label: "ตรวจสอบ/อนุมัติผลการเรียน",
    href: "grades-approve.html",
  },
  {
    roles: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
    icon: "fa-file-lines",
    label: "พิมพ์เอกสาร (ปพ.1 / ปพ.3)",
    href: "documents.html",
  },
  {
    roles: ["DIRECTOR"],
    icon: "fa-chart-pie",
    label: "รายงานสรุปผู้บริหาร",
    href: "reports.html",
  },
];
