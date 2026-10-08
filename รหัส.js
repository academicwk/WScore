/**
 * W-Score : Backend API (Google Apps Script)
 * ผูกกับ Google Sheets ฐานข้อมูลโดยตรง (Container-bound Script)
 * เรียกใช้ SpreadsheetApp.getActiveSpreadsheet() จึงไม่ต้องระบุ Sheet ID
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // อายุเซสชัน 8 ชั่วโมง นับจากเข้าสู่ระบบ

// ===== ตั้งค่าสำหรับระบบรายงาน "ปถ.05" =====
// PT05_TEMPLATE_FILE_ID = File ID ของไฟล์ Google Sheets ต้นแบบ (แปลงจากไฟล์ .xlsx เทมเพลตที่ได้รับมา)
//   วิธีหา: เปิดไฟล์ต้นแบบใน Google Drive แล้วดู ID จาก URL
//   https://docs.google.com/spreadsheets/d/{ตรงนี้คือ File ID}/edit
// PT05_REPORTS_FOLDER_ID = Folder ID ใน Google Drive สำหรับเก็บไฟล์ PDF รายงานที่สร้างขึ้น
//   วิธีหา: เปิดโฟลเดอร์ใน Google Drive แล้วดู ID จาก URL
//   https://drive.google.com/drive/folders/{ตรงนี้คือ Folder ID}
const PT05_TEMPLATE_FILE_ID = "1E6VTB0bkSGVrP7lSSQqEY3a15tIaMyHEjNoNIMUaXjs";
const PT05_REPORTS_FOLDER_ID = "1e_IJMSCT0y5d2iTzH9YyMXfkOXnNpL07";

// ===== ตั้งค่าสำหรับระบบรายงาน "ปถ.06" =====
// PT06_TEMPLATE_FILE_ID = File ID ของไฟล์ Google Sheets ต้นแบบ (เวอร์ชันแก้ไขล่าสุดที่ผู้ใช้ส่งมาเมื่อ 25 ก.ย. 2569 มีชีตเดียวชื่อ "ปพ.6"
//   โครงสร้างมีคอลัมน์แยกภาคเรียนที่ 1/ภาคเรียนที่ 2/สรุปผลปลายปีในตารางเดียวกัน — ดูรายละเอียดคอมเมนต์ในฟังก์ชัน fillPt06Sheet())
// โฟลเดอร์เก็บ PDF ที่สร้างขึ้น แยกจากโฟลเดอร์ ปถ.05 ตามที่ผู้ใช้ต้องการ — ไม่ได้ hardcode ID ไว้ที่นี่
// เพราะระบบจะสร้างโฟลเดอร์ให้เองอัตโนมัติในการใช้งานครั้งแรก (ดูฟังก์ชัน getPt06ReportsFolderId() ด้านล่าง)
const PT06_TEMPLATE_FILE_ID = "1Txwjtf81EzQVlt5Wx5DWU7e4A4mGBGsx8G6o-K1AxsM";

// ===== ตั้งค่าสำหรับระบบรายงาน "ปถ.12" (อนุบาล) — 6 ต.ค. 2569 =====
// PT12_TEMPLATE_FILE_ID = File ID ของไฟล์ Google Sheets ต้นแบบ ปถ.12 (แปลงจากไฟล์ .xlsx เทมเพลตที่ผู้ใช้ส่งมา มีชีตเดียวชื่อ "ปพ.6")
// *** ต้องอัปโหลดไฟล์เทมเพลตขึ้น Google Drive แล้วเปิดด้วย Google Sheets (ไฟล์ > บันทึกเป็น Google ชีต) จากนั้นนำ File ID มาใส่แทนข้อความด้านล่าง ***
// โฟลเดอร์เก็บ PDF ระบบสร้างให้เองครั้งแรก (ดู getPt12ReportsFolderId())
const PT12_TEMPLATE_FILE_ID = "19uJFtFkphSSJoZ5rD6LREOx1liEzK8dKmCGB5UkLJVM";

/**
 * Action ที่จำกัดให้ใช้ได้เฉพาะบางบทบาทเท่านั้น (นอกเหนือจากนี้ = ใช้ได้ทุกคนที่ login แล้ว)
 * อ้างอิงจาก MENU_CONFIG ฝั่งหน้าเว็บ: เมนูที่เห็นเฉพาะ REGISTRAR/ASSISTANT_REGISTRAR
 */
const ACTION_ROLES = {
  getAcademicYears: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  setCurrentAcademicYear: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  addAcademicYear: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getSubjects: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  addSubject: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  addSubjectsBulk: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  updateSubject: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  deleteSubject: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getStudents: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  addStudent: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  updateStudent: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  deleteStudent: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getUsers: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getHomeroomTeachers: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getClasses: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  addClass: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  updateClass: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getClassesPageData: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  deleteClass: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getEnrollmentsByClass: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getEnrollmentsPageData: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getAvailableStudents: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  addEnrollment: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  addEnrollmentsBulk: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  updateEnrollmentNumber: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  deleteEnrollment: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getTeachingAssignmentsPageData: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  addTeachingAssignment: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  addTeachingAssignmentsBulk: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  updateTeachingAssignment: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  deleteTeachingAssignment: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getGradingPeriods: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  setGradingPeriod: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  setGradingPeriodManualStatus: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  // getGradingPeriodStatus ไม่จำกัดสิทธิ์ไว้โดยตั้งใจ (ทุกบทบาทที่ login แล้วต้องเห็นตัวนับถอยหลังที่ Header ได้)
  // ด้านล่างนี้มี isAssignedToTeach()/เช็คสิทธิ์เจ้าของข้อมูลอยู่ในตัว handler ทุกตัวอยู่แล้ว (ไม่ใช่ช่องโหว่)
  // แต่เพิ่มไว้ใน ACTION_ROLES ด้วยเพื่อ defense-in-depth ให้สอดคล้องกับฝั่งครูประจำชั้น/นายทะเบียนด้านล่าง (27 ก.ย. 2569)
  getGradeSetup: ["SUBJECT_TEACHER"],
  addGradeSubComponent: ["SUBJECT_TEACHER"],
  deleteGradeSubComponent: ["SUBJECT_TEACHER"],
  updateGradeSubComponent: ["SUBJECT_TEACHER"],
  getGradeEntryPageData: ["SUBJECT_TEACHER"],
  saveStudentScores: ["SUBJECT_TEACHER"],
  getFinalizePageData: ["SUBJECT_TEACHER"],
  submitFinalResults: ["SUBJECT_TEACHER"],
  withdrawFinalResults: ["SUBJECT_TEACHER"],
  generateSubjectReport: ["SUBJECT_TEACHER"],
  getHomeroomSummaryPageData: ["HOMEROOM_TEACHER"],
  // ปถ.06 มีอยู่ 2 จุดในระบบ: ฝั่งครูประจำชั้น (เฉพาะห้องตนเอง, ไม่มีโหมดพรีวิวแล้ว) และฝั่งนายทะเบียน (ทุกห้อง/ทุกคนในโรงเรียน)
  getHomeroomStudentReportData: ["HOMEROOM_TEACHER"],
  generateHomeroomStudentReport: ["HOMEROOM_TEACHER"],
  generateHomeroomClassReport: ["HOMEROOM_TEACHER"],
  // ปถ.12 (ครูประจำชั้นอนุบาล อ.1-อ.3): บันทึกคะแนน 4 ด้าน + ความคิดเห็นครูประจำชั้น — 5 ต.ค. 2569
  getPt12PageData: ["HOMEROOM_TEACHER"],
  savePt12Results: ["HOMEROOM_TEACHER"],
  generatePt12StudentReport: ["HOMEROOM_TEACHER"],
  getPt06StudentReportData: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  generatePt06StudentReport: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  generatePt06ClassReport: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  // กิจกรรมพัฒนาผู้เรียนไม่มีครูประจำวิชาโดยตรง นายทะเบียน/ผู้ช่วยนายทะเบียนเป็นผู้บันทึกผลแทนทั้งระดับชั้น (26 ก.ย. 2569)
  getActivityResultsPageData: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getActivityResultMatrix: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  saveActivityResultsBulk: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  // "รายงานสรุปผู้บริหาร" อ่านอย่างเดียว ยังไม่มีปุ่มอนุมัติผลการเรียนระดับสถานศึกษา (จะทำในอนาคต) — 27 ก.ย. 2569
  getDirectorReportData: ["DIRECTOR"],
  // หน้าแรกนายทะเบียน: กำกับติดตามความคืบหน้าการบันทึกคะแนนของครูประจำวิชาทุกคน (อ่านอย่างเดียว) — 5 ต.ค. 2569
  getRegistrarTeacherProgressOverview: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  getTeacherProgressDetail: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
  // โหลดข้อมูลหลายห้อง/วิชาของครูล่วงหน้าในคำขอเดียว (อ่านอย่างเดียว) — สิทธิ์ของแต่ละรายการตรวจแยกใน handleBatch — 8 ต.ค. 2569
  batch: ["SUBJECT_TEACHER", "HOMEROOM_TEACHER"],
};

/**
 * ===== โหลดข้อมูลล่วงหน้าแบบชุด (8 ต.ค. 2569) =====
 * ให้หน้าเว็บของครูขอข้อมูลหน้าจอหลายชุด (เช่น ทุกวิชา x ห้องที่ตนสอน) ในคำขอเดียว เพื่อเก็บไว้ในเบราว์เซอร์ให้เลือกแล้วขึ้นทันที
 * - อนุญาตเฉพาะ action แบบ "อ่านอย่างเดียว" ที่อยู่ในรายการด้านล่างเท่านั้น (ห้ามบันทึก/ลบ/ซ้อน batch)
 * - แต่ละรายการตรวจสิทธิ์ Role ของ action นั้นตาม ACTION_ROLES และให้ handler เดิมตรวจสิทธิ์เจ้าของข้อมูลเองเหมือนเรียกปกติ
 *   (userId ถูกเขียนทับด้วยผู้ใช้จริงจาก session เสมอ ครูจึงขอข้อมูลของวิชา/ห้องที่ไม่ได้สอนไม่ได้)
 * body.calls = [{ key, action, payload }] สูงสุด 25 รายการ ถ้าใช้เวลานานเกินกำหนดจะข้ามรายการที่เหลือ (ฝั่งเว็บค่อยขอใหม่ทีหลังได้)
 */
const BATCH_ALLOWED_ACTIONS = {
  getTeacherSubjectsPageData: (b) => handleGetTeacherSubjectsPageData(b.userId),
  getGradeSetup: (b) => handleGetGradeSetup(b),
  getGradeEntryPageData: (b) => handleGetGradeEntryPageData(b),
  getFinalizePageData: (b) => handleGetFinalizePageData(b),
  getHomeroomSummaryPageData: (b) => handleGetHomeroomSummaryPageData(b),
  getPt12PageData: (b) => handleGetPt12PageData(b),
};
const BATCH_MAX_CALLS = 25;
const BATCH_MAX_MS = 25000;

function handleBatch(body) {
  const calls = Array.isArray(body.calls) ? body.calls : [];
  if (calls.length === 0) return { status: "error", message: "ไม่มีรายการที่ต้องการโหลด" };
  if (calls.length > BATCH_MAX_CALLS) {
    return { status: "error", message: "โหลดพร้อมกันได้ไม่เกิน " + BATCH_MAX_CALLS + " รายการต่อครั้ง" };
  }

  const startedAt = Date.now();
  const results = calls.map((call) => {
    const key = call && call.key !== undefined ? call.key : null;
    const action = call ? call.action : "";
    const fn = BATCH_ALLOWED_ACTIONS[action];
    if (!fn) return { key: key, result: { status: "error", message: "action นี้ไม่อนุญาตให้โหลดแบบชุด: " + action } };

    if (Date.now() - startedAt > BATCH_MAX_MS) {
      return { key: key, result: { status: "error", skipped: true, message: "ข้ามเนื่องจากใช้เวลานาน" } };
    }

    const requiredRoles = ACTION_ROLES[action];
    if (requiredRoles && !hasAnyRole(body.userId, requiredRoles)) {
      return { key: key, result: { status: "error", message: "คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้" } };
    }

    try {
      const subBody = Object.assign({}, call.payload || {}, { action: action, userId: body.userId, token: body.token });
      return { key: key, result: fn(subBody) };
    } catch (err) {
      return { key: key, result: { status: "error", message: "เกิดข้อผิดพลาดในระบบ: " + err.message } };
    }
  });

  return { status: "success", data: { results: results } };
}

/**
 * ตรวจว่าข้อมูลที่ส่งมา (ทุกชั้นของ object/array) มีข้อความที่หน้าตาเป็นแท็ก HTML หรือไม่ เช่น <script>, </div>, <img ...>
 * ข้อความทั่วไปที่มี < หรือ > เช่น "ก < ข" ไม่ถูกบล็อก (ต้องมี < ตามด้วยตัวอักษร / ! ทันที)
 */
function containsHtmlTag(value, depth) {
  if (depth > 6 || value === null || value === undefined) return false;
  if (typeof value === "string") return /<[a-zA-Z\/!?]/.test(value);
  if (Array.isArray(value)) return value.some((v) => containsHtmlTag(v, depth + 1));
  if (typeof value === "object") {
    return Object.keys(value).some((k) => containsHtmlTag(value[k], depth + 1));
  }
  return false;
}

/**
 * จุดรับคำขอทั้งหมดจากฝั่งเว็บ (POST)
 * body ที่ส่งมาจะมี field "action" เป็นตัวกำหนดว่าจะให้ทำอะไร
 *
 * ทุก action ยกเว้น "login" ต้องแนบ "token" (ได้จากตอน login สำเร็จ) มาด้วยเสมอ
 * ถ้า token ไม่ถูกต้อง/หมดอายุ จะถูกปฏิเสธก่อนเข้าสู่ handler ใดๆ ทั้งสิ้น
 * และ body.userId จะถูกเขียนทับด้วยรหัสผู้ใช้งานจริงจาก session เสมอ
 * เพื่อป้องกันการปลอมค่า userId มาจากฝั่ง client
 *
 * action ที่อยู่ใน ACTION_ROLES ต้องมีบทบาทตรงตามที่กำหนดเท่านั้นจึงจะเรียกได้
 * (เช่น getStudents/addStudent ต้องเป็น REGISTRAR หรือ ASSISTANT_REGISTRAR เท่านั้น)
 */
function doPost(e) {
  let result;

  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    // กันการฝังแท็ก HTML/สคริปต์ในข้อมูลที่บันทึก (เช่น ชื่อ, ความเห็น) เพราะหน้าเว็บแสดงข้อมูลผ่าน innerHTML — 8 ต.ค. 2569
    if (action !== "login" && containsHtmlTag(body, 0)) {
      return ContentService
        .createTextOutput(JSON.stringify({
          status: "error",
          message: "ข้อมูลมีอักขระที่ไม่อนุญาต (แท็ก HTML เช่น <script>) กรุณาตรวจสอบและลบออกก่อนบันทึก",
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action !== "login") {
      const session = verifySession(body.token);
      if (!session.valid) {
        return ContentService
          .createTextOutput(JSON.stringify({
            status: "error",
            message: "เซสชันหมดอายุ หรือยังไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่",
            sessionExpired: true,
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      body.userId = session.userId;

      const requiredRoles = ACTION_ROLES[action];
      if (requiredRoles && !hasAnyRole(body.userId, requiredRoles)) {
        return ContentService
          .createTextOutput(JSON.stringify({
            status: "error",
            message: "คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้",
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    switch (action) {
      case "login":
        result = handleLogin(body.username, body.password);
        break;
      case "logout":
        result = handleLogout(body);
        break;
      case "getAcademicYears":
        result = handleGetAcademicYears();
        break;
      case "setCurrentAcademicYear":
        result = handleSetCurrentAcademicYear(body.academicYearId);
        break;
      case "addAcademicYear":
        result = handleAddAcademicYear(body);
        break;
      case "getSubjects":
        result = handleGetSubjects();
        break;
      case "addSubject":
        result = handleAddSubject(body);
        break;
      case "addSubjectsBulk":
        result = handleAddSubjectsBulk(body);
        break;
      case "updateSubject":
        result = handleUpdateSubject(body);
        break;
      case "deleteSubject":
        result = handleDeleteSubject(body);
        break;
      case "getStudents":
        result = handleGetStudents();
        break;
      case "addStudent":
        result = handleAddStudent(body);
        break;
      case "updateStudent":
        result = handleUpdateStudent(body);
        break;
      case "deleteStudent":
        result = handleDeleteStudent(body);
        break;
      case "getUsers":
        result = handleGetUsers();
        break;
      case "getHomeroomTeachers":
        result = handleGetHomeroomTeachers();
        break;
      case "getDashboardData":
        result = handleGetDashboardData(body);
        break;
      case "getClasses":
        result = handleGetClasses();
        break;
      case "addClass":
        result = handleAddClass(body);
        break;
      case "updateClass":
        result = handleUpdateClass(body);
        break;
      case "getClassesPageData":
        result = handleGetClassesPageData();
        break;
      case "deleteClass":
        result = handleDeleteClass(body);
        break;
      case "getEnrollmentsByClass":
        result = handleGetEnrollmentsByClass(body.classId);
        break;
      case "getEnrollmentsPageData":
        result = handleGetEnrollmentsPageData();
        break;
      case "getAvailableStudents":
        result = handleGetAvailableStudents(body.academicYearId);
        break;
      case "addEnrollment":
        result = handleAddEnrollment(body);
        break;
      case "addEnrollmentsBulk":
        result = handleAddEnrollmentsBulk(body);
        break;
      case "updateEnrollmentNumber":
        result = handleUpdateEnrollmentNumber(body);
        break;
      case "deleteEnrollment":
        result = handleDeleteEnrollment(body.enrollmentId);
        break;
      case "getTeachingAssignmentsPageData":
        result = handleGetTeachingAssignmentsPageData();
        break;
      case "addTeachingAssignment":
        result = handleAddTeachingAssignment(body);
        break;
      case "addTeachingAssignmentsBulk":
        result = handleAddTeachingAssignmentsBulk(body);
        break;
      case "updateTeachingAssignment":
        result = handleUpdateTeachingAssignment(body);
        break;
      case "deleteTeachingAssignment":
        result = handleDeleteTeachingAssignment(body);
        break;
      case "getTeacherSubjectsPageData":
        result = handleGetTeacherSubjectsPageData(body.userId);
        break;
      case "getGradeSetup":
        result = handleGetGradeSetup(body);
        break;
      case "addGradeSubComponent":
        result = handleAddGradeSubComponent(body);
        break;
      case "deleteGradeSubComponent":
        result = handleDeleteGradeSubComponent(body);
        break;
      case "updateGradeSubComponent":
        result = handleUpdateGradeSubComponent(body);
        break;
      case "getGradeEntryPageData":
        result = handleGetGradeEntryPageData(body);
        break;
      case "saveStudentScores":
        result = handleSaveStudentScores(body);
        break;
      case "getFinalizePageData":
        result = handleGetFinalizePageData(body);
        break;
      case "submitFinalResults":
        result = handleSubmitFinalResults(body);
        break;
      case "withdrawFinalResults":
        result = handleWithdrawFinalResults(body);
        break;
      case "generateSubjectReport":
        result = handleGenerateSubjectReport(body);
        break;
      case "getGradingPeriods":
        result = handleGetGradingPeriods();
        break;
      case "setGradingPeriod":
        result = handleSetGradingPeriod(body);
        break;
      case "setGradingPeriodManualStatus":
        result = handleSetGradingPeriodManualStatus(body);
        break;
      case "getGradingPeriodStatus":
        result = handleGetGradingPeriodStatus();
        break;
      case "getHomeroomSummaryPageData":
        result = handleGetHomeroomSummaryPageData(body);
        break;
      case "getHomeroomStudentReportData":
        result = handleGetHomeroomStudentReportData(body);
        break;
      case "generateHomeroomStudentReport":
        result = handleGenerateHomeroomStudentReport(body);
        break;
      case "generateHomeroomClassReport":
        result = handleGenerateHomeroomClassReport(body);
        break;
      case "getPt12PageData":
        result = handleGetPt12PageData(body);
        break;
      case "savePt12Results":
        result = handleSavePt12Results(body);
        break;
      case "generatePt12StudentReport":
        result = handleGeneratePt12StudentReport(body);
        break;
      case "getPt06StudentReportData":
        result = handleGetPt06StudentReportData(body);
        break;
      case "generatePt06StudentReport":
        result = handleGeneratePt06StudentReport(body);
        break;
      case "generatePt06ClassReport":
        result = handleGeneratePt06ClassReport(body);
        break;
      case "getActivityResultsPageData":
        result = handleGetActivityResultsPageData();
        break;
      case "getActivityResultMatrix":
        result = handleGetActivityResultMatrix(body);
        break;
      case "saveActivityResultsBulk":
        result = handleSaveActivityResultsBulk(body);
        break;
      case "getDirectorReportData":
        result = handleGetDirectorReportData(body);
        break;
      case "getRegistrarTeacherProgressOverview":
        result = handleGetRegistrarTeacherProgressOverview(body);
        break;
      case "getTeacherProgressDetail":
        result = handleGetTeacherProgressDetail(body);
        break;
      case "batch":
        result = handleBatch(body);
        break;

      default:
        result = { status: "error", message: "ไม่รู้จัก action นี้: " + action };
    }
  } catch (err) {
    result = { status: "error", message: "เกิดข้อผิดพลาดในระบบ: " + err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * แปลงข้อมูลจาก Sheet ให้เป็น Array of Object โดยใช้แถวที่ 1 เป็นหัวคอลัมน์
 * (ข้ามแถวคำอธิบาย/ตัวอย่างข้อมูลของไฟล์ต้นแบบ ถ้ามีให้ลบออกจาก Sheet จริงก่อนใช้งาน)
 */
function getSheetData(sheetName) {
  const sheet = SS.getSheetByName(sheetName);
  if (!sheet) throw new Error("ไม่พบ Sheet ชื่อ: " + sheetName);

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);

  return rows
    .filter((row) => row.some((cell) => cell !== "" && cell !== null))
    .map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
}

/**
 * ค้นหาแถวของ StudentScores ตามเงื่อนไข (เทียบแบบข้อความ) โดยอ่านเฉพาะคอลัมน์ที่ใช้กรองก่อน แล้วค่อยอ่านเฉพาะแถวที่ตรงเงื่อนไข
 * แทนการอ่านทั้งชีตทุกครั้ง (ชีตคะแนนโตตามจำนวนนักเรียน x วิชา x ช่องคะแนน จึงเป็นตัวถ่วงความเร็วหลัก) — 8 ต.ค. 2569
 * criteria เช่น { ClassID: "C1", SubjectID: "SB1", AcademicYearID: "AY2569", Semester: 1 }
 * countOnly = true จะคืนเฉพาะจำนวนแถว (ไม่อ่านแถวจริง) คืนค่ารูปแบบเดียวกับ getSheetData() คือ array ของ object ตามหัวคอลัมน์
 */
function getStudentScoresWhere(criteria, countOnly) {
  const sheet = SS.getSheetByName("StudentScores");
  if (!sheet) throw new Error("ไม่พบ Sheet ชื่อ: StudentScores");
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return countOnly ? 0 : [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const keys = Object.keys(criteria);
  const keyCols = keys.map((k) => {
    const idx = headers.indexOf(k);
    if (idx === -1) throw new Error("ไม่พบคอลัมน์ " + k + " ในชีต StudentScores");
    return sheet.getRange(2, idx + 1, lastRow - 1, 1).getValues();
  });

  const wanted = keys.map((k) => String(criteria[k]));
  const matchedRows = []; // เลขแถวจริงในชีต
  for (let r = 0; r < lastRow - 1; r++) {
    let ok = true;
    for (let c = 0; c < keys.length; c++) {
      if (String(keyCols[c][r][0]) !== wanted[c]) {
        ok = false;
        break;
      }
    }
    if (ok) matchedRows.push(r + 2);
  }
  if (countOnly) return matchedRows.length;
  if (matchedRows.length === 0) return [];

  // รวมแถวที่ติดกันเป็นช่วง อ่านครั้งละช่วง (ถ้ากระจัดกระจายมากเกินไปจะอ่านทั้งก้อนครั้งเดียวแทน เพื่อไม่ให้เรียก API มากเกิน)
  const runs = [];
  let start = matchedRows[0];
  let prev = start;
  for (let i = 1; i < matchedRows.length; i++) {
    if (matchedRows[i] === prev + 1) {
      prev = matchedRows[i];
    } else {
      runs.push([start, prev]);
      start = matchedRows[i];
      prev = start;
    }
  }
  runs.push([start, prev]);

  const toObj = (row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  };

  if (runs.length > 60) {
    const first = matchedRows[0];
    const last = matchedRows[matchedRows.length - 1];
    const block = sheet.getRange(first, 1, last - first + 1, lastCol).getValues();
    const matchedSet = {};
    matchedRows.forEach((n) => (matchedSet[n] = true));
    const out = [];
    block.forEach((row, i) => {
      if (matchedSet[first + i] === true) out.push(toObj(row));
    });
    return out;
  }

  const out = [];
  runs.forEach((run) => {
    sheet
      .getRange(run[0], 1, run[1] - run[0] + 1, lastCol)
      .getValues()
      .forEach((row) => out.push(toObj(row)));
  });
  return out;
}

/**
 * อ่านเฉพาะ "คอลัมน์ที่ระบุ" ของชีต (เร็วกว่า getSheetData มากกับชีตใหญ่ เช่น StudentScores ที่ไม่ต้องใช้คอลัมน์ Score/วันที่)
 * คืนค่าเป็น array ของ object ที่มีเฉพาะคอลัมน์ที่ขอ (8 ต.ค. 2569)
 */
function getSheetColumnsData(sheetName, columnNames) {
  const sheet = SS.getSheetByName(sheetName);
  if (!sheet) throw new Error("ไม่พบ Sheet ชื่อ: " + sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const cols = columnNames.map((name) => {
    const idx = headers.indexOf(name);
    if (idx === -1) throw new Error("ไม่พบคอลัมน์ " + name + " ในชีต " + sheetName);
    return sheet.getRange(2, idx + 1, lastRow - 1, 1).getValues();
  });

  const out = [];
  for (let r = 0; r < lastRow - 1; r++) {
    const obj = {};
    let hasValue = false;
    for (let c = 0; c < columnNames.length; c++) {
      const v = cols[c][r][0];
      obj[columnNames[c]] = v;
      if (v !== "" && v !== null) hasValue = true;
    }
    if (hasValue) out.push(obj);
  }
  return out;
}

/**
 * เหมือน getSheetData() แต่แคชผลลัพธ์ไว้ใน CacheService ตามเวลาที่กำหนด (วินาที)
 * ใช้กับตารางที่ถูกอ่านซ้ำบ่อยมากในทุก request (เช่น TeachingAssignments, Students, GradeComponents)
 * แต่เปลี่ยนแปลงไม่บ่อย เพื่อลดจำนวนครั้งที่ต้องอ่านทั้งชีตจริง (ตามข้อ 5 ของกฎการเขียนโค้ด เน้นความเร็ว)
 * ฟังก์ชันที่เขียนข้อมูลลงตารางเหล่านี้ต้องเรียก invalidateSheetCache(sheetName) ทันทีหลังเขียนเสมอ
 * ไม่เช่นนั้นข้อมูลที่อ่านได้อาจไม่ใช่ข้อมูลล่าสุดจนกว่าแคชจะหมดอายุ
 */
function getCachedSheetData(sheetName, ttlSeconds) {
  const cache = CacheService.getScriptCache();
  const key = "sheetcache_" + sheetName;
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      // แคชเสีย ข้ามไปอ่านจากชีตจริงแทน
    }
  }

  const data = getSheetData(sheetName);
  try {
    cache.put(key, JSON.stringify(data), ttlSeconds);
  } catch (err) {
    // ข้อมูลอาจใหญ่เกิน 100KB ต่อ cache key ข้ามการแคชได้ ไม่กระทบการทำงานหลัก
  }
  return data;
}

function invalidateSheetCache(sheetName) {
  CacheService.getScriptCache().remove("sheetcache_" + sheetName);
}

/**
 * ===== สถานะนักเรียน (6 ต.ค. 2569) =====
 * นักเรียนที่ Students.Status ไม่ใช่ "กำลังศึกษา" (เช่น ย้าย, จบการศึกษา, ลาออก) จะ:
 *  1) ถูกล็อกการบันทึกผลทุกชนิด (คะแนนรายวิชา, ผลกิจกรรมพัฒนาผู้เรียน, ปถ.12) — ไม่แสดงในหน้ากรอกและฝั่ง Server ปฏิเสธถ้ายิง request ตรงเข้ามา
 *  2) ไม่ถูกนับเป็นจำนวนนักเรียน (การ์ดสรุป, สถิติ, ความคืบหน้า, จำนวนนักเรียนในห้อง ฯลฯ)
 * ข้อมูลที่เคยบันทึกไว้แล้วไม่ถูกลบ และเอกสารทางการศึกษา (ปถ.06 ฯลฯ) ยังออกให้นักเรียนเหล่านี้ได้ตามเดิม
 * หน้าจัดนักเรียนเข้าห้อง (นายทะเบียน) ยังเห็นนักเรียนทุกสถานะ เพื่อให้จัดการได้
 */
const STUDENT_ACTIVE_STATUS = "กำลังศึกษา";

function isActiveStudentRow(student) {
  return !!student && String(student.Status === undefined || student.Status === null ? "" : student.Status).trim() === STUDENT_ACTIVE_STATUS;
}

// ชุดรหัสนักเรียนที่ "กำลังศึกษา" (อ่านจาก Students ที่แคชไว้ 120 วินาที — handleUpdateStudent ล้างแคชทันทีเมื่อเปลี่ยนสถานะ)
function getActiveStudentIdSet() {
  const set = {};
  getCachedSheetData("Students", 120).forEach((st) => {
    if (isActiveStudentRow(st)) set[String(st.StudentID)] = true;
  });
  return set;
}

/**
 * ชุด "ช่องเก็บคะแนนที่ยังมีอยู่จริง" ในรูป key "ComponentID|SubComponentID" (หน่วย) และ "ComponentID|" (ปลายภาค)
 * ใช้นับความครบของคะแนนโดยไม่นับคะแนนที่ค้างอยู่ของช่องที่ถูกลบไปแล้ว (7 ต.ค. 2569)
 */
function getValidScoreCellSet() {
  const valid = {};
  getCachedSheetData("GradeComponents", 120).forEach((c) => {
    if (c.ComponentType === "ปลายภาค") valid[String(c.ComponentID) + "|"] = true;
  });
  getCachedSheetData("GradeSubComponents", 60).forEach((sc) => {
    valid[String(sc.ComponentID) + "|" + String(sc.SubComponentID)] = true;
  });
  return valid;
}

// รายการจัดเข้าห้อง เฉพาะนักเรียนที่ "กำลังศึกษา" (ใช้กับการนับ/การบันทึกผลทุกจุด)
function getActiveEnrollments() {
  const active = getActiveStudentIdSet();
  return getCachedSheetData("StudentEnrollments", 60).filter((e) => active[String(e.StudentID)] === true);
}

/**
 * ===== Session / Authentication =====
 * ตรวจสอบ token ที่ส่งมากับทุก request (ยกเว้น login) เทียบกับ Sheet "Sessions"
 * แคชผลไว้ใน CacheService 5 นาที เพื่อลดการอ่านชีตซ้ำในทุกคำขอ (เน้นความเร็วตามข้อ 5 ของกฎการเขียนโค้ด)
 */
function verifySession(token) {
  if (!token) return { valid: false };

  const cache = CacheService.getScriptCache();
  const cacheKey = "session_" + token;
  const cachedUserId = cache.get(cacheKey);
  if (cachedUserId) {
    return { valid: true, userId: cachedUserId };
  }

  const sessions = getSheetData("Sessions");
  const session = sessions.find((s) => String(s.SessionToken) === String(token));

  if (!session) return { valid: false };

  const expiresAt = new Date(session.ExpiresAt).getTime();
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    const rowIndex = findRowIndexByColumnValue("Sessions", "SessionToken", token);
    if (rowIndex !== -1) SS.getSheetByName("Sessions").deleteRow(rowIndex);
    return { valid: false };
  }

  cache.put(cacheKey, String(session.UserID), 300);
  return { valid: true, userId: session.UserID };
}

/**
 * สร้าง session ใหม่หลัง login สำเร็จ (token แบบสุ่มไม่ซ้ำ, อายุ SESSION_DURATION_MS)
 */
function createSession(userId) {
  const token = Utilities.getUuid();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  SS.getSheetByName("Sessions").appendRow([token, userId, now.toISOString(), expiresAt.toISOString()]);

  return token;
}

/**
 * ออกจากระบบ: ลบ session ทิ้งทั้งจาก Cache และ Sheet ทันที (ป้องกัน token เดิมถูกใช้ซ้ำ)
 */
function handleLogout(body) {
  const token = body.token;
  if (token) {
    CacheService.getScriptCache().remove("session_" + token);
    const rowIndex = findRowIndexByColumnValue("Sessions", "SessionToken", token);
    if (rowIndex !== -1) SS.getSheetByName("Sessions").deleteRow(rowIndex);
  }
  return { status: "success" };
}

/**
 * ตรวจสอบว่าผู้ใช้งาน (userId) มีบทบาทใดบทบาทหนึ่งในรายการ roleTypes หรือไม่
 * แคชรายการบทบาทของผู้ใช้แต่ละคนไว้ 5 นาที ลดการอ่านชีต UserRoles ซ้ำในทุกคำขอ
 */
function hasAnyRole(userId, roleTypes) {
  if (!userId) return false;

  const cache = CacheService.getScriptCache();
  const cacheKey = "roles_" + userId;
  let roles;

  const cached = cache.get(cacheKey);
  if (cached) {
    roles = JSON.parse(cached);
  } else {
    roles = getSheetData("UserRoles")
      .filter((r) => String(r.UserID) === String(userId))
      .map((r) => r.RoleType);
    cache.put(cacheKey, JSON.stringify(roles), 300);
  }

  return roleTypes.some((rt) => roles.indexOf(rt) !== -1);
}

/**
 * ตรวจสอบว่าผู้ใช้งาน (userId) ได้รับมอบหมายให้สอนวิชา (subjectId) ในปีการศึกษา (academicYearId) นี้จริงหรือไม่
 * ถ้าระบุ classId มาด้วย จะเช็คเฉพาะห้องนั้นด้วย (ใช้ป้องกันการเข้าถึง/แก้ไขคะแนนข้ามวิชา-ข้ามห้องที่ไม่ได้สอน)
 */
function isAssignedToTeach(userId, subjectId, academicYearId, classId) {
  if (!userId || !subjectId || !academicYearId) return false;

  // แคชไว้ 2 นาที เพราะฟังก์ชันนี้ถูกเรียกแทบทุก request ของครูประจำวิชา (บางหน้าเรียกซ้ำหลายครั้งในคำขอเดียว)
  const assignments = getCachedSheetData("TeachingAssignments", 120);
  return assignments.some(
    (a) =>
      String(a.TeacherUserID) === String(userId) &&
      String(a.SubjectID) === String(subjectId) &&
      String(a.AcademicYearID) === String(academicYearId) &&
      (classId === undefined || classId === null || classId === "" || String(a.ClassID) === String(classId))
  );
}

/**
 * ตรวจสอบ Username / Password จาก Sheet "Users"
 * และดึงบทบาททั้งหมดของผู้ใช้จาก Sheet "UserRoles"
 * เมื่อสำเร็จจะสร้าง session token ใหม่คืนไปให้ฝั่งเว็บเก็บไว้แนบมากับทุก request ถัดไป
 */
function handleLogin(username, password) {
  if (!username || !password) {
    return { status: "error", message: "กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน" };
  }

  const users = getSheetData("Users");
  const user = users.find((u) => String(u.Username).trim() === String(username).trim());

  if (!user) {
    return { status: "error", message: "ไม่พบชื่อผู้ใช้งานนี้ในระบบ" };
  }

  // TODO: ปัจจุบันเทียบรหัสผ่านแบบข้อความธรรมดา (Plain Text) ตามข้อมูลตัวอย่างในฐานข้อมูล
  // ควรเปลี่ยนไปเทียบค่า Hash แทนก่อนใช้งานจริง เพื่อความปลอดภัย
  if (String(user.Password).trim() !== String(password).trim()) {
    return { status: "error", message: "รหัสผ่านไม่ถูกต้อง" };
  }

  if (String(user.Status).trim() !== "Active") {
    return { status: "error", message: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const allRoles = getSheetData("UserRoles");
  const userRoles = allRoles
    .filter((r) => String(r.UserID).trim() === String(user.UserID).trim())
    .map((r) => ({
      roleType: r.RoleType,
      isDefaultLanding: r.IsDefaultLanding === true || String(r.IsDefaultLanding).toUpperCase() === "TRUE",
    }));

  if (userRoles.length === 0) {
    return { status: "error", message: "บัญชีนี้ยังไม่ได้กำหนดสิทธิ์การใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const token = createSession(user.UserID);

  // ระดับชั้นที่ครูประจำชั้นดูแล (KINDERGARTEN / PRIMARY / MIXED / "" = ไม่ได้ดูแลห้องใด) ใช้ให้ฝั่งหน้าเว็บเลือกชุดเมนูด้านข้างของครูประจำชั้น
  let homeroomLevel = "";
  if (userRoles.some((r) => r.roleType === "HOMEROOM_TEACHER")) {
    try {
      homeroomLevel = getHomeroomLevelForUser(user.UserID);
    } catch (err) {
      homeroomLevel = "";
    }
  }

  return {
    status: "success",
    data: {
      token: token,
      userId: user.UserID,
      username: user.Username,
      fullName: user.FullName,
      position: user.Position,
      profileImageUrl: user.ProfileImageURL,
      roles: userRoles,
      homeroomLevel: homeroomLevel,
    },
  };
}

/**
 * ดึงรายการปีการศึกษาทั้งหมด เรียงปีล่าสุดขึ้นก่อน
 */
function handleGetAcademicYears() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("academicYears");
  if (cached) {
    return { status: "success", data: JSON.parse(cached) };
  }

  const years = getSheetData("AcademicYears");
  years.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));

  cache.put("academicYears", JSON.stringify(years), 300); // แคชไว้ 5 นาที
  return { status: "success", data: years };
}

/**
 * ตั้งค่าปีการศึกษาที่ระบุให้เป็นปีปัจจุบัน (IsCurrent = TRUE)
 * และปรับปีอื่นทั้งหมดเป็น FALSE โดยอัตโนมัติ
 */
function handleSetCurrentAcademicYear(academicYearId) {
  if (!academicYearId) {
    return { status: "error", message: "ไม่พบปีการศึกษาที่ระบุ" };
  }

  const sheet = SS.getSheetByName("AcademicYears");
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf("AcademicYearID");
  const currentCol = headers.indexOf("IsCurrent");

  if (idCol === -1 || currentCol === -1) {
    return { status: "error", message: "โครงสร้าง Sheet AcademicYears ไม่ถูกต้อง" };
  }

  let found = false;
  const updated = values.slice(1).map((row) => {
    const isMatch = String(row[idCol]).trim() === String(academicYearId).trim();
    if (isMatch) found = true;
    row[currentCol] = isMatch;
    return row;
  });

  if (!found) {
    return { status: "error", message: "ไม่พบปีการศึกษานี้ในระบบ" };
  }

  sheet.getRange(2, 1, updated.length, headers.length).setValues(updated);

  CacheService.getScriptCache().remove("academicYears");

  return { status: "success", message: "ตั้งค่าปีการศึกษาปัจจุบันเรียบร้อยแล้ว" };
}

/**
 * เพิ่มปีการศึกษาใหม่เข้าสู่ระบบ
 */
function handleAddAcademicYear(body) {
  const year = body.year;
  const startDate = body.startDate;
  const endDate = body.endDate;

  if (!year || !startDate || !endDate) {
    return { status: "error", message: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  const sheet = SS.getSheetByName("AcademicYears");
  const existing = getSheetData("AcademicYears");

  if (existing.some((y) => String(y.Year).trim() === String(year).trim())) {
    return { status: "error", message: "มีปีการศึกษานี้อยู่ในระบบแล้ว" };
  }

  sheet.appendRow([String(year), Number(year), false, startDate, endDate]);

  CacheService.getScriptCache().remove("academicYears");

  return { status: "success", message: "เพิ่มปีการศึกษาเรียบร้อยแล้ว" };
}


/**
 * หา Row Index (นับรวม Header, เริ่มที่ 1) ของแถวที่ตรงกับค่าที่ระบุในคอลัมน์ที่กำหนด
 * คืนค่า -1 ถ้าไม่พบ
 */
function findRowIndexByColumnValue(sheetName, columnName, value) {
  const sheet = SS.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const col = headers.indexOf(columnName);
  if (col === -1) return -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][col]).trim() === String(value).trim()) {
      return i + 1; // +1 เพราะ Sheet Row เริ่มที่ 1 และ values[0] คือ Header
    }
  }
  return -1;
}

/**
 * ดึงรายการรายวิชาทั้งหมด
 */
function handleGetSubjects() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("subjects");
  if (cached) {
    return { status: "success", data: JSON.parse(cached) };
  }

  const subjects = getSheetData("Subjects");
  cache.put("subjects", JSON.stringify(subjects), 300);
  return { status: "success", data: subjects };
}

/**
 * เพิ่มรายวิชาใหม่
 */
function handleAddSubject(body) {
  const required = ["subjectId", "subjectName", "subjectType", "evaluationType", "gradeLevel"];
  for (const field of required) {
    if (!body[field]) {
      return { status: "error", message: "กรุณากรอกข้อมูลให้ครบถ้วน" };
    }
  }

  if (findRowIndexByColumnValue("Subjects", "SubjectID", body.subjectId) !== -1) {
    return { status: "error", message: "มีรหัสวิชานี้อยู่ในระบบแล้ว" };
  }

  const sheet = SS.getSheetByName("Subjects");
  sheet.appendRow([
    body.subjectId,
    body.subjectName,
    body.subjectType,
    body.evaluationType,
    body.subjectGroup || "",
    body.subjectSubGroup || "",
    Number(body.credit) || 0,
    Number(body.hours) || 0,
    body.gradeLevel,
  ]);

  CacheService.getScriptCache().remove("subjects");
  return { status: "success", message: "เพิ่มรายวิชาเรียบร้อยแล้ว" };
  }

/**
 * เพิ่มรายวิชาหลายรายการพร้อมกัน (นำเข้าจากไฟล์เทมเพลต)
 * body.subjects = array ของ { subjectId, subjectName, subjectType, subjectGroup, subjectSubGroup, credit, gradeLevel }
 * - evaluationType คำนวณอัตโนมัติจาก subjectType (เหมือนฝั่งฟอร์มเพิ่มทีละรายการ)
 * - hours คำนวณอัตโนมัติจาก credit x 40
 * - แถวที่ข้อมูลไม่ครบ/ไม่ถูกต้อง/ซ้ำ จะถูกข้ามไปและแจ้งเหตุผลกลับไป โดยไม่ทำให้แถวอื่นที่ถูกต้องล้มเหลวไปด้วย
 */
function handleAddSubjectsBulk(body) {
  const inputRows = body.subjects;
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    return { status: "error", message: "ไม่พบข้อมูลรายวิชาที่จะนำเข้า" };
  }

  const VALID_SUBJECT_TYPES = ["พื้นฐาน", "เพิ่มเติม", "กิจกรรมพัฒนาผู้เรียน"];
  const VALID_GRADE_LEVELS = ["อนุบาล 1", "อนุบาล 2", "อนุบาล 3", "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"];

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const existingSubjects = getSheetData("Subjects");
    const existingIds = {};
    existingSubjects.forEach((s) => (existingIds[String(s.SubjectID).trim()] = true));

    const newRows = [];
    const skipped = [];
    const seenInFile = {};

    inputRows.forEach((row, i) => {
      const rowNum = i + 2; // อ้างอิงเลขแถวในไฟล์ (แถว 1 คือหัวตาราง)
      const subjectId = String(row.subjectId || "").trim();
      const subjectName = String(row.subjectName || "").trim();
      const subjectType = String(row.subjectType || "").trim();
      const subjectGroup = String(row.subjectGroup || "").trim();
      const subjectSubGroup = String(row.subjectSubGroup || "").trim();
      const gradeLevel = String(row.gradeLevel || "").trim();
      const credit = Number(row.credit) || 0;

      if (!subjectId || !subjectName || !subjectType || !gradeLevel) {
        skipped.push(`แถว ${rowNum} (${subjectId || "ไม่ระบุรหัส"}): ข้อมูลไม่ครบถ้วน`);
        return;
      }
      if (VALID_SUBJECT_TYPES.indexOf(subjectType) === -1) {
        skipped.push(`แถว ${rowNum} (${subjectId}): ประเภทวิชาไม่ถูกต้อง`);
        return;
      }
      if (VALID_GRADE_LEVELS.indexOf(gradeLevel) === -1) {
        skipped.push(`แถว ${rowNum} (${subjectId}): ระดับชั้นไม่ถูกต้อง`);
        return;
      }
      if (existingIds[subjectId]) {
        skipped.push(`แถว ${rowNum} (${subjectId}): มีรหัสวิชานี้อยู่ในระบบแล้ว`);
        return;
      }
      if (seenInFile[subjectId]) {
        skipped.push(`แถว ${rowNum} (${subjectId}): รหัสวิชาซ้ำกันในไฟล์`);
        return;
      }

      const evaluationType = subjectType === "กิจกรรมพัฒนาผู้เรียน" ? "ผ่าน-ไม่ผ่าน (ผ/มผ)" : "ระดับคะแนน (0-4)";
      const hours = credit * 40;

      newRows.push([subjectId, subjectName, subjectType, evaluationType, subjectGroup, subjectSubGroup, credit, hours, gradeLevel]);
      seenInFile[subjectId] = true;
    });

    if (newRows.length > 0) {
      const sheet = SS.getSheetByName("Subjects");
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, newRows.length, 9).setValues(newRows);
      CacheService.getScriptCache().remove("subjects");
    }

    const message =
      newRows.length > 0
        ? `นำเข้าสำเร็จ ${newRows.length} รายวิชา` + (skipped.length > 0 ? ` (ข้าม ${skipped.length} รายการ: ${skipped.join(", ")})` : "")
        : `ไม่สามารถนำเข้ารายวิชาใดได้เลย: ${skipped.join(", ")}`;

    return {
      status: newRows.length > 0 ? "success" : "error",
      message: message,
      data: { addedCount: newRows.length, skipped: skipped },
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * แก้ไขข้อมูลรายวิชา (ยึด SubjectID เดิม ไม่ให้แก้ไข)
 */
function handleUpdateSubject(body) {
  if (!body.subjectId) {
    return { status: "error", message: "ไม่พบรหัสวิชาที่ต้องการแก้ไข" };
  }

  const rowIndex = findRowIndexByColumnValue("Subjects", "SubjectID", body.subjectId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบรายวิชานี้ในระบบ" };
  }

  const sheet = SS.getSheetByName("Subjects");
  sheet.getRange(rowIndex, 1, 1, 9).setValues([[
    body.subjectId,
    body.subjectName,
    body.subjectType,
    body.evaluationType,
    body.subjectGroup || "",
    body.subjectSubGroup || "",
    Number(body.credit) || 0,
    Number(body.hours) || 0,
    body.gradeLevel,
  ]]);

  CacheService.getScriptCache().remove("subjects");
  return { status: "success", message: "แก้ไขรายวิชาเรียบร้อยแล้ว" };
  }

/**
 * ลบรายวิชา
 */
function handleDeleteSubject(body) {
  const subjectId = typeof body === "object" ? body.subjectId : body;
  const force = typeof body === "object" && !!body.force;

  if (!subjectId) {
    return { status: "error", message: "ไม่พบรหัสวิชาที่ต้องการลบ" };
  }

  const rowIndex = findRowIndexByColumnValue("Subjects", "SubjectID", subjectId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบรายวิชานี้ในระบบ" };
  }

  if (!force) {
    const assignmentCount = getSheetData("TeachingAssignments").filter((a) => String(a.SubjectID) === String(subjectId)).length;
    const componentCount = getSheetData("GradeComponents").filter((c) => String(c.SubjectID) === String(subjectId)).length;
    const scoreCount = getStudentScoresWhere({ SubjectID: subjectId }, true);
    const finalResultCount = getSheetData("FinalResults").filter((r) => String(r.SubjectID) === String(subjectId)).length;

    if (assignmentCount > 0 || componentCount > 0 || scoreCount > 0 || finalResultCount > 0) {
      const parts = [];
      if (assignmentCount > 0) parts.push(`การมอบหมายการสอน ${assignmentCount} รายการ`);
      if (componentCount > 0) parts.push(`โครงสร้างคะแนน ${componentCount} รายการ`);
      if (scoreCount > 0) parts.push(`คะแนนที่กรอกไว้แล้ว ${scoreCount} รายการ`);
      if (finalResultCount > 0) parts.push(`ผลการเรียนที่ตัดสินแล้ว ${finalResultCount} รายการ`);

      return {
        status: "confirm_required",
        message: `รายวิชานี้มี${parts.join(", ")} ผูกอยู่ หากลบวิชานี้ ข้อมูลดังกล่าวจะไม่ถูกลบไปด้วย แต่จะกลายเป็นข้อมูลที่ไม่มีรายวิชาอ้างอิงอยู่ ต้องการดำเนินการลบต่อหรือไม่`,
      };
    }
  }

  SS.getSheetByName("Subjects").deleteRow(rowIndex);

  CacheService.getScriptCache().remove("subjects");
  return { status: "success", message: "ลบรายวิชาเรียบร้อยแล้ว" };
  }





/**
 * ดึงรายชื่อนักเรียนทั้งหมด
 */
function handleGetStudents() {
  const students = getSheetData("Students");
  return { status: "success", data: students };
}

/**
 * เพิ่มนักเรียนใหม่
 */
function handleAddStudent(body) {
  const required = ["studentId", "prefixName", "firstName", "lastName", "gender", "status"];
  for (const field of required) {
    if (!body[field]) {
      return { status: "error", message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" };
    }
  }

  if (findRowIndexByColumnValue("Students", "StudentID", body.studentId) !== -1) {
    return { status: "error", message: "มีเลขประจำตัวนักเรียนนี้อยู่ในระบบแล้ว" };
  }

   const sheet = SS.getSheetByName("Students");
  sheet.appendRow([
    body.studentId,
    body.citizenId || "",
    body.prefixName,
    body.firstName,
    body.lastName,
    body.gender,
    body.birthDate || "",
    body.religion || "",
    body.fatherName || "",
    body.motherName || "",
    body.previousSchool || "",
    body.previousSchoolProvince || "",
    body.lastGradeLevel || "",
    body.photoUrl || "",
    body.status,
    body.admissionDate || "",
  ]);

  invalidateSheetCache("Students");
  return { status: "success", message: "เพิ่มนักเรียนเรียบร้อยแล้ว" };
}

/**
 * แก้ไขข้อมูลนักเรียน (ยึด StudentID เดิม ไม่ให้แก้ไข)
 */
function handleUpdateStudent(body) {
  if (!body.studentId) {
    return { status: "error", message: "ไม่พบเลขประจำตัวนักเรียนที่ต้องการแก้ไข" };
  }

  const rowIndex = findRowIndexByColumnValue("Students", "StudentID", body.studentId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบนักเรียนคนนี้ในระบบ" };
  }

  const sheet = SS.getSheetByName("Students");
  sheet.getRange(rowIndex, 1, 1, 16).setValues([[
    body.studentId,
    body.citizenId || "",
    body.prefixName,
    body.firstName,
    body.lastName,
    body.gender,
    body.birthDate || "",
    body.religion || "",
    body.fatherName || "",
    body.motherName || "",
    body.previousSchool || "",
    body.previousSchoolProvince || "",
    body.lastGradeLevel || "",
    body.photoUrl || "",
    body.status,
    body.admissionDate || "",
  ]]);

  invalidateSheetCache("Students");
  // สถานะนักเรียนมีผลต่อจำนวนนักเรียนในห้องที่หน้าจัดการห้องเรียนแสดง (แคช classesPageData) ต้องล้างด้วยทันที
  CacheService.getScriptCache().remove("classesPageData");
  return { status: "success", message: "แก้ไขข้อมูลนักเรียนเรียบร้อยแล้ว" };
}

/**
 * ลบนักเรียน
 */
function handleDeleteStudent(body) {
  const studentId = typeof body === "object" ? body.studentId : body;
  const force = typeof body === "object" && !!body.force;

  if (!studentId) {
    return { status: "error", message: "ไม่พบเลขประจำตัวนักเรียนที่ต้องการลบ" };
  }

  const rowIndex = findRowIndexByColumnValue("Students", "StudentID", studentId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบนักเรียนคนนี้ในระบบ" };
  }

  if (!force) {
    const enrollmentCount = getSheetData("StudentEnrollments").filter((e) => String(e.StudentID) === String(studentId)).length;
    const scoreCount = getStudentScoresWhere({ StudentID: studentId }, true);
    const finalResultCount = getSheetData("FinalResults").filter((r) => String(r.StudentID) === String(studentId)).length;

    if (enrollmentCount > 0 || scoreCount > 0 || finalResultCount > 0) {
      const parts = [];
      if (enrollmentCount > 0) parts.push(`ประวัติการลงทะเบียนเรียน ${enrollmentCount} รายการ`);
      if (scoreCount > 0) parts.push(`คะแนนที่กรอกไว้แล้ว ${scoreCount} รายการ`);
      if (finalResultCount > 0) parts.push(`ผลการเรียนที่ตัดสินแล้ว ${finalResultCount} รายการ`);

      return {
        status: "confirm_required",
        message: `นักเรียนคนนี้มี${parts.join(", ")} ผูกอยู่ในระบบ หากลบนักเรียนคนนี้ ข้อมูลดังกล่าวจะไม่ถูกลบไปด้วย แต่จะกลายเป็นข้อมูลที่ไม่มีนักเรียนอ้างอิงอยู่ ต้องการดำเนินการลบต่อหรือไม่`,
      };
    }
  }

  SS.getSheetByName("Students").deleteRow(rowIndex);

  invalidateSheetCache("Students");
  return { status: "success", message: "ลบนักเรียนเรียบร้อยแล้ว" };
}





/**
 * ดึงรายชื่อผู้ใช้งานทั้งหมด (ไม่ส่ง Password ออกมา) สำหรับใช้เลือกในฟอร์มต่าง ๆ
 */
function handleGetUsers() {
  const users = getSheetData("Users");
  const sanitized = users.map((u) => ({
    userId: u.UserID,
    fullName: u.FullName,
    position: u.Position,
  }));
  return { status: "success", data: sanitized };
}


function handleGetHomeroomTeachers() {
  const users = getSheetData("Users");
  const userRoles = getSheetData("UserRoles");

  const homeroomUserIds = userRoles
    .filter((r) => r.RoleType === "HOMEROOM_TEACHER")
    .map((r) => r.UserID);

  const homeroomTeachers = users
    .filter((u) => homeroomUserIds.indexOf(u.UserID) !== -1)
    .map((u) => ({ userId: u.UserID, fullName: u.FullName, position: u.Position }));

  return { status: "success", data: homeroomTeachers };
}

/**
 * สถานะการส่งคะแนนของ 1 รายวิชา แยกตามห้องที่ครูประจำชั้นดูแล (ใช้แสดงที่หน้าแรกครูประจำชั้น)
 * คืน [{ classId, label, teachers, sem1, sem2 }] โดย sem1/sem2 = true เมื่อส่งผลการเรียนภาคเรียนนั้นแล้ว
 */
function buildHomeroomSubjectClassStatus(subjectId, assignmentsInMyClasses, myClasses, academicYearId) {
  const users = getCachedSheetData("Users", 300);
  const nameById = {};
  users.forEach((u) => (nameById[String(u.UserID)] = u.FullName));
  const result = [];
  myClasses.forEach((c) => {
    const mine = assignmentsInMyClasses.filter(
      (a) => String(a.SubjectID) === String(subjectId) && String(a.ClassID) === String(c.ClassID)
    );
    if (mine.length === 0) return;
    const teachers = Array.from(new Set(mine.map((a) => nameById[String(a.TeacherUserID)] || "").filter(Boolean)));
    result.push({
      classId: c.ClassID,
      label: c.GradeLevel + "/" + c.RoomNumber,
      teachers: teachers.join(", "),
      sem1: isSemesterSubmitted(subjectId, academicYearId, c.ClassID, 1),
      sem2: isSemesterSubmitted(subjectId, academicYearId, c.ClassID, 2),
    });
  });
  return result;
}

function handleGetDashboardData(body) {
  const role = body.role;
  const userId = body.userId;

  // role มาจากฝั่งหน้าเว็บ จึงต้องตรวจซ้ำว่าผู้ใช้คนนี้มีบทบาทนี้จริง ไม่เช่นนั้นจะขอข้อมูลสรุปของบทบาทอื่นได้ (8 ต.ค. 2569)
  if (!role || !hasAnyRole(userId, [role])) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ดูข้อมูลของบทบาทนี้" };
  }

  if (role === "SUBJECT_TEACHER") {
    const dashboardCacheKey = "dashboard_SUBJECT_TEACHER_" + userId;
    const dashboardCache = CacheService.getScriptCache();
    const cachedDashboard = dashboardCache.get(dashboardCacheKey);
    if (cachedDashboard) {
      try {
        return { status: "success", data: JSON.parse(cachedDashboard) };
      } catch (err) {
        // แคชเสีย ข้ามไปคำนวณใหม่แทน
      }
    }

    const academicYears = handleGetAcademicYears().data;
    // ถ้าไม่มีปีใดถูกตั้งค่าเป็นปีปัจจุบัน (IsCurrent) ให้ fallback ไปใช้ปีล่าสุด (index 0)
    // เพราะ handleGetAcademicYears() เรียงข้อมูลจากปีมากไปน้อยไว้แล้ว
    const currentYear = academicYears.find(
      (y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE"
    ) || academicYears[0];
    const currentYearId = currentYear ? currentYear.AcademicYearID : null;

    const myAssignments = getCachedSheetData("TeachingAssignments", 120).filter(
      (a) => String(a.TeacherUserID) === String(userId) && String(a.AcademicYearID) === String(currentYearId)
    );

    const classes = getCachedSheetData("Classes", 60);
    const subjects = handleGetSubjects().data;
    const allComponents = getCachedSheetData("GradeComponents", 120);
    const allSubComponents = getCachedSheetData("GradeSubComponents", 60);
    const allEnrollments = getActiveEnrollments();
    // คะแนนและสถานะส่งผลการเรียนต้องอ่านสดเสมอ เพื่อให้ % ความคืบหน้าและสถานะส่งผลตรงกับความเป็นจริงเสมอ
    const allScores = getSheetColumnsData("StudentScores", ["ClassID", "ComponentID", "SubComponentID", "StudentID"]);
    const allSemesterSubmissions = getSheetData("SemesterSubmissions");
    const validCellsDash = getValidScoreCellSet();
    const activeIdsDash = getActiveStudentIdSet();

    const progress = myAssignments.map((a) => {
      const cls = classes.find((c) => String(c.ClassID) === String(a.ClassID));
      const subj = subjects.find((s) => String(s.SubjectID) === String(a.SubjectID));
      const studentCount = allEnrollments.filter((e) => String(e.ClassID) === String(a.ClassID)).length;

      // คำนวณ % ความคืบหน้าแยกเป็นรายหน่วย/คะแนนสอบ ของแต่ละภาคเรียน (ไม่รวมเป็นก้อนเดียวเหมือนเดิม)
      const semesterComponents = (semester) => {
        const comps = allComponents
          .filter(
            (c) =>
              String(c.SubjectID) === String(a.SubjectID) &&
              String(c.AcademicYearID) === String(a.AcademicYearID) &&
              Number(c.Semester) === semester
          )
          .sort((x, y) => {
            if (x.ComponentType !== y.ComponentType) return x.ComponentType === "หน่วย" ? -1 : 1;
            return Number(x.ComponentOrder || 0) - Number(y.ComponentOrder || 0);
          });

        return comps.map((c) => {
          const isFinalExam = c.ComponentType === "ปลายภาค";
          const subCount = isFinalExam
            ? 0
            : allSubComponents.filter((sc) => String(sc.ComponentID) === String(c.ComponentID)).length;
          const required = isFinalExam ? studentCount : studentCount * subCount;

          // นับเฉพาะคะแนนของช่องที่ยังมีอยู่จริง และของนักเรียนที่ "กำลังศึกษา" (ให้สอดคล้องกับจำนวนที่ต้องกรอก)
          const filled = allScores.filter(
            (s) =>
              String(s.ClassID) === String(a.ClassID) &&
              String(s.ComponentID) === String(c.ComponentID) &&
              validCellsDash[String(s.ComponentID) + "|" + (s.SubComponentID || "")] === true &&
              activeIdsDash[String(s.StudentID)] === true
          ).length;

          const percent = required === 0 ? 0 : Math.min(100, Math.round((filled / required) * 100));

          return {
            componentId: c.ComponentID,
            componentName: c.ComponentName,
            componentType: c.ComponentType,
            percent: percent,
          };
        });
      };

      const isSemesterSubmittedLocal = (semester) =>
        allSemesterSubmissions.some(
          (r) =>
            String(r.SubjectID) === String(a.SubjectID) &&
            String(r.AcademicYearID) === String(a.AcademicYearID) &&
            String(r.ClassID) === String(a.ClassID) &&
            String(r.Semester) === String(semester)
        );

      return {
        subjectId: a.SubjectID,
        label:
          (subj ? a.SubjectID + " " + subj.SubjectName : a.SubjectID) +
          " - " +
          (cls ? cls.GradeLevel + "/" + cls.RoomNumber : a.ClassID),
        semester1Components: semesterComponents(1),
        semester2Components: semesterComponents(2),
        isSubmittedSem1: isSemesterSubmittedLocal(1),
        isSubmittedSem2: isSemesterSubmittedLocal(2),
      };
    });

    // การ์ดสรุป: รายวิชาที่สอน แสดง "รหัสวิชา ชื่อรายวิชา" พร้อมห้องที่สอนทุกห้อง (จัดกลุ่มตามรายวิชา ไม่แสดงเป็นตัวเลขเฉยๆ)
    // จัดกลุ่มด้วย SubjectID (ไม่ใช่ชื่อวิชา) เพื่อกันปัญหาชื่อวิชาซ้ำกันคนละรหัสถูกรวมเป็นแถวเดียวกัน — 26 ก.ย. 2569
    const subjectClassMap = {};
    myAssignments.forEach((a) => {
      const subj = subjects.find((s) => String(s.SubjectID) === String(a.SubjectID));
      const cls = classes.find((c) => String(c.ClassID) === String(a.ClassID));
      const subjectId = a.SubjectID;
      const subjectLabel = subj ? subjectId + " " + subj.SubjectName : subjectId;
      const classLabel = cls ? cls.GradeLevel + "/" + cls.RoomNumber : a.ClassID;
      if (!subjectClassMap[subjectId]) subjectClassMap[subjectId] = { name: subjectLabel, classes: [] };
      if (subjectClassMap[subjectId].classes.indexOf(classLabel) === -1) {
        subjectClassMap[subjectId].classes.push(classLabel);
      }
    });
    const subjectList = Object.keys(subjectClassMap).map((id) => subjectClassMap[id]);
    // ห้องที่สอน = นับห้องไม่ซ้ำ รวมทุกวิชา
    const distinctClassCount = new Set(myAssignments.map((a) => String(a.ClassID))).size;
    // นักเรียนที่สอน = รวมจำนวนนักเรียนที่ลงทะเบียนของทุกวิชา/ทุกห้องที่สอน (นับซ้ำได้ถ้าสอนหลายวิชาในห้องเดียวกัน)
    const totalStudents = myAssignments.reduce(
      (sum, a) => sum + allEnrollments.filter((e) => String(e.ClassID) === String(a.ClassID)).length,
      0
    );

    const dashboardResult = {
      cards: [
        { icon: "fa-book-open", label: "รายวิชาที่สอน", value: "ยังไม่มีรายวิชาที่สอน", subjectList: subjectList },
        { icon: "fa-chalkboard", label: "ห้องที่สอน", value: distinctClassCount + " ห้อง" },
        { icon: "fa-user-graduate", label: "นักเรียนที่สอน", value: totalStudents + " คน" },
      ],
      progress: progress,
      quickActions: [],
    };

    try {
      dashboardCache.put(dashboardCacheKey, JSON.stringify(dashboardResult), 60); // แคช Dashboard 60 วินาที ให้โหลดครั้งถัดไปเร็วขึ้น
    } catch (err) {
      // ข้อมูลใหญ่เกินไปสำหรับแคช ข้ามไปได้ ไม่กระทบการทำงาน
    }

    return {
      status: "success",
      data: dashboardResult,
    };
  }

  if (role === "HOMEROOM_TEACHER") {
    const academicYears = getSheetData("AcademicYears");
    academicYears.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));
    // ถ้าไม่มีปีใดถูกตั้งค่าเป็นปีปัจจุบัน (IsCurrent) ให้ fallback ไปใช้ปีล่าสุดแทน (เดิมไม่มี fallback ทำให้นับเป็น 0 ได้)
    const currentYear = academicYears.find(
      (y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE"
    ) || academicYears[0];
    const currentYearId = currentYear ? currentYear.AcademicYearID : null;

    const classes = getCachedSheetData("Classes", 60);
    const myClasses = classes.filter(
      (c) =>
        String(c.AcademicYearID) === String(currentYearId) &&
        (String(c.HomeroomTeacherUserID) === String(userId) ||
          String(c.HomeroomTeacherUserID2) === String(userId))
    );
    const myClassIdSet = {};
    myClasses.forEach((c) => (myClassIdSet[String(c.ClassID)] = true));
    const studentCount = getActiveEnrollments().filter((e) => myClassIdSet[String(e.ClassID)] === true).length;

    // ครูประจำชั้นอนุบาลล้วน (ไม่มีห้องประถม): หน้าหลักแสดงสถานะการบันทึก ปถ.12 แทน เพราะอนุบาลไม่มีรายวิชา/การส่งผลการเรียนแบบประถม
    if (myClasses.length > 0 && myClasses.every((c) => isKindergartenGradeLevel(c.GradeLevel))) {
      return buildKindergartenHomeroomDashboard(myClasses, currentYearId);
    }

    // นับรายวิชาที่ถูกมอบหมายให้สอนในห้องที่ตนเป็นครูประจำชั้น (รวมทุกห้องถ้าดูแลมากกว่า 1 ห้อง)
    // แยกว่าส่งผลการเรียนแล้วหรือยังต่อภาคเรียน (26 ก.ย. 2569 — แทนที่การ์ด "ข้อมูลไม่ครบ"/"เกรดเฉลี่ยห้อง" ที่ยังไม่เปิดใช้งานเดิม)
    const myClassIds = myClasses.map((c) => String(c.ClassID));
    const assignmentsInMyClasses = getCachedSheetData("TeachingAssignments", 120).filter(
      (a) => String(a.AcademicYearID) === String(currentYearId) && myClassIds.indexOf(String(a.ClassID)) !== -1
    );

    let submittedSem1 = 0;
    let submittedSem2 = 0;
    let notSubmittedSem1 = 0;
    let notSubmittedSem2 = 0;
    assignmentsInMyClasses.forEach((a) => {
      if (isSemesterSubmitted(a.SubjectID, currentYearId, a.ClassID, 1)) {
        submittedSem1++;
      } else {
        notSubmittedSem1++;
      }
      if (isSemesterSubmitted(a.SubjectID, currentYearId, a.ClassID, 2)) {
        submittedSem2++;
      } else {
        notSubmittedSem2++;
      }
    });

    // รายชื่อรายวิชาที่ลงทะเบียนเรียนทั้งหมดของห้อง (ไม่ซ้ำ) เรียงตามลำดับกลุ่มสาระ — 26 ก.ย. 2569
    // ใช้ตรรกะการเรียงเดียวกับตาราง ปถ.06 (sortSubjectsForPt06Report / SUBJECT_GROUP_ORDER_PT06) เพื่อให้สอดคล้องกันทั้งระบบ
    const subjectsMaster = handleGetSubjects().data;
    const assignedSubjectIds = Array.from(new Set(assignmentsInMyClasses.map((a) => String(a.SubjectID))));
    let subjectListRows = assignedSubjectIds
      .map((subjectId) => {
        const subj = subjectsMaster.find((s) => String(s.SubjectID) === subjectId);
        if (!subj) return null;
        return {
          subjectId: subjectId,
          subjectName: subj.SubjectName,
          subjectType: subj.SubjectType || "",
          subjectGroup: subj.SubjectGroup || "",
          // สถานะการส่งคะแนนรายห้อง/ภาคเรียน + ชื่อครูผู้สอน ไว้กำกับติดตามที่หน้าแรก — 8 ต.ค. 2569
          classes: buildHomeroomSubjectClassStatus(subjectId, assignmentsInMyClasses, myClasses, currentYearId),
        };
      })
      .filter(Boolean);
    subjectListRows = sortSubjectsForPt06Report(subjectListRows);

    // กิจกรรมพัฒนาผู้เรียนที่นายทะเบียนบันทึกผลแล้ว — นับแยกต่างหากจากการ์ดรายวิชาข้างบน เพราะไม่ผ่าน TeachingAssignments
    // (นายทะเบียน/ผู้ช่วยนายทะเบียนเป็นผู้บันทึกผลแทนที่หน้า "บันทึกผลกิจกรรมพัฒนาผู้เรียน") — 26 ก.ย. 2569
    // "บันทึกแล้ว" = มีผลอย่างน้อย 1 แถวของห้อง+กิจกรรมนั้นใน ActivityResults (การบันทึกจะบันทึกทั้งห้องพร้อมกันเสมอ)
    const activitySubjectsAll = getSheetData("Subjects").filter((s) => s.SubjectType === "กิจกรรมพัฒนาผู้เรียน");
    const activityResultsInMyClasses = getSheetData("ActivityResults").filter(
      (r) => String(r.AcademicYearID) === String(currentYearId) && myClassIds.indexOf(String(r.ClassID)) !== -1
    );
    let activityTotal = 0;
    let activityRecorded = 0;
    myClasses.forEach((c) => {
      activitySubjectsAll
        .filter((s) => String(s.GradeLevel) === String(c.GradeLevel))
        .forEach((act) => {
          activityTotal++;
          const hasResult = activityResultsInMyClasses.some(
            (r) => String(r.ClassID) === String(c.ClassID) && String(r.SubjectID) === String(act.SubjectID)
          );
          if (hasResult) activityRecorded++;
        });
    });

    return {
      status: "success",
      data: {
        cards: [
          { icon: "fa-user-graduate", label: "จำนวนนักเรียน", value: studentCount + " คน" },
          {
            icon: "fa-circle-check",
            label: "รายวิชาที่ส่งคะแนนแล้ว",
            value: "ภาคเรียนที่ 1: " + submittedSem1 + " วิชา<br>ภาคเรียนที่ 2: " + submittedSem2 + " วิชา",
          },
          {
            icon: "fa-triangle-exclamation",
            label: "รายวิชาที่ยังไม่ส่งคะแนน",
            value: "ภาคเรียนที่ 1: " + notSubmittedSem1 + " วิชา<br>ภาคเรียนที่ 2: " + notSubmittedSem2 + " วิชา",
          },
          {
            icon: "fa-medal",
            label: "กิจกรรมพัฒนาผู้เรียนที่บันทึกผลแล้ว",
            value: activityRecorded + " / " + activityTotal + " กิจกรรม",
          },
        ],
        progress: [],
        quickActions: [],
        subjects: subjectListRows,
      },
    };
  }

  if (role === "DIRECTOR") {
    const academicYears = getSheetData("AcademicYears");
    academicYears.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));
    // ถ้าไม่มีปีใดถูกตั้งค่าเป็นปีปัจจุบัน (IsCurrent) ให้ fallback ไปใช้ปีล่าสุดแทน (เดิมไม่มี fallback ทำให้นับเป็น 0 ได้)
    const currentYear = academicYears.find(
      (y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE"
    ) || academicYears[0];
    const currentYearId = currentYear ? currentYear.AcademicYearID : null;

    // นับเฉพาะนักเรียนที่จัดเข้าห้องเรียนแล้วในปีการศึกษาปัจจุบัน (ไม่นับที่ยังไม่ได้จัดห้อง)
    const enrolledStudentCount = new Set(
      getActiveEnrollments()
        .filter((e) => String(e.AcademicYearID) === String(currentYearId))
        .map((e) => String(e.StudentID))
    ).size;

    // GPAX เฉลี่ยรวมทั้งโรงเรียน (คำนวณแบบเดียวกับหน้า "รายงานสรุปผู้บริหาร" — ตัดกิจกรรมพัฒนาผู้เรียนออกเสมอ) — 27 ก.ย. 2569
    const classIdsForGpax = getCachedSheetData("Classes", 60)
      .filter((c) => String(c.AcademicYearID) === String(currentYearId))
      .map((c) => String(c.ClassID));
    const subjectsForGpax = handleGetSubjects().data;
    const evalTypeByIdForGpax = {};
    subjectsForGpax.forEach((s) => (evalTypeByIdForGpax[String(s.SubjectID)] = s.EvaluationType));
    const gradedResultsForGpax = getFinalResultsBySchoolYear(currentYearId).filter(
      (r) =>
        classIdsForGpax.indexOf(String(r.classId)) !== -1 &&
        evalTypeByIdForGpax[String(r.subjectId)] !== "ผ่าน-ไม่ผ่าน (ผ/มผ)"
    );
    const schoolGpaxForCard =
      gradedResultsForGpax.length > 0
        ? (
            Math.round((gradedResultsForGpax.reduce((sum, r) => sum + r.gradePoint, 0) / gradedResultsForGpax.length) * 100) /
            100
          ).toFixed(2)
        : "ยังไม่มีข้อมูล";

    return {
      status: "success",
      data: {
        cards: [
          { icon: "fa-user-graduate", label: "นักเรียนทั้งหมด", value: enrolledStudentCount + " คน" },
          { icon: "fa-chart-line", label: "ผลสัมฤทธิ์เฉลี่ยรวม (GPAX)", value: schoolGpaxForCard },
          { icon: "fa-circle-check", label: "อัตราจบการศึกษา", value: "ยังไม่เปิดใช้งาน" },
        ],
        progress: [],
        quickActions: [
          { icon: "fa-chart-pie", label: "รายงานสรุปผู้บริหาร", href: "reports.html" },
        ],
      },
    };
  }

  // REGISTRAR, ASSISTANT_REGISTRAR
  const academicYearsForCount = getSheetData("AcademicYears");
  academicYearsForCount.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));
  // ถ้าไม่มีปีใดถูกตั้งค่าเป็นปีปัจจุบัน (IsCurrent) ให้ fallback ไปใช้ปีล่าสุดแทน (เดิมไม่มี fallback ทำให้นับเป็น 0 ได้)
  const currentYearForCount = academicYearsForCount.find(
    (y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE"
  ) || academicYearsForCount[0];
  const currentYearIdForCount = currentYearForCount ? currentYearForCount.AcademicYearID : null;

  // นับเฉพาะนักเรียนที่จัดเข้าห้องเรียนแล้วในปีการศึกษาปัจจุบัน (ไม่นับที่ยังไม่ได้จัดห้อง)
  const enrolledStudentCount = new Set(
    getActiveEnrollments()
      .filter((e) => String(e.AcademicYearID) === String(currentYearIdForCount))
      .map((e) => String(e.StudentID))
  ).size;

  const subjects = handleGetSubjects().data;

  const userRoles = getCachedSheetData("UserRoles", 300);
  const teacherUserIds = {};
  userRoles.forEach((r) => {
    if (r.RoleType === "SUBJECT_TEACHER" || r.RoleType === "HOMEROOM_TEACHER") {
      teacherUserIds[r.UserID] = true;
    }
  });
  const totalTeachers = Object.keys(teacherUserIds).length;

  return {
    status: "success",
    data: {
      cards: [
        { icon: "fa-user-graduate", label: "นักเรียนทั้งหมด", value: enrolledStudentCount + " คน" },
        { icon: "fa-book", label: "รายวิชาทั้งหมด", value: subjects.length + " วิชา" },
        { icon: "fa-chalkboard-user", label: "ครูผู้สอนทั้งหมด", value: totalTeachers + " คน" },
        { icon: "fa-clipboard-check", label: "รออนุมัติผลการเรียน", value: "ยังไม่เปิดใช้งาน" },
      ],
      progress: [],
      quickActions: [
        { icon: "fa-book", label: "จัดการหลักสูตร/รายวิชา", href: "subjects-manage.html" },
        { icon: "fa-clipboard-check", label: "ตรวจสอบ/อนุมัติผลการเรียน", href: "grades-approve.html" },
        { icon: "fa-file-lines", label: "พิมพ์เอกสาร (ปพ.1 / ปพ.3)", href: "documents.html" },
      ],
    },
  };
}


/**
 * อ่านผลการเรียนสรุปทั้งปีจากชีต FinalResults แบบตำแหน่งคอลัมน์ (ไม่อิงชื่อ Header)
 * เพราะคอลัมน์ YearScore100/GradePoint ไม่เคยถูกอ่านผ่าน getSheetData() ที่อื่นในระบบมาก่อน
 * จึงอิงลำดับคอลัมน์ตามที่ syncFinalResultsForYear() เขียนไว้เสมอ (ดูฟังก์ชันนั้นประกอบ):
 * 0 FinalResultID, 1 StudentID, 2 SubjectID, 3 ClassID, 4 AcademicYearID,
 * 5 Sem1Raw70, 6 Sem1Exam30, 7 Sem1Total100, 8 Sem2Raw70, 9 Sem2Exam30, 10 Sem2Total100,
 * 11 YearScore100, 12 GradePoint, 13 ApprovedByUserID, 14 Timestamp
 */
function getFinalResultsByClass(classId, academicYearId) {
  const sheet = SS.getSheetByName("FinalResults");
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  return data
    .slice(1)
    .filter((r) => String(r[3]) === String(classId) && String(r[4]) === String(academicYearId))
    .map((r) => ({
      studentId: r[1],
      subjectId: r[2],
      semester1Raw70: Number(r[5]),
      semester1Exam30: Number(r[6]),
      semester1Total100: Number(r[7]),
      semester2Raw70: Number(r[8]),
      semester2Exam30: Number(r[9]),
      semester2Total100: Number(r[10]),
      yearScore100: Number(r[11]),
      gradePoint: Number(r[12]),
    }));
}

/**
 * หน้า "สรุปข้อมูลประจำชั้น" (Homeroom Dashboard) สำหรับครูประจำชั้น
 * แสดงรายชื่อนักเรียนในห้องที่ตนเป็นครูประจำชั้น พร้อมสรุปเกรดเฉลี่ย (GPAX) และความคืบหน้าการส่งผลการเรียนของแต่ละคน
 * ขอบเขตข้อมูล: เฉพาะห้องเรียนที่ userId เป็น HomeroomTeacherUserID หรือ HomeroomTeacherUserID2 ในปีการศึกษาปัจจุบันเท่านั้น
 * ถ้าครูประจำชั้น 1 คนดูแลมากกว่า 1 ห้อง ให้เลือกห้องผ่าน body.classId ได้ (ค่าเริ่มต้น = ห้องแรกที่เจอ)
 */
function handleGetHomeroomSummaryPageData(body) {
  const userId = body.userId;
  const requestedClassId = body.classId;

  const academicYears = getSheetData("AcademicYears");
  academicYears.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));
  // ถ้าไม่มีปีใดถูกตั้งค่าเป็นปีปัจจุบัน (IsCurrent) ให้ fallback ไปใช้ปีล่าสุดแทน
  const currentYear = academicYears.find(
    (y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE"
  ) || academicYears[0];
  const currentYearId = currentYear ? currentYear.AcademicYearID : null;

  const classes = getCachedSheetData("Classes", 60);
  const myClasses = classes.filter(
    (c) =>
      String(c.AcademicYearID) === String(currentYearId) &&
      (String(c.HomeroomTeacherUserID) === String(userId) || String(c.HomeroomTeacherUserID2) === String(userId))
  );

  if (myClasses.length === 0) {
    return {
      status: "success",
      data: { classOptions: [], selectedClassId: null, classLabel: "", cards: [], students: [] },
    };
  }

  const selectedClassId =
    requestedClassId && myClasses.some((c) => String(c.ClassID) === String(requestedClassId))
      ? requestedClassId
      : myClasses[0].ClassID;
  const selectedClass = myClasses.find((c) => String(c.ClassID) === String(selectedClassId));

  const classOptions = myClasses.map((c) => ({
    classId: c.ClassID,
    label: c.GradeLevel + "/" + c.RoomNumber,
  }));

  // แสดงนักเรียนทุกสถานะตามเดิม (แต่ละคนมี isActive/studentStatus) — เฉพาะที่ "กำลังศึกษา" เท่านั้นที่นับในการ์ดสรุปและค่าเฉลี่ย
  const enrollments = getCachedSheetData("StudentEnrollments", 60).filter(
    (e) => String(e.ClassID) === String(selectedClassId)
  );
  const students = getSheetData("Students");
  const subjects = handleGetSubjects().data;
  const assignments = getCachedSheetData("TeachingAssignments", 120).filter(
    (a) => String(a.ClassID) === String(selectedClassId) && String(a.AcademicYearID) === String(currentYearId)
  );

  // นับเฉพาะรายวิชาที่ประเมินแบบ "ระดับคะแนน (0-4)" สำหรับคำนวณเกรดเฉลี่ย (GPAX) ตามมาตรฐาน
  // ไม่รวมกิจกรรมพัฒนาผู้เรียนที่ประเมินแบบผ่าน/ไม่ผ่าน เพราะไม่มีความหมายเป็นค่าเกรด 0-4
  const gradedSubjectIds = new Set(
    assignments
      .map((a) => String(a.SubjectID))
      .filter((subjectId) => {
        const subj = subjects.find((s) => String(s.SubjectID) === subjectId);
        return subj && subj.EvaluationType !== "ผ่าน-ไม่ผ่าน (ผ/มผ)";
      })
  );
  const totalGradedSubjects = gradedSubjectIds.size;

  const finalResults = getFinalResultsByClass(selectedClassId, currentYearId).filter((r) =>
    gradedSubjectIds.has(String(r.subjectId))
  );

  const studentRows = enrollments
    .map((e) => {
      const st = students.find((s) => String(s.StudentID) === String(e.StudentID)) || {};
      const myFinalResults = finalResults.filter((r) => String(r.studentId) === String(e.StudentID));
      const gpax =
        myFinalResults.length > 0
          ? myFinalResults.reduce((sum, r) => sum + r.gradePoint, 0) / myFinalResults.length
          : null;

      return {
        studentId: e.StudentID,
        studentNumber: Number(e.StudentNumber) || 0,
        fullName: (st.PrefixName || "") + (st.FirstName || "") + " " + (st.LastName || ""),
        isActive: isActiveStudentRow(st),
        studentStatus: st.Status || "",
        gpax: gpax !== null ? Math.round(gpax * 100) / 100 : null,
        completedSubjects: myFinalResults.length,
        totalSubjects: totalGradedSubjects,
      };
    })
    .sort((a, b) => a.studentNumber - b.studentNumber);

  const activeStudentRows = studentRows.filter((s) => s.isActive);
  const completeCount = activeStudentRows.filter(
    (s) => s.totalSubjects > 0 && s.completedSubjects === s.totalSubjects
  ).length;
  const gpaxValues = activeStudentRows.filter((s) => s.gpax !== null).map((s) => s.gpax);
  const classAvgGpax =
    gpaxValues.length > 0
      ? (Math.round((gpaxValues.reduce((a, b) => a + b, 0) / gpaxValues.length) * 100) / 100).toFixed(2)
      : "-";

  const cards = [
    { icon: "fa-user-graduate", label: "นักเรียนในห้อง", value: activeStudentRows.length + " คน" },
    { icon: "fa-chart-line", label: "เกรดเฉลี่ยห้อง (GPAX)", value: classAvgGpax },
    { icon: "fa-circle-check", label: "ผลการเรียนสมบูรณ์", value: completeCount + " / " + activeStudentRows.length + " คน" },
  ];

  return {
    status: "success",
    data: {
      classOptions: classOptions,
      selectedClassId: selectedClassId,
      classLabel: selectedClass.GradeLevel + "/" + selectedClass.RoomNumber,
      cards: cards,
      students: studentRows,
    },
  };
}

/**
 * คำนวณคะแนนสรุปภาคเรียนของ "นักเรียน 1 คน" ในวิชา/ห้อง/ปี/ภาคเรียนที่ระบุ โดยไม่เช็คว่าผู้เรียกเป็นครูผู้สอนวิชานี้หรือไม่
 * (ต่างจาก handleGetGradeSetup/buildFinalizeData ที่สงวนไว้สำหรับครูประจำวิชาเจ้าของวิชานั้นเท่านั้น)
 * ใช้สำหรับหน้ารายงาน ปถ.06 ที่ต้องดูภาพรวมผลการเรียนทุกวิชาของนักเรียน 1 คน แม้จะไม่ได้เป็นผู้สอนวิชานั้นก็ตาม
 * คืนค่า null ถ้ายังไม่เคยตั้งค่าช่องเก็บคะแนน (GradeComponents) ของวิชา/ภาคเรียนนี้เลย (แปลว่าวิชานี้ยังไม่เริ่มกรอกคะแนน)
 *
 * scoresForStudentPreloaded (ไม่บังคับ) = แถวคะแนนของ "นักเรียนคนนี้คนเดียว" จากชีต StudentScores ที่อ่านมาไว้ล่วงหน้าแล้ว (ทุกวิชา/ทุกภาคเรียนของห้อง/ปีนี้)
 * ใส่มาเพื่อไม่ต้องอ่านทั้งชีต StudentScores ซ้ำทุกครั้งที่ฟังก์ชันนี้ถูกเรียก — เดิม (ก่อน 26 ก.ย. 2569) ฟังก์ชันนี้อ่านทั้งชีตเองทุกครั้ง
 * ถูกเรียกซ้ำถึง 2 ครั้ง/วิชา (ภาคเรียนที่ 1 และ 2) ในลูปของหน้ารายงาน ปถ.06 ทำให้ห้องที่มีหลายรายวิชาโหลดช้ามาก
 * ถ้าไม่ส่งพารามิเตอร์นี้มา จะ fallback ไปอ่านทั้งชีตเองเหมือนเดิม (ยังใช้งานได้ปกติ เผื่อมีจุดเรียกอื่นในอนาคต)
 */
function computeSemesterResultForStudent(subjectId, academicYearId, classId, semester, studentId, scoresForStudentPreloaded) {
  const components = getCachedSheetData("GradeComponents", 120).filter(
    (c) =>
      String(c.SubjectID) === String(subjectId) &&
      String(c.AcademicYearID) === String(academicYearId) &&
      Number(c.Semester) === Number(semester)
  );
  if (components.length === 0) return null;

  const componentsWithSub = components.map((c) => {
    if (c.ComponentType === "ปลายภาค") return Object.assign({}, c, { componentId: c.ComponentID, maxScore: c.MaxScore });
    const subComponents = getCachedSheetData("GradeSubComponents", 60)
      .filter((sc) => String(sc.ComponentID) === String(c.ComponentID))
      .map((sc) => ({ subComponentId: sc.SubComponentID, maxScore: sc.MaxScore }));
    return Object.assign({}, c, { componentId: c.ComponentID, maxScore: c.MaxScore, subComponents: subComponents });
  });

  const scoresSource =
    scoresForStudentPreloaded ||
    getStudentScoresWhere({ ClassID: classId, SubjectID: subjectId, AcademicYearID: academicYearId, Semester: semester });
  const scoresForStudent = scoresSource.filter(
    (sc) =>
      String(sc.ClassID) === String(classId) &&
      String(sc.SubjectID) === String(subjectId) &&
      String(sc.AcademicYearID) === String(academicYearId) &&
      String(sc.Semester) === String(semester) &&
      String(sc.StudentID) === String(studentId)
  );

  const scoresMap = {};
  scoresForStudent.forEach((sc) => {
    const key = sc.StudentID + "|" + sc.ComponentID + "|" + (sc.SubComponentID || "");
    scoresMap[key] = sc.Score;
  });

  const componentsForCalc = componentsWithSub.map((c) => ({
    componentType: c.ComponentType,
    componentId: c.componentId,
    maxScore: c.maxScore,
    subComponents: c.subComponents,
  }));

  return computeSemesterScores(componentsForCalc, scoresMap, studentId);
}

// ลำดับกลุ่มสาระการเรียนรู้ ตามดรอปดาวน์ในหน้าจัดการหลักสูตร/รายวิชา (subjects-manage.html #f-subjectGroup)
// ใช้จัดเรียงตารางรายวิชาในหน้ารายงาน ปถ.06 ให้ตรงตามลำดับที่โรงเรียนใช้งานจริง ไม่ใช่เรียงตามตัวอักษร
const SUBJECT_GROUP_ORDER_PT06 = [
  "ภาษาไทย",
  "คณิตศาสตร์",
  "วิทยาศาสตร์และเทคโนโลยี",
  "สังคมศึกษา ศาสนาและวัฒนธรรม",
  "สุขศึกษาและพลศึกษา",
  "ศิลปะ",
  "การงานอาชีพ",
  "ภาษาต่างประเทศ",
];
const SUBJECT_TYPE_ORDER_PT06 = ["พื้นฐาน", "เพิ่มเติม", "กิจกรรมพัฒนาผู้เรียน"];

/**
 * จัดเรียงรายวิชาสำหรับแสดงผล/ออกรายงาน ปถ.06: พื้นฐาน -> เพิ่มเติม -> กิจกรรมพัฒนาผู้เรียน
 * ภายในประเภทเดียวกัน เรียงตามลำดับกลุ่มสาระการเรียนรู้ (SUBJECT_GROUP_ORDER_PT06)
 * วิชาที่ไม่พบในลิสต์ลำดับ (กลุ่ม/ประเภทที่ตั้งไว้ไม่ตรงกับลิสต์) จะถูกจัดไว้ท้ายสุดของกลุ่มนั้น ไม่หายไปจากตาราง
 */
function sortSubjectsForPt06Report(rows) {
  return rows.slice().sort((a, b) => {
    const typeA = SUBJECT_TYPE_ORDER_PT06.indexOf(a.subjectType);
    const typeB = SUBJECT_TYPE_ORDER_PT06.indexOf(b.subjectType);
    const typeDiff = (typeA === -1 ? 99 : typeA) - (typeB === -1 ? 99 : typeB);
    if (typeDiff !== 0) return typeDiff;

    const groupA = SUBJECT_GROUP_ORDER_PT06.indexOf(a.subjectGroup);
    const groupB = SUBJECT_GROUP_ORDER_PT06.indexOf(b.subjectGroup);
    const groupDiff = (groupA === -1 ? 99 : groupA) - (groupB === -1 ? 99 : groupB);
    if (groupDiff !== 0) return groupDiff;

    return String(a.subjectId).localeCompare(String(b.subjectId));
  });
}

/**
 * รวบรวมข้อมูลผลการเรียนทุกวิชาของนักเรียน 1 คน (แกนหลักที่ใช้ร่วมกันทั้ง 2 จุดที่มีหน้า "ออกรายงาน ปถ.06" ในระบบ)
 * รับ "cls" (แถวห้องเรียนที่ผ่านการตรวจสิทธิ์/เลือกมาแล้ว) เพื่อไม่ต้องเช็คสิทธิ์ซ้ำในนี้ — ผู้เรียก (buildHomeroomStudentReportData
 * สำหรับครูประจำชั้น หรือ buildPt06StudentReportData สำหรับนายทะเบียน) เป็นผู้รับผิดชอบหาแถวห้องเรียนที่ถูกต้องตามขอบเขตสิทธิ์ของตนก่อนเรียกฟังก์ชันนี้
 * คืนค่า { error: "..." } ถ้าไม่พบข้อมูล มิฉะนั้นคืนค่า { academicYear, cls, student, enrollment, subjectRows, gpax }
 */
// พารามิเตอร์ preloaded (ไม่บังคับ) : ใช้เมื่อจะเรียกฟังก์ชันนี้วนซ้ำหลายนักเรียนในห้องเดียวกัน (เช่น ออกรายงานทั้งห้อง)
// เพื่อให้อ่านชีตที่ไม่ได้ขึ้นกับตัวนักเรียนแต่ละคน (AcademicYears/Students/ActivityResults/StudentScores/FinalResults)
// "ครั้งเดียว" นอกลูปแล้วส่งเข้ามา แทนที่จะอ่านทั้งชีตซ้ำทุกคน ทำให้รายงานทั้งห้องช้ามาก — 27 ก.ย. 2569
// รูปแบบ: { academicYears, students, finalResultsByClass, activityResultsByClass, studentScoresByClass }
// ถ้าไม่ส่งมา (เรียกดูรายบุคคลตามปกติ) พฤติกรรมเดิมทุกประการ (อ่านชีตสดทุกครั้ง)
function buildPt06ReportCore(cls, studentId, preloaded) {
  const academicYearId = cls.AcademicYearID;
  const academicYearsList = preloaded && preloaded.academicYears ? preloaded.academicYears : getSheetData("AcademicYears");
  const academicYear = academicYearsList.find((y) => String(y.AcademicYearID) === String(academicYearId));
  const classId = cls.ClassID;

  const enrollment = getCachedSheetData("StudentEnrollments", 60).find(
    (e) => String(e.ClassID) === String(classId) && String(e.StudentID) === String(studentId)
  );
  if (!enrollment) {
    return { error: "ไม่พบนักเรียนคนนี้ในห้องเรียนนี้" };
  }

  const studentsList = preloaded && preloaded.students ? preloaded.students : getSheetData("Students");
  const student = studentsList.find((s) => String(s.StudentID) === String(studentId));
  if (!student) {
    return { error: "ไม่พบข้อมูลนักเรียนคนนี้ในระบบ" };
  }

  const subjects = handleGetSubjects().data;
  const assignments = getCachedSheetData("TeachingAssignments", 120).filter(
    (a) => String(a.ClassID) === String(classId) && String(a.AcademicYearID) === String(academicYearId)
  );
  // กิจกรรมพัฒนาผู้เรียนไม่ผูกกับ TeachingAssignments อีกต่อไป (นายทะเบียนบันทึกผลเองผ่าน ActivityResults แทน — 26 ก.ย. 2569)
  // จึงตัดออกจากรายการที่มาจากการมอบหมายสอน แล้วไปเพิ่มเป็นแถวแยกต่างหากด้านล่างแทน กันข้อมูลมอบหมายเก่าตกค้างซ้ำซ้อนด้วย
  const assignedSubjectIds = Array.from(new Set(assignments.map((a) => String(a.SubjectID)))).filter((subjectId) => {
    const subj = subjects.find((s) => String(s.SubjectID) === subjectId);
    return !subj || subj.SubjectType !== "กิจกรรมพัฒนาผู้เรียน";
  });

  // ชื่อครูผู้สอนของแต่ละวิชา (ในห้อง/ปีการศึกษานี้) — ใช้แสดงใต้ชื่อรายวิชาในตาราง ปถ.06 บนหน้าเว็บ (ไม่ใช้ในไฟล์ PDF) — 26 ก.ย. 2569
  // รองรับกรณีสอนร่วมกันมากกว่า 1 คนต่อวิชา โดยรวมชื่อด้วย ", "
  const usersForTeacherName = getCachedSheetData("Users", 300);

  const finalResults = (
    preloaded && preloaded.finalResultsByClass
      ? preloaded.finalResultsByClass
      : getFinalResultsByClass(classId, academicYearId)
  ).filter((r) => String(r.studentId) === String(studentId));

  // อ่านชีต StudentScores ของนักเรียนคนนี้ "ครั้งเดียว" ไว้ล่วงหน้า แล้วส่งต่อให้ computeSemesterResultForStudent() ใช้ซ้ำในลูปด้านล่าง
  // (แก้ปัญหาเดิมที่อ่านทั้งชีตซ้ำทุกวิชา/ทุกภาคเรียนที่ยังไม่สรุปผล ทำให้ห้องที่มีหลายรายวิชาเปิดดูรายงานช้ามาก — 26 ก.ย. 2569)
  const studentScores = (
    preloaded && preloaded.studentScoresByClass
      ? preloaded.studentScoresByClass.filter((sc) => String(sc.StudentID) === String(studentId))
      : getStudentScoresWhere({ ClassID: classId, StudentID: studentId })
  );

  let subjectRows = assignedSubjectIds
    .map((subjectId) => {
      const subj = subjects.find((s) => String(s.SubjectID) === subjectId);
      if (!subj) return null;

      const isSubmittedSem1 = isSemesterSubmitted(subjectId, academicYearId, classId, 1);
      const isSubmittedSem2 = isSemesterSubmitted(subjectId, academicYearId, classId, 2);
      const finalRow = finalResults.find((r) => String(r.subjectId) === subjectId);

      let semester1Raw70 = null;
      let semester1Exam30 = null;
      let semester1Total100 = null;
      let semester2Raw70 = null;
      let semester2Exam30 = null;
      let semester2Total100 = null;
      let yearScore100 = null;
      let gradePoint = null;

      if (isSubmittedSem1 && isSubmittedSem2 && finalRow) {
        // ส่งครบทั้งปีแล้ว -> ใช้ค่าที่บันทึกไว้เป็นทางการใน FinalResults (ไม่คำนวณซ้ำ)
        semester1Raw70 = finalRow.semester1Raw70;
        semester1Exam30 = finalRow.semester1Exam30;
        semester1Total100 = finalRow.semester1Total100;
        semester2Raw70 = finalRow.semester2Raw70;
        semester2Exam30 = finalRow.semester2Exam30;
        semester2Total100 = finalRow.semester2Total100;
        yearScore100 = finalRow.yearScore100;
        gradePoint = finalRow.gradePoint;
      } else {
        // ยังส่งไม่ครบทั้งปี -> คำนวณเฉพาะภาคเรียนที่ส่งแล้วให้ดูเป็นข้อมูลล่าสุด (ไม่ใช่ผลอย่างเป็นทางการ)
        if (isSubmittedSem1) {
          const sem1 = computeSemesterResultForStudent(subjectId, academicYearId, classId, 1, studentId, studentScores);
          if (sem1) {
            semester1Raw70 = sem1.raw70;
            semester1Exam30 = sem1.exam30;
            semester1Total100 = sem1.total100;
          }
        }
        if (isSubmittedSem2) {
          const sem2 = computeSemesterResultForStudent(subjectId, academicYearId, classId, 2, studentId, studentScores);
          if (sem2) {
            semester2Raw70 = sem2.raw70;
            semester2Exam30 = sem2.exam30;
            semester2Total100 = sem2.total100;
          }
        }
      }

      const teacherNamesForSubject = Array.from(
        new Set(
          assignments
            .filter((a) => String(a.SubjectID) === subjectId)
            .map((a) => String(a.TeacherUserID))
        )
      )
        .map((uid) => {
          const u = usersForTeacherName.find((usr) => String(usr.UserID) === uid);
          return u ? u.FullName : "";
        })
        .filter(Boolean);

      return {
        subjectId: subjectId,
        subjectName: subj.SubjectName,
        subjectType: subj.SubjectType || "",
        subjectGroup: subj.SubjectGroup || "",
        teacherName: teacherNamesForSubject.join(", "),
        credit: Number(subj.Credit) || 0,
        hours: Number(subj.Hours) || 0,
        evaluationType: subj.EvaluationType,
        semester1Raw70: semester1Raw70,
        semester1Exam30: semester1Exam30,
        semester1Total100: semester1Total100,
        semester2Raw70: semester2Raw70,
        semester2Exam30: semester2Exam30,
        semester2Total100: semester2Total100,
        yearScore100: yearScore100,
        gradePoint: gradePoint,
        isSubmittedSem1: isSubmittedSem1,
        isSubmittedSem2: isSubmittedSem2,
      };
    })
    .filter(Boolean);

  // กิจกรรมพัฒนาผู้เรียนของระดับชั้นนี้ (ตามข้อ 4 ที่ตกลงกับผู้ใช้: ไม่มีครูประจำวิชา นายทะเบียนบันทึกผลเองผ่านหน้า
  // "บันทึกผลกิจกรรมพัฒนาผู้เรียน" แยกต่างหาก) — แสดงทุกกิจกรรมของระดับชั้นเสมอไม่ว่าจะบันทึกผลแล้วหรือยัง
  // ประเมินรายปี ไม่มีคะแนน/ภาคเรียน จึงโชว์ช่องคะแนนทั้งหมดเป็น "-" (semester1/2/yearScore = null, gradePoint = null)
  // และไม่นำผล ผ/มผ ไปคิด GPAX (กรองออกด้วย evaluationType อยู่แล้วด้านล่าง) — 26 ก.ย. 2569
  const activityResultsForStudent = (
    preloaded && preloaded.activityResultsByClass
      ? preloaded.activityResultsByClass.filter((r) => String(r.StudentID) === String(studentId))
      : getSheetData("ActivityResults").filter(
          (r) => String(r.ClassID) === String(classId) && String(r.StudentID) === String(studentId)
        )
  );
  const activityRows = subjects
    .filter((s) => s.SubjectType === "กิจกรรมพัฒนาผู้เรียน" && String(s.GradeLevel) === String(cls.GradeLevel))
    .map((subj) => {
      const found = activityResultsForStudent.find((r) => String(r.SubjectID) === String(subj.SubjectID));
      return {
        subjectId: subj.SubjectID,
        subjectName: subj.SubjectName,
        subjectType: subj.SubjectType || "",
        subjectGroup: subj.SubjectGroup || "",
        teacherName: "",
        credit: Number(subj.Credit) || 0,
        hours: Number(subj.Hours) || 0,
        evaluationType: subj.EvaluationType,
        semester1Raw70: null,
        semester1Exam30: null,
        semester1Total100: null,
        semester2Raw70: null,
        semester2Exam30: null,
        semester2Total100: null,
        yearScore100: null,
        gradePoint: null,
        activityResult: found ? found.Result : null,
        isSubmittedSem1: false,
        isSubmittedSem2: false,
      };
    });

  subjectRows = subjectRows.concat(activityRows);
  subjectRows = sortSubjectsForPt06Report(subjectRows);

  // GPAX รวม: เฉลี่ยเฉพาะรายวิชาที่ประเมินแบบระดับคะแนน (0-4) และมีผลการเรียนครบทั้งปีแล้วเท่านั้น
  const gradedCompleted = subjectRows.filter(
    (r) => r.evaluationType !== "ผ่าน-ไม่ผ่าน (ผ/มผ)" && r.gradePoint !== null
  );
  const gpax =
    gradedCompleted.length > 0
      ? Math.round((gradedCompleted.reduce((sum, r) => sum + r.gradePoint, 0) / gradedCompleted.length) * 100) / 100
      : null;

  return {
    academicYear: academicYear,
    cls: cls,
    student: student,
    enrollment: enrollment,
    subjectRows: subjectRows,
    gpax: gpax,
  };
}

/**
 * รวบรวมข้อมูลผลการเรียนทุกวิชาของนักเรียน 1 คน — สำหรับหน้า "ออกรายงาน ปถ.06" ฝั่งครูประจำชั้น
 * ขอบเขตสิทธิ์: ต้องเป็นครูประจำชั้นของ classId นั้นจริง (ในปีการศึกษาปัจจุบันของระบบ) และ studentId ต้องลงทะเบียนอยู่ในห้องนั้นจริง
 * คืนค่า { error: "..." } ถ้าไม่มีสิทธิ์/ไม่พบข้อมูล มิฉะนั้นคืนค่า { academicYear, cls, student, enrollment, subjectRows, gpax }
 */
function buildHomeroomStudentReportData(userId, classId, studentId, preloaded) {
  const academicYears = preloaded && preloaded.academicYears ? preloaded.academicYears : getSheetData("AcademicYears");
  if (!preloaded || !preloaded.academicYears) {
    academicYears.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));
  }
  const currentYear = academicYears.find(
    (y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE"
  ) || academicYears[0];
  const currentYearId = currentYear ? currentYear.AcademicYearID : null;

  const classes = getCachedSheetData("Classes", 60);
  const cls = classes.find(
    (c) =>
      String(c.ClassID) === String(classId) &&
      String(c.AcademicYearID) === String(currentYearId) &&
      (String(c.HomeroomTeacherUserID) === String(userId) || String(c.HomeroomTeacherUserID2) === String(userId))
  );
  if (!cls) {
    return { error: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลห้องเรียนนี้" };
  }

  return buildPt06ReportCore(cls, studentId, preloaded);
}

/**
 * รวบรวมข้อมูลผลการเรียนทุกวิชาของนักเรียน 1 คน — สำหรับหน้า "ออกรายงาน ปถ.06" ฝั่งนายทะเบียน/ผู้ช่วยนายทะเบียน
 * ขอบเขตสิทธิ์: เข้าถึงได้ทุกห้อง/ทุกคนในโรงเรียน (ไม่จำกัดว่าต้องเป็นครูประจำชั้นของห้องนั้น)
 * ปีการศึกษาที่ใช้คำนวณ = ปีการศึกษาของ "ห้องเรียน (classId)" นั้นเอง (ไม่ใช่ปีปัจจุบันของระบบ) เพื่อให้ออกรายงานของห้องเรียนปีการศึกษาก่อนๆ ได้ถูกต้องด้วย
 * คืนค่า { error: "..." } ถ้าไม่พบข้อมูล มิฉะนั้นคืนค่า { academicYear, cls, student, enrollment, subjectRows, gpax }
 */
function buildPt06StudentReportData(classId, studentId, preloaded) {
  const cls = getCachedSheetData("Classes", 60).find((c) => String(c.ClassID) === String(classId));
  if (!cls) {
    return { error: "ไม่พบห้องเรียนนี้ในระบบ" };
  }
  return buildPt06ReportCore(cls, studentId, preloaded);
}

/**
 * หน้า "ออกรายงาน ปถ.06" (รายงานผลการเรียนทุกวิชาของนักเรียนรายบุคคล) สำหรับครูประจำชั้น
 * แสดงผลการเรียนทุกวิชาที่ห้องเรียนถูกมอบหมายให้เรียนในปีการศึกษาปัจจุบัน ของนักเรียน 1 คนที่เลือก
 * (เนื้อหาข้อมูลคำนวณที่ buildHomeroomStudentReportData() แล้ว เพื่อใช้ร่วมกับการออกรายงาน PDF)
 */
function handleGetHomeroomStudentReportData(body) {
  const userId = body.userId;
  const classId = body.classId;
  const studentId = body.studentId;

  if (!classId || !studentId) {
    return { status: "error", message: "กรุณาเลือกห้องเรียนและนักเรียน" };
  }

  const result = buildHomeroomStudentReportData(userId, classId, studentId);
  if (result.error) {
    return { status: "error", message: result.error };
  }

  return {
    status: "success",
    data: {
      academicYearLabel: result.academicYear ? result.academicYear.Year : "",
      classLabel: result.cls.GradeLevel + "/" + result.cls.RoomNumber,
      student: {
        studentId: result.student.StudentID,
        studentNumber: result.enrollment.StudentNumber,
        fullName: (result.student.PrefixName || "") + (result.student.FirstName || "") + " " + (result.student.LastName || ""),
      },
      subjects: result.subjectRows,
      gpax: result.gpax,
    },
  };
}

/**
 * หน้า "ออกรายงาน ปถ.06" (รายงานผลการเรียนทุกวิชาของนักเรียนรายบุคคล) ในระบบนายทะเบียน/ผู้ช่วยนายทะเบียน
 * แสดงผลการเรียนทุกวิชาที่ห้องเรียนนั้นถูกมอบหมายให้เรียนในปีการศึกษาของห้องนั้น ของนักเรียน 1 คนที่เลือก (เลือกได้ทุกห้อง/ทุกคนในโรงเรียน)
 * (เนื้อหาข้อมูลคำนวณที่ buildPt06StudentReportData() แล้ว เพื่อใช้ร่วมกับการออกรายงาน PDF)
 */
function handleGetPt06StudentReportData(body) {
  const classId = body.classId;
  const studentId = body.studentId;

  if (!classId || !studentId) {
    return { status: "error", message: "กรุณาเลือกห้องเรียนและนักเรียน" };
  }

  const result = buildPt06StudentReportData(classId, studentId);
  if (result.error) {
    return { status: "error", message: result.error };
  }

  return {
    status: "success",
    data: {
      academicYearLabel: result.academicYear ? result.academicYear.Year : "",
      classLabel: result.cls.GradeLevel + "/" + result.cls.RoomNumber,
      student: {
        studentId: result.student.StudentID,
        studentNumber: result.enrollment.StudentNumber,
        fullName: (result.student.PrefixName || "") + (result.student.FirstName || "") + " " + (result.student.LastName || ""),
      },
      subjects: result.subjectRows,
      gpax: result.gpax,
    },
  };
}

/**
 * เตรียมข้อมูลแถวสำหรับพิมพ์ลงเทมเพลต ปถ.06 (เวอร์ชัน 2 — ตารางแยกคอลัมน์ภาคเรียนที่ 1/ภาคเรียนที่ 2/สรุปผลปลายปีในตารางเดียวกัน)
 * ไม่มีแนวคิด "รอบการออกรายงาน" แยกอีกต่อไป (ตัด reportScope ออก) เพราะเทมเพลตนี้ออกแบบให้แสดง "สถานะจริง ณ ตอนออกรายงาน" เสมอ:
 * - ยังไม่ส่งภาคเรียนที่ 1 -> คอลัมน์ภาคเรียนที่ 1 เป็น "-"
 * - ส่งภาคเรียนที่ 1 แล้วแต่ภาคเรียนที่ 2 ยังไม่ส่ง -> คอลัมน์ภาคเรียนที่ 1 มีค่า, ภาคเรียนที่ 2/สรุปปลายปี เป็น "-"
 * - ส่งครบทั้ง 2 ภาคเรียน -> แสดงครบทุกคอลัมน์ รวมถึงคอลัมน์ "สรุปผลปลายปี" (เฉลี่ยภาค 1+2 เหมือนแผงสถิติของรายงาน ปถ.05)
 * จึงไม่ต้องปฏิเสธการออกรายงานอีกต่อไปไม่ว่าจะกรอกคะแนนไปถึงไหน
 * คืนค่า { rows, gpa, basicCreditTotal/Earned, extraCreditTotal/Earned }
 *
 * อัปเดต (26 ก.ย. 2569): คอลัมน์ "ระดับผลการเรียน" ของกิจกรรมพัฒนาผู้เรียน เปลี่ยนมาใช้ผล ผ/มผ จริงที่นายทะเบียนบันทึกไว้
 * ผ่านหน้า "บันทึกผลกิจกรรมพัฒนาผู้เรียน" (เก็บใน ActivityResults) แทน workaround เดิมที่แปลงจาก gradePoint > 0
 */
function buildPt06PrintRows(subjectRows) {
  const rows = subjectRows.map((s) => {
    const isActivity = s.evaluationType === "ผ่าน-ไม่ผ่าน (ผ/มผ)";
    const bothSubmitted = s.isSubmittedSem1 && s.isSubmittedSem2;

    // สรุปผลปลายปี: เฉลี่ยระหว่างภาค (เต็ม 70) และปลายภาค (เต็ม 30) ของภาคเรียนที่ 1+2 ตามสูตรเดียวกับแผงสถิติของรายงาน ปถ.05
    let yearRaw70 = null;
    let yearExam30 = null;
    let yearTotal100 = null;
    let gradePoint = null;

    if (bothSubmitted && s.semester1Raw70 !== null && s.semester2Raw70 !== null) {
      // คิดจากคะแนนภาคเรียนด้วยกฎปัดเดียวกับตอนส่งผลการเรียนเสมอ (แถว FinalResults เก่าที่เก็บค่าไม่ปัดจึงไม่ทำให้ตัวเลข/เกรดเพี้ยน)
      const yearScores = computeYearScores(s.semester1Raw70, s.semester1Exam30, s.semester2Raw70, s.semester2Exam30);
      yearRaw70 = yearScores.raw70;
      yearExam30 = yearScores.exam30;
      yearTotal100 = yearScores.total100;
      gradePoint = scoreToGradePoint(yearTotal100);
    }

    return {
      subject: s,
      isActivity: isActivity,
      activityResult: s.activityResult || null,
      sem1Raw70: s.isSubmittedSem1 ? s.semester1Raw70 : null,
      sem1Exam30: s.isSubmittedSem1 ? s.semester1Exam30 : null,
      sem1Total100: s.isSubmittedSem1 ? s.semester1Total100 : null,
      sem2Raw70: s.isSubmittedSem2 ? s.semester2Raw70 : null,
      sem2Exam30: s.isSubmittedSem2 ? s.semester2Exam30 : null,
      sem2Total100: s.isSubmittedSem2 ? s.semester2Total100 : null,
      yearRaw70: yearRaw70,
      yearExam30: yearExam30,
      yearTotal100: yearTotal100,
      gradePoint: gradePoint,
    };
  });

  // หน่วยกิต: "ที่เรียน" = นับทุกวิชาพื้นฐาน/เพิ่มเติมที่มอบหมาย (กิจกรรมพัฒนาผู้เรียนไม่มีหน่วยกิต)
  // "ที่ได้" = นับเฉพาะวิชาที่สรุปผลปลายปีแล้วและ gradePoint > 0 (สอบผ่านจริง ไม่นับกรณีเกรด 0 หรือยังไม่สรุปผล)
  const basicRows = rows.filter((r) => r.subject.subjectType === "พื้นฐาน");
  const extraRows = rows.filter((r) => r.subject.subjectType === "เพิ่มเติม");
  const sumCredit = (arr) => arr.reduce((sum, r) => sum + (Number(r.subject.credit) || 0), 0);
  const sumEarnedCredit = (arr) =>
    arr.reduce((sum, r) => sum + (r.gradePoint > 0 ? Number(r.subject.credit) || 0 : 0), 0);

  // GPA: เฉลี่ยเฉพาะวิชาที่ประเมินแบบระดับคะแนน (ไม่รวมกิจกรรมพัฒนาผู้เรียน) และสรุปผลปลายปีแล้ว ตามมาตรฐานเดียวกับ GPAX หน้าจอสรุปข้อมูลประจำชั้น
  const gradedRows = rows.filter((r) => !r.isActivity && r.gradePoint !== null && r.gradePoint !== undefined);
  const gpa =
    gradedRows.length > 0
      ? Math.round((gradedRows.reduce((sum, r) => sum + r.gradePoint, 0) / gradedRows.length) * 100) / 100
      : null;

  return {
    rows: rows,
    gpa: gpa,
    basicCreditTotal: sumCredit(basicRows),
    basicCreditEarned: sumEarnedCredit(basicRows),
    extraCreditTotal: sumCredit(extraRows),
    extraCreditEarned: sumEarnedCredit(extraRows),
  };
}

/**
 * คืนค่า Folder ID สำหรับเก็บ PDF รายงาน ปถ.06 — แยกจากโฟลเดอร์รายงาน ปถ.05 ตามที่ผู้ใช้ต้องการ
 * สร้างโฟลเดอร์ใหม่อัตโนมัติในการใช้งานครั้งแรก แล้วจดจำ ID ไว้ใน Script Properties เพื่อใช้ซ้ำในครั้งถัดไป
 * (ไม่ต้องให้ผู้ดูแลระบบสร้าง/หา Folder ID เอง)
 */
function getPt06ReportsFolderId() {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty("PT06_REPORTS_FOLDER_ID");
  if (saved) {
    try {
      DriveApp.getFolderById(saved);
      return saved;
    } catch (err) {
      // โฟลเดอร์เดิมถูกลบไปแล้ว สร้างใหม่แทนด้านล่าง
    }
  }

  const folder = DriveApp.createFolder("W-Score รายงาน ปถ.06");
  props.setProperty("PT06_REPORTS_FOLDER_ID", folder.getId());
  return folder.getId();
}

/**
 * ประมาณขนาดฟอนต์ที่เล็กที่สุดเท่าที่จำเป็น เพื่อให้ข้อความยาวๆ พอดีกับความกว้างคอลัมน์จริง (พิกเซล) แบบเดียวกับ "Shrink to fit"
 * Google Sheets ยังไม่มีฟีเจอร์นี้ให้ใช้ตรงๆ ผ่าน Apps Script จึงประมาณเองจากความยาวตัวอักษรเทียบความกว้างคอลัมน์
 * baseFontSize = ขนาดฟอนต์เดิมของเทมเพลต (เพดานสูงสุด ไม่มีการขยายให้ใหญ่กว่านี้) ลดทีละ 0.5pt จนพอดีหรือถึงขั้นต่ำ 6pt
 */
function fitFontSizeToColumnWidth(text, columnWidthPx, baseFontSize) {
  const minFontSize = 6;
  const avgCharWidthPerPt = 0.62; // ประมาณความกว้างเฉลี่ยของตัวอักษร (พิกเซล) ต่อฟอนต์ 1pt สำหรับฟอนต์ไทยความกว้างปานกลาง
  const paddingPx = 6; // เผื่อ padding ซ้าย-ขวาของเซลล์
  // สระบน/ล่างและวรรณยุกต์ภาษาไทย (เช่น ั ิ ี ึ ื ุ ู ่ ้ ๊ ๋ ็ ์) ซ้อนอยู่บน/ล่างตัวอักษรหลัก ไม่ได้เพิ่มความกว้างแนวนอนจริง
  // ถ้านับรวมเป็นความยาวปกติจะประเมินความกว้างข้อความเกินจริงมาก (ข้อความไทยมีเครื่องหมายพวกนี้แทบทุกคำ) ทำให้ย่อฟอนต์เล็กเกินความจำเป็น
  // จึงตัดออกก่อนนับความยาวเพื่อประเมินความกว้างที่ใกล้เคียงความจริงมากขึ้น — 26 ก.ย. 2569
  const THAI_COMBINING_MARKS = /[ัิ-ฺ็-๎]/g;

  const text2 = String(text || "").replace(THAI_COMBINING_MARKS, "");
  if (text2.length === 0) return baseFontSize;

  const availableWidth = Math.max(columnWidthPx - paddingPx, 10);
  let fontSize = baseFontSize;
  while (fontSize > minFontSize && text2.length * fontSize * avgCharWidthPerPt > availableWidth) {
    fontSize -= 0.25;
  }
  return fontSize;
}

/**
 * กรอกข้อมูลนักเรียน 1 คนลงชีตเทมเพลต ปถ.06 ที่คัดลอกมาแล้ว (sheet = สำเนาของชีต "ปพ.6")
 * เทมเพลตเวอร์ชันนี้ (26 ก.ย. 2569, id เทมเพลต 1Txwjtf81EzQVlt5Wx5DWU7e4A4mGBGsx8G6o-K1AxsM) มีตารางคอลัมน์ A-P:
 * แถว 3 (merge A3:P3) = ชั้น/ปีการศึกษา, แถว 4 (merge A4:P4) = ชื่อ/เลขประจำตัว/ห้อง/เลขที่ (เซลล์ยึด = A ไม่ใช่ C)
 * A ลำดับ, B รหัสวิชา, C รายวิชา(merge C:D), E ประเภท, F เวลา,
 * G-I ภาคเรียนที่ 1 (ระหว่างภาค/ปลายภาค/รวม), J-L ภาคเรียนที่ 2 (ระหว่างภาค/ปลายภาค/รวม),
 * M-P สรุปผลปลายปี (ระหว่างภาค/ปลายภาค/รวม/ระดับผลการเรียน)
 * ตารางเริ่มแถว 8 เผื่อไว้ 22 แถว (8-29) — แทรกแถวเพิ่มอัตโนมัติถ้ารายวิชาเกิน แล้วเลื่อนส่วนสรุปผลลงตามจำนวนแถวที่แทรก
 * printed = ผลลัพธ์จาก buildPt06PrintRows()
 */
function fillPt06Sheet(sheet, student, enrollment, cls, academicYear, printed) {
  const TEMPLATE_FIRST_DATA_ROW = 8;
  const TEMPLATE_LAST_DATA_ROW = 29; // เผื่อไว้ 22 แถว (8-29) ในเทมเพลตต้นฉบับ
  const TEMPLATE_PROVISIONED_ROWS = TEMPLATE_LAST_DATA_ROW - TEMPLATE_FIRST_DATA_ROW + 1;

  const neededRows = printed.rows.length;
  let rowOffset = 0;
  if (neededRows > TEMPLATE_PROVISIONED_ROWS) {
    rowOffset = neededRows - TEMPLATE_PROVISIONED_ROWS;
    sheet.insertRowsAfter(TEMPLATE_LAST_DATA_ROW, rowOffset);
  }

  const gradeLevelNumber = String(cls.GradeLevel).replace(/[^0-9]/g, "") || cls.GradeLevel;
  const gradeLevelLabel =
    String(cls.GradeLevel).indexOf("อนุบาล") === 0
      ? "ชั้นอนุบาลปีที่ " + gradeLevelNumber
      : "ชั้นประถมศึกษาปีที่ " + gradeLevelNumber;

  // ----- ส่วนหัว (A2 = ชื่อโรงเรียน เป็นข้อความคงที่ในเทมเพลตอยู่แล้ว ไม่ต้องเขียนทับ) -----
  // แก้ไข 26 ก.ย. 2569: ตรวจสอบไฟล์เทมเพลตจริงที่ผู้ใช้แนบมาใหม่ พบว่าเซลล์ยึด (anchor) ของแถวที่ 3/4 คือ A3/A4
  // (merge เต็มแถว A3:P3 และ A4:P4) ไม่ใช่ C3/C4 ตามที่เข้าใจไว้เดิม จึงทำให้ข้อมูลจริงเขียนลงเซลล์ที่ถูกซ่อนใต้ merge
  // และค่าตัวอย่างเดิมที่ค้างอยู่ใน A3/A4 (เซลล์ยึดจริง) ถูกแสดงผลแทนเสมอไม่ว่าจะเขียนอะไรลง C3/C4 ก็ตาม
  sheet.getRange("A3").setValue(gradeLevelLabel + "  ปีการศึกษา " + academicYear.Year);
  sheet
    .getRange("A4")
    .setValue(
      "ชื่อ   " +
        (student.PrefixName || "") + (student.FirstName || "") + " " + (student.LastName || "") +
        "     เลขประจำตัว   " + student.StudentID +
        "     ห้อง   " + cls.RoomNumber +
        "     เลขที่   " + enrollment.StudentNumber
    );

  // ----- ตารางรายวิชา (เริ่มแถว 8, คอลัมน์ A-P รวม 16 คอลัมน์) -----
  const fmt = (v) => (v === null || v === undefined ? "-" : Number(Number(v).toFixed(2)));
  const dataRows = printed.rows.map((r, i) => {
    const s = r.subject;
    const isActivity = r.isActivity;
    const finalGradeCell = isActivity
      ? r.activityResult || "-"
      : r.gradePoint === null || r.gradePoint === undefined
      ? "-"
      : r.gradePoint;
    // ประเภทกิจกรรมพัฒนาผู้เรียน แสดงย่อเป็น "กิจกรรม" ในตาราง (ข้อความเต็มยาวเกินคอลัมน์) — 26 ก.ย. 2569
    const typeCell = isActivity ? "กิจกรรม" : s.subjectType;
    // เวลา (ชั่วโมง) คำนวณตามปกติจากหน่วยกิตเหมือนรายวิชาทั่วไป ไม่เว้นว่างสำหรับกิจกรรมอีกต่อไป — 26 ก.ย. 2569
    const hoursCell = s.hours;

    return [
      i + 1,
      isActivity ? "" : s.subjectId,
      s.subjectName,
      "",
      typeCell,
      hoursCell,
      fmt(r.sem1Raw70),
      fmt(r.sem1Exam30),
      fmt(r.sem1Total100),
      fmt(r.sem2Raw70),
      fmt(r.sem2Exam30),
      fmt(r.sem2Total100),
      fmt(r.yearRaw70),
      fmt(r.yearExam30),
      fmt(r.yearTotal100),
      finalGradeCell,
    ];
  });
  sheet.getRange(TEMPLATE_FIRST_DATA_ROW, 1, dataRows.length, 16).setValues(dataRows);

  // ปรับย่อขนาดฟอนต์อัตโนมัติเฉพาะคอลัมน์ "รายวิชา" (C:D) ถ้าข้อความยาวเกินความกว้างคอลัมน์จริง
  // (Apps Script ยังไม่มีฟีเจอร์ "Shrink to fit" ให้ใช้ตรงๆ จึงประมาณขนาดฟอนต์จากความยาวตัวอักษรเทียบความกว้างคอลัมน์เอง
  // อ้างอิงขนาดฟอนต์เดิมของเทมเพลตเป็นเพดานสูงสุด ไม่ขยายให้ใหญ่กว่าที่เทมเพลตตั้งไว้)
  // คอลัมน์ "ประเภท" ไม่ต้องย่อ (ข้อความสั้นพอดีคอลัมน์อยู่แล้วเสมอ ตามที่ผู้ใช้ต้องการ) — 26 ก.ย. 2569
  const subjectColWidthPx = sheet.getColumnWidth(3) + sheet.getColumnWidth(4); // C:D merge = คอลัมน์ "รายวิชา"
  const baseSubjectFontSize = sheet.getRange(TEMPLATE_FIRST_DATA_ROW, 3).getFontSize() || 10;

  dataRows.forEach((rowValues, i) => {
    const rowNum = TEMPLATE_FIRST_DATA_ROW + i;
    sheet.getRange(rowNum, 3).setFontSize(fitFontSizeToColumnWidth(rowValues[2], subjectColWidthPx, baseSubjectFontSize));
  });

  // ----- สรุปผลการประเมิน (เลื่อนลงตาม rowOffset ถ้ามีการแทรกแถวด้านบน) -----
  sheet.getRange(33 + rowOffset, 5).setValue(printed.basicCreditTotal);
  sheet.getRange(33 + rowOffset, 6).setValue(printed.basicCreditEarned);
  sheet.getRange(34 + rowOffset, 5).setValue(printed.extraCreditTotal);
  sheet.getRange(34 + rowOffset, 6).setValue(printed.extraCreditEarned);
  sheet.getRange(35 + rowOffset, 5).setValue(printed.basicCreditTotal + printed.extraCreditTotal);
  sheet.getRange(35 + rowOffset, 6).setValue(printed.basicCreditEarned + printed.extraCreditEarned);
  sheet.getRange(36 + rowOffset, 5).setValue(printed.gpa !== null ? printed.gpa : "-");
  // E37 (คุณลักษณะอันพึงประสงค์) / E38 (อ่านคิดวิเคราะห์เขียน) / E39 (ผลกิจกรรมพัฒนาผู้เรียนภาพรวม)
  // ยังไม่มีแหล่งข้อมูลในระบบ (รอโมดูลประเมินคุณลักษณะที่จะพัฒนาในอนาคต) — เว้นว่างไว้ตามที่ตกลงกับผู้ใช้ ไม่เขียนทับค่าเดิมในเทมเพลต
}

/**
 * ออกรายงาน ปถ.06 รายบุคคล (PDF) สำหรับนักเรียน 1 คน ในห้องที่ตนเองเป็นครูประจำชั้น
 * แสดงสถานะจริง ณ ตอนออกรายงาน (ภาคเรียนที่ 1/2/สรุปปลายปี คอลัมน์ไหนยังไม่ส่งผลจะเป็น "-" อัตโนมัติ ไม่ต้องเลือกรอบการออกรายงาน)
 * ไม่มีโหมดพรีวิวอีกต่อไป (ตัดออกตามที่ผู้ใช้ต้องการ)
 */
function handleGenerateHomeroomStudentReport(body) {
  const userId = body.userId;
  const classId = body.classId;
  const studentId = body.studentId;

  if (!classId || !studentId) {
    return { status: "error", message: "กรุณาเลือกห้องเรียนและนักเรียน" };
  }

  if (!PT06_TEMPLATE_FILE_ID || PT06_TEMPLATE_FILE_ID.indexOf("ใส่_") === 0) {
    return { status: "error", message: "ระบบยังไม่ได้ตั้งค่าไฟล์เทมเพลต ปถ.06 กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const built = buildHomeroomStudentReportData(userId, classId, studentId);
  if (built.error) {
    return { status: "error", message: built.error };
  }
  if (built.subjectRows.length === 0) {
    return { status: "error", message: "ห้องเรียนนี้ยังไม่มีการมอบหมายรายวิชาในปีการศึกษาปัจจุบัน" };
  }

  const printed = buildPt06PrintRows(built.subjectRows);

  const fileName =
    "ปถ06_" +
    studentId +
    "_" +
    built.student.FirstName +
    built.student.LastName +
    "_ป." +
    String(built.cls.GradeLevel).replace(/[^0-9]/g, "") +
    "-" +
    built.cls.RoomNumber +
    "_" +
    built.academicYear.Year;

  const reportsFolder = DriveApp.getFolderById(getPt06ReportsFolderId());
  const templateFile = DriveApp.getFileById(PT06_TEMPLATE_FILE_ID);
  const copyFile = templateFile.makeCopy(fileName, reportsFolder);

  try {
    const reportSs = SpreadsheetApp.openById(copyFile.getId());
    const sheet = reportSs.getSheets()[0];
    fillPt06Sheet(sheet, built.student, built.enrollment, built.cls, built.academicYear, printed);
    SpreadsheetApp.flush();

    const exportUrl =
      "https://docs.google.com/spreadsheets/d/" +
      copyFile.getId() +
      "/export?format=pdf&size=A4&portrait=true&scale=4&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25&horizontal_alignment=CENTER&vertical_alignment=TOP&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false";
    const pdfResponse = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });

    if (pdfResponse.getResponseCode() !== 200) {
      return { status: "error", message: "ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง" };
    }

    const pdfBlob = pdfResponse.getBlob().setName(fileName + ".pdf");
    const pdfFile = reportsFolder.createFile(pdfBlob);
    const base64 = Utilities.base64Encode(pdfBlob.getBytes());

    return {
      status: "success",
      data: { fileName: fileName + ".pdf", driveUrl: pdfFile.getUrl(), base64: base64 },
    };
  } finally {
    copyFile.setTrashed(true);
  }
}

/**
 * ออกรายงาน ปถ.06 รวมทั้งห้อง (PDF ไฟล์เดียว, นักเรียน 1 คน = 1 หน้า เรียงตามเลขที่) — แบบ A ตามที่ผู้ใช้เลือก สำหรับครูประจำชั้น
 * ทำโดยคัดลอกชีตเทมเพลตซ้ำในไฟล์สำเนาเดียวกันทีละคน (คัดลอกจากต้นฉบับที่ยังว่างอยู่ให้ครบทุกคนก่อน แล้วค่อยกรอกข้อมูล
 * เพื่อไม่ให้สำเนาของคนถัดไปติดข้อมูลของคนก่อนหน้าไปด้วย) แล้ว export ทั้งไฟล์เป็น PDF รวมในครั้งเดียว ไม่มีโหมดพรีวิวอีกต่อไป
 */
function handleGenerateHomeroomClassReport(body) {
  const userId = body.userId;
  const classId = body.classId;

  if (!classId) {
    return { status: "error", message: "กรุณาเลือกห้องเรียน" };
  }

  if (!PT06_TEMPLATE_FILE_ID || PT06_TEMPLATE_FILE_ID.indexOf("ใส่_") === 0) {
    return { status: "error", message: "ระบบยังไม่ได้ตั้งค่าไฟล์เทมเพลต ปถ.06 กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const summary = handleGetHomeroomSummaryPageData({ userId: userId, classId: classId });
  if (summary.status !== "success" || summary.data.students.length === 0) {
    return { status: "error", message: "ไม่พบนักเรียนในห้องเรียนนี้ หรือคุณไม่มีสิทธิ์เข้าถึง" };
  }

  const students = summary.data.students.slice().sort((a, b) => a.studentNumber - b.studentNumber);

  if (students.length > 60) {
    return { status: "error", message: "จำนวนนักเรียนในห้องมากเกินกว่าที่ระบบรองรับต่อการออกรายงาน 1 ครั้ง (สูงสุด 60 คน)" };
  }

  // เตรียมข้อมูลของนักเรียนทุกคนก่อน (ถ้ามีคนที่ไม่มีสิทธิ์เข้าถึง/ไม่พบข้อมูลจริงๆ ให้แจ้งเตือนและไม่ออกรายงานทั้งห้อง
  // ส่วนกรณีวิชายังส่งผลไม่ครบไม่ถือเป็นปัญหาอีกต่อไป เพราะเทมเพลตแสดง "-" ในคอลัมน์ที่ยังไม่มีข้อมูลได้เองแล้ว)
  // เตรียมข้อมูลที่ไม่ได้ขึ้นกับตัวนักเรียนแต่ละคน "ครั้งเดียว" ไว้ล่วงหน้าก่อนวนลูป (แก้ปัญหาอ่านทั้งชีตซ้ำทุกคนในห้อง
  // ทำให้ออกรายงานทั้งห้องช้ามาก — 27 ก.ย. 2569) : หา currentYearId ด้วยวิธีเดียวกับ buildHomeroomStudentReportData เป๊ะ
  const academicYearsPreload = getSheetData("AcademicYears");
  academicYearsPreload.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));
  const currentYearPreload =
    academicYearsPreload.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE") ||
    academicYearsPreload[0];
  const currentYearIdPreload = currentYearPreload ? currentYearPreload.AcademicYearID : null;
  const preloaded = {
    academicYears: academicYearsPreload,
    students: getSheetData("Students"),
    finalResultsByClass: getFinalResultsByClass(classId, currentYearIdPreload),
    activityResultsByClass: getSheetData("ActivityResults").filter((r) => String(r.ClassID) === String(classId)),
    studentScoresByClass: getStudentScoresWhere({ ClassID: classId }),
  };

  const perStudent = [];
  const studentsWithIssue = [];

  students.forEach((s) => {
    const built = buildHomeroomStudentReportData(userId, classId, s.studentId, preloaded);
    if (built.error) {
      studentsWithIssue.push(s.fullName + " (" + built.error + ")");
      return;
    }
    const printed = buildPt06PrintRows(built.subjectRows);
    perStudent.push({ built: built, printed: printed });
  });

  if (studentsWithIssue.length > 0) {
    return {
      status: "error",
      message: "ไม่สามารถออกรายงานรวมทั้งห้องได้ เนื่องจากมีนักเรียนที่เข้าถึงข้อมูลไม่ได้: " + studentsWithIssue.join("; "),
    };
  }

  const cls = perStudent[0].built.cls;
  const academicYear = perStudent[0].built.academicYear;
  const fileName =
    "ปถ06_รวมห้อง_ป." +
    String(cls.GradeLevel).replace(/[^0-9]/g, "") +
    "-" +
    cls.RoomNumber +
    "_" +
    academicYear.Year;

  const reportsFolder = DriveApp.getFolderById(getPt06ReportsFolderId());
  const templateFile = DriveApp.getFileById(PT06_TEMPLATE_FILE_ID);
  const copyFile = templateFile.makeCopy(fileName, reportsFolder);

  try {
    const reportSs = SpreadsheetApp.openById(copyFile.getId());
    const templateSheet = reportSs.getSheets()[0];
    const templateSheetName = templateSheet.getName();

    // ขั้นที่ 1: คัดลอกชีตเปล่าให้ครบทุกคนก่อน (ยังไม่กรอกข้อมูล) เพื่อไม่ให้สำเนาคนหลังติดข้อมูลของคนก่อนหน้า
    const sheets = perStudent.map((entry, idx) =>
      idx === 0 ? templateSheet : templateSheet.copyTo(reportSs).setName(templateSheetName + "_" + (idx + 1))
    );

    // ขั้นที่ 2: ค่อยกรอกข้อมูลแต่ละคนลงชีตของตัวเอง
    sheets.forEach((sheet, idx) => {
      const entry = perStudent[idx];
      fillPt06Sheet(sheet, entry.built.student, entry.built.enrollment, entry.built.cls, entry.built.academicYear, entry.printed);
    });

    SpreadsheetApp.flush();

    const exportUrl =
      "https://docs.google.com/spreadsheets/d/" +
      copyFile.getId() +
      "/export?format=pdf&size=A4&portrait=true&scale=4&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25&horizontal_alignment=CENTER&vertical_alignment=TOP&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false";
    const pdfResponse = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });

    if (pdfResponse.getResponseCode() !== 200) {
      return { status: "error", message: "ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง" };
    }

    const pdfBlob = pdfResponse.getBlob().setName(fileName + ".pdf");
    const pdfFile = reportsFolder.createFile(pdfBlob);
    const base64 = Utilities.base64Encode(pdfBlob.getBytes());

    return {
      status: "success",
      data: { fileName: fileName + ".pdf", driveUrl: pdfFile.getUrl(), base64: base64, studentCount: perStudent.length },
    };
  } finally {
    copyFile.setTrashed(true);
  }
}

/**
 * ออกรายงาน ปถ.06 รายบุคคล (PDF) สำหรับนักเรียน 1 คน — ใช้ในระบบนายทะเบียน/ผู้ช่วยนายทะเบียน เลือกได้ทุกห้อง/ทุกคนในโรงเรียน
 * แสดงสถานะจริง ณ ตอนออกรายงาน (ภาคเรียนที่ 1/2/สรุปปลายปี คอลัมน์ไหนยังไม่ส่งผลจะเป็น "-" อัตโนมัติ ไม่ต้องเลือกรอบการออกรายงาน)
 */
function handleGeneratePt06StudentReport(body) {
  const classId = body.classId;
  const studentId = body.studentId;

  if (!classId || !studentId) {
    return { status: "error", message: "กรุณาเลือกห้องเรียนและนักเรียน" };
  }

  if (!PT06_TEMPLATE_FILE_ID || PT06_TEMPLATE_FILE_ID.indexOf("ใส่_") === 0) {
    return { status: "error", message: "ระบบยังไม่ได้ตั้งค่าไฟล์เทมเพลต ปถ.06 กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const built = buildPt06StudentReportData(classId, studentId);
  if (built.error) {
    return { status: "error", message: built.error };
  }
  if (built.subjectRows.length === 0) {
    return { status: "error", message: "ห้องเรียนนี้ยังไม่มีการมอบหมายรายวิชาในปีการศึกษานี้" };
  }

  const printed = buildPt06PrintRows(built.subjectRows);

  const fileName =
    "ปถ06_" +
    studentId +
    "_" +
    built.student.FirstName +
    built.student.LastName +
    "_ป." +
    String(built.cls.GradeLevel).replace(/[^0-9]/g, "") +
    "-" +
    built.cls.RoomNumber +
    "_" +
    built.academicYear.Year;

  const reportsFolder = DriveApp.getFolderById(getPt06ReportsFolderId());
  const templateFile = DriveApp.getFileById(PT06_TEMPLATE_FILE_ID);
  const copyFile = templateFile.makeCopy(fileName, reportsFolder);

  try {
    const reportSs = SpreadsheetApp.openById(copyFile.getId());
    const sheet = reportSs.getSheets()[0];
    fillPt06Sheet(sheet, built.student, built.enrollment, built.cls, built.academicYear, printed);
    SpreadsheetApp.flush();

    const exportUrl =
      "https://docs.google.com/spreadsheets/d/" +
      copyFile.getId() +
      "/export?format=pdf&size=A4&portrait=true&scale=4&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25&horizontal_alignment=CENTER&vertical_alignment=TOP&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false";
    const pdfResponse = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });

    if (pdfResponse.getResponseCode() !== 200) {
      return { status: "error", message: "ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง" };
    }

    const pdfBlob = pdfResponse.getBlob().setName(fileName + ".pdf");
    const pdfFile = reportsFolder.createFile(pdfBlob);
    const base64 = Utilities.base64Encode(pdfBlob.getBytes());

    return {
      status: "success",
      data: { fileName: fileName + ".pdf", driveUrl: pdfFile.getUrl(), base64: base64 },
    };
  } finally {
    copyFile.setTrashed(true);
  }
}

/**
 * ออกรายงาน ปถ.06 รวมทั้งห้อง (PDF ไฟล์เดียว, นักเรียน 1 คน = 1 หน้า เรียงตามเลขที่) — แบบ A ตามที่ผู้ใช้เลือก
 * ใช้ในระบบนายทะเบียน/ผู้ช่วยนายทะเบียน เลือกได้ทุกห้องในโรงเรียน (ใช้รายชื่อจาก handleGetEnrollmentsByClass ซึ่งเรียงตามเลขที่อยู่แล้ว)
 * ทำโดยคัดลอกชีตเทมเพลตซ้ำในไฟล์สำเนาเดียวกันทีละคน (คัดลอกจากต้นฉบับที่ยังว่างอยู่ให้ครบทุกคนก่อน แล้วค่อยกรอกข้อมูล
 * เพื่อไม่ให้สำเนาของคนถัดไปติดข้อมูลของคนก่อนหน้าไปด้วย) แล้ว export ทั้งไฟล์เป็น PDF รวมในครั้งเดียว
 */
function handleGeneratePt06ClassReport(body) {
  const classId = body.classId;

  if (!classId) {
    return { status: "error", message: "กรุณาเลือกห้องเรียน" };
  }

  if (!PT06_TEMPLATE_FILE_ID || PT06_TEMPLATE_FILE_ID.indexOf("ใส่_") === 0) {
    return { status: "error", message: "ระบบยังไม่ได้ตั้งค่าไฟล์เทมเพลต ปถ.06 กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const enrollResult = handleGetEnrollmentsByClass(classId);
  if (enrollResult.status !== "success" || enrollResult.data.length === 0) {
    return { status: "error", message: "ไม่พบนักเรียนในห้องเรียนนี้" };
  }

  const students = enrollResult.data; // เรียงตามเลขที่แล้วจาก handleGetEnrollmentsByClass

  if (students.length > 60) {
    return { status: "error", message: "จำนวนนักเรียนในห้องมากเกินกว่าที่ระบบรองรับต่อการออกรายงาน 1 ครั้ง (สูงสุด 60 คน)" };
  }

  // เตรียมข้อมูลของนักเรียนทุกคนก่อน (ถ้ามีคนที่ไม่พบข้อมูลจริงๆ ให้แจ้งเตือนและไม่ออกรายงานทั้งห้อง
  // ส่วนกรณีวิชายังส่งผลไม่ครบไม่ถือเป็นปัญหาอีกต่อไป เพราะเทมเพลตแสดง "-" ในคอลัมน์ที่ยังไม่มีข้อมูลได้เองแล้ว)
  // เตรียมข้อมูลที่ไม่ได้ขึ้นกับตัวนักเรียนแต่ละคน "ครั้งเดียว" ไว้ล่วงหน้าก่อนวนลูป (แก้ปัญหาอ่านทั้งชีตซ้ำทุกคนในห้อง
  // ทำให้ออกรายงานทั้งห้องช้ามาก — 27 ก.ย. 2569) : ใช้ปีการศึกษาของห้องเรียนนี้เอง (ไม่ใช่ปีปัจจุบันของระบบ) ตามพฤติกรรมเดิม
  const clsForPreload = getCachedSheetData("Classes", 60).find((c) => String(c.ClassID) === String(classId));
  const preloaded = clsForPreload
    ? {
        academicYears: getSheetData("AcademicYears"),
        students: getSheetData("Students"),
        finalResultsByClass: getFinalResultsByClass(classId, clsForPreload.AcademicYearID),
        activityResultsByClass: getSheetData("ActivityResults").filter((r) => String(r.ClassID) === String(classId)),
        studentScoresByClass: getStudentScoresWhere({ ClassID: classId }),
      }
    : null;

  const perStudent = [];
  const studentsWithIssue = [];

  students.forEach((s) => {
    const built = buildPt06StudentReportData(classId, s.studentId, preloaded);
    if (built.error) {
      studentsWithIssue.push(s.fullName + " (" + built.error + ")");
      return;
    }
    const printed = buildPt06PrintRows(built.subjectRows);
    perStudent.push({ built: built, printed: printed });
  });

  if (studentsWithIssue.length > 0) {
    return {
      status: "error",
      message: "ไม่สามารถออกรายงานรวมทั้งห้องได้ เนื่องจากมีนักเรียนที่เข้าถึงข้อมูลไม่ได้: " + studentsWithIssue.join("; "),
    };
  }

  const cls = perStudent[0].built.cls;
  const academicYear = perStudent[0].built.academicYear;
  const fileName =
    "ปถ06_รวมห้อง_ป." +
    String(cls.GradeLevel).replace(/[^0-9]/g, "") +
    "-" +
    cls.RoomNumber +
    "_" +
    academicYear.Year;

  const reportsFolder = DriveApp.getFolderById(getPt06ReportsFolderId());
  const templateFile = DriveApp.getFileById(PT06_TEMPLATE_FILE_ID);
  const copyFile = templateFile.makeCopy(fileName, reportsFolder);

  try {
    const reportSs = SpreadsheetApp.openById(copyFile.getId());
    const templateSheet = reportSs.getSheets()[0];
    const templateSheetName = templateSheet.getName();

    // ขั้นที่ 1: คัดลอกชีตเปล่าให้ครบทุกคนก่อน (ยังไม่กรอกข้อมูล) เพื่อไม่ให้สำเนาคนหลังติดข้อมูลของคนก่อนหน้า
    const sheets = perStudent.map((entry, idx) =>
      idx === 0 ? templateSheet : templateSheet.copyTo(reportSs).setName(templateSheetName + "_" + (idx + 1))
    );

    // ขั้นที่ 2: ค่อยกรอกข้อมูลแต่ละคนลงชีตของตัวเอง
    sheets.forEach((sheet, idx) => {
      const entry = perStudent[idx];
      fillPt06Sheet(sheet, entry.built.student, entry.built.enrollment, entry.built.cls, entry.built.academicYear, entry.printed);
    });

    SpreadsheetApp.flush();

    const exportUrl =
      "https://docs.google.com/spreadsheets/d/" +
      copyFile.getId() +
      "/export?format=pdf&size=A4&portrait=true&scale=4&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25&horizontal_alignment=CENTER&vertical_alignment=TOP&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false";
    const pdfResponse = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });

    if (pdfResponse.getResponseCode() !== 200) {
      return { status: "error", message: "ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง" };
    }

    const pdfBlob = pdfResponse.getBlob().setName(fileName + ".pdf");
    const pdfFile = reportsFolder.createFile(pdfBlob);
    const base64 = Utilities.base64Encode(pdfBlob.getBytes());

    return {
      status: "success",
      data: { fileName: fileName + ".pdf", driveUrl: pdfFile.getUrl(), base64: base64, studentCount: perStudent.length },
    };
  } finally {
    copyFile.setTrashed(true);
  }
}

/**
 * ===== บันทึกผลกิจกรรมพัฒนาผู้เรียน (นายทะเบียน/ผู้ช่วยนายทะเบียน) =====
 * กิจกรรมพัฒนาผู้เรียนไม่มีครูประจำวิชาโดยตรง (ตกลงกับผู้ใช้แล้วว่าไม่ต้องมีการมอบหมายผ่าน TeachingAssignments)
 * นายทะเบียน/ผู้ช่วยนายทะเบียนเป็นผู้บันทึกผล ผ/มผ แทน โดยตั้งค่าเริ่มต้นเป็น "ผ่านทุกคน" แล้วติ๊กออกเฉพาะคนที่ไม่ผ่าน
 * ประเมินเป็นรายปี (ไม่มีภาคเรียน) และบันทึกได้พร้อมกันทุกห้อง+ทุกกิจกรรมของระดับชั้นเดียวกันในหน้าจอเดียว (26 ก.ย. 2569)
 * เก็บผลไว้ในชีต "ActivityResults" (คอลัมน์: ActivityResultID, AcademicYearID, ClassID, SubjectID, StudentID, Result, RecordedBy, RecordedAt)
 * — ต้องสร้างชีตนี้ไว้ในสเปรดชีตฐานข้อมูลก่อนใช้งานฟีเจอร์นี้
 */
const GRADE_LEVEL_ORDER_ACTIVITY = ["อนุบาล 1", "อนุบาล 2", "อนุบาล 3", "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"];

/**
 * ข้อมูลเริ่มต้นของหน้า "บันทึกผลกิจกรรมพัฒนาผู้เรียน": ปีการศึกษาทั้งหมด + ระดับชั้นที่มีกิจกรรมพัฒนาผู้เรียนอยู่ในระบบ
 */
function handleGetActivityResultsPageData() {
  const academicYears = handleGetAcademicYears().data;
  const subjects = handleGetSubjects().data;

  const gradeLevels = Array.from(
    new Set(subjects.filter((s) => s.SubjectType === "กิจกรรมพัฒนาผู้เรียน").map((s) => s.GradeLevel))
  ).sort((a, b) => GRADE_LEVEL_ORDER_ACTIVITY.indexOf(a) - GRADE_LEVEL_ORDER_ACTIVITY.indexOf(b));

  return { status: "success", data: { academicYears: academicYears, gradeLevels: gradeLevels } };
}

/**
 * ตารางบันทึกผล (matrix) ของระดับชั้นหนึ่ง ในปีการศึกษาหนึ่ง: แถว = นักเรียนทุกคนทุกห้องของระดับชั้นนั้น, คอลัมน์ = กิจกรรมทุกกิจกรรมของระดับชั้นนั้น
 * ค่าเริ่มต้นของแต่ละช่อง = "ผ" (ผ่าน) เสมอถ้ายังไม่เคยบันทึกไว้ ตามที่ตกลงกับผู้ใช้ (นายทะเบียนจะติ๊กออกเฉพาะคนที่ไม่ผ่าน)
 */
function handleGetActivityResultMatrix(body) {
  const academicYearId = body.academicYearId;
  const gradeLevel = body.gradeLevel;

  if (!academicYearId || !gradeLevel) {
    return { status: "error", message: "กรุณาเลือกปีการศึกษาและระดับชั้น" };
  }

  const activities = getSheetData("Subjects")
    .filter((s) => s.SubjectType === "กิจกรรมพัฒนาผู้เรียน" && String(s.GradeLevel) === String(gradeLevel))
    .map((s) => ({ subjectId: s.SubjectID, subjectName: s.SubjectName }));

  if (activities.length === 0) {
    return { status: "error", message: "ไม่พบกิจกรรมพัฒนาผู้เรียนของระดับชั้นนี้ในระบบ" };
  }

  const classes = getCachedSheetData("Classes", 60)
    .filter((c) => String(c.AcademicYearID) === String(academicYearId) && String(c.GradeLevel) === String(gradeLevel))
    .sort((a, b) => String(a.RoomNumber).localeCompare(String(b.RoomNumber), "th", { numeric: true }));

  if (classes.length === 0) {
    return { status: "error", message: "ไม่พบห้องเรียนของระดับชั้นนี้ในปีการศึกษาที่เลือก" };
  }

  const classIds = classes.map((c) => String(c.ClassID));
  const allStudents = getCachedSheetData("Students", 120);
  const enrollments = getCachedSheetData("StudentEnrollments", 60).filter(
    (e) => classIds.indexOf(String(e.ClassID)) !== -1
  );
  const existingResults = getSheetData("ActivityResults").filter(
    (r) => String(r.AcademicYearID) === String(academicYearId) && classIds.indexOf(String(r.ClassID)) !== -1
  );

  const students = enrollments
    .map((e) => {
      const st = allStudents.find((s) => String(s.StudentID) === String(e.StudentID));
      const cls = classes.find((c) => String(c.ClassID) === String(e.ClassID));
      if (!st || !cls) return null;

      const results = {};
      activities.forEach((act) => {
        const found = existingResults.find(
          (r) =>
            String(r.ClassID) === String(e.ClassID) &&
            String(r.StudentID) === String(e.StudentID) &&
            String(r.SubjectID) === String(act.subjectId)
        );
        results[act.subjectId] = found ? found.Result : "ผ";
      });

      return {
        studentId: st.StudentID,
        studentNumber: e.StudentNumber,
        fullName: (st.PrefixName || "") + (st.FirstName || "") + " " + (st.LastName || ""),
        isActive: isActiveStudentRow(st), // false = ไม่ได้ "กำลังศึกษา" ล็อกการบันทึกผล
        studentStatus: st.Status || "",
        classId: cls.ClassID,
        className: cls.GradeLevel + "/" + cls.RoomNumber,
        results: results,
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.className.localeCompare(b.className, "th", { numeric: true }) ||
        Number(a.studentNumber) - Number(b.studentNumber)
    );

  return { status: "success", data: { activities: activities, students: students } };
}

/**
 * บันทึกผลกิจกรรมพัฒนาผู้เรียนพร้อมกันทั้งตาราง (ทุกห้อง + ทุกกิจกรรมของระดับชั้นที่เลือกในคราวเดียว)
 * results = [{ studentId, classId, subjectId, result }] เขียนทับ (upsert) ทุกรายการที่ส่งมา
 */
function handleSaveActivityResultsBulk(body) {
  const academicYearId = body.academicYearId;
  const results = body.results;

  if (!academicYearId || !Array.isArray(results) || results.length === 0) {
    return { status: "error", message: "ไม่พบข้อมูลที่จะบันทึก" };
  }

  // ล็อกนักเรียนที่ไม่ได้มีสถานะ "กำลังศึกษา": ห้ามบันทึกผลกิจกรรมให้
  const activeIdsForActivity = getActiveStudentIdSet();
  if (results.some((item) => activeIdsForActivity[String(item.studentId)] !== true)) {
    return {
      status: "error",
      message: "ไม่สามารถบันทึกได้ เนื่องจากมีนักเรียนที่ไม่ได้มีสถานะ \"กำลังศึกษา\" กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง",
    };
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(30000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const sheet = SS.getSheetByName("ActivityResults");
    if (!sheet) {
      return { status: "error", message: "ไม่พบชีต ActivityResults กรุณาติดต่อผู้ดูแลระบบให้สร้างชีตนี้ก่อนใช้งาน" };
    }

    const range = sheet.getDataRange();
    const data = range.getValues();
    const headers = data[0];
    const colIndex = {};
    headers.forEach((h, i) => (colIndex[h] = i));

    const now = new Date();
    const userEmail = Session.getActiveUser().getEmail() || "";

    // ทำ index แถวเดิมด้วย key = ClassID|SubjectID|StudentID ไว้ก่อน เพื่อหาแถวที่ต้องอัปเดตได้เร็วโดยไม่ต้องวนซ้ำทุกแถวทุกรายการ
    const rowIndexByKey = {};
    for (let r = 1; r < data.length; r++) {
      const key = data[r][colIndex.ClassID] + "|" + data[r][colIndex.SubjectID] + "|" + data[r][colIndex.StudentID];
      rowIndexByKey[key] = r;
    }

    let maxNum = 0;
    for (let r = 1; r < data.length; r++) {
      const idNum = parseInt(String(data[r][colIndex.ActivityResultID]).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(idNum) && idNum > maxNum) maxNum = idNum;
    }

    const rowsToAppend = [];

    results.forEach((item) => {
      const key = item.classId + "|" + item.subjectId + "|" + item.studentId;
      const resultValue = item.result === "มผ" ? "มผ" : "ผ";

      if (rowIndexByKey.hasOwnProperty(key)) {
        const r = rowIndexByKey[key];
        data[r][colIndex.Result] = resultValue;
        data[r][colIndex.RecordedBy] = userEmail;
        data[r][colIndex.RecordedAt] = now;
      } else {
        maxNum += 1;
        const newRow = new Array(headers.length).fill("");
        newRow[colIndex.ActivityResultID] = "AR" + String(maxNum).padStart(6, "0");
        newRow[colIndex.AcademicYearID] = academicYearId;
        newRow[colIndex.ClassID] = item.classId;
        newRow[colIndex.SubjectID] = item.subjectId;
        newRow[colIndex.StudentID] = item.studentId;
        newRow[colIndex.Result] = resultValue;
        newRow[colIndex.RecordedBy] = userEmail;
        newRow[colIndex.RecordedAt] = now;
        rowsToAppend.push(newRow);
      }
    });

    range.setValues(data);
    if (rowsToAppend.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }

    invalidateSheetCache("ActivityResults");

    return { status: "success", message: "บันทึกผลกิจกรรมพัฒนาผู้เรียนสำเร็จ " + results.length + " รายการ" };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ===== ปถ.12 : รายงานผลการพัฒนาคุณภาพผู้เรียนระดับอนุบาล (อ.1-อ.3) — 5 ต.ค. 2569 =====
 * ครูประจำชั้นอนุบาลบันทึกคะแนน 4 ด้านของนักเรียนในห้องตนเอง พร้อมความคิดเห็นครูประจำชั้น (แยกรายภาคเรียน)
 * ไม่เกี่ยวกับ TeachingAssignments (นายทะเบียนไม่ต้องมอบหมายการสอนใดๆ ให้ห้องอนุบาล) ไม่คำนวณคะแนนรวม/เฉลี่ย
 *
 * ต้องสร้างชีตใหม่ชื่อ "Pt12Results" เองใน Google Sheets ก่อนใช้งาน คอลัมน์เรียงตามนี้ (แถวที่ 1):
 * Pt12ResultID | AcademicYearID | ClassID | StudentID | Semester | ThaiScore | MathScore | EnglishScore | ExperienceScore |
 * CommentPhysical | CommentEmotional | CommentSocial | CommentIntellectual | RecordedBy | RecordedAt
 * (ความเห็นครูประจำชั้นแบ่ง 4 ด้าน: ร่างกาย / อารมณ์และจิตใจ / สังคม / สติปัญญา — อ้างอิงคอลัมน์ด้วยชื่อหัวตาราง ลำดับคอลัมน์ไม่สำคัญ)
 */
const PT12_MAX_SCORES = { thai: 30, math: 30, english: 20, experience: 20 };
const PT12_COMMENT_MAX_LENGTH = 500; // ต่อ 1 ด้าน
const PT12_COMMENT_FIELDS = [
  { key: "commentPhysical", col: "CommentPhysical", label: "ด้านร่างกาย" },
  { key: "commentEmotional", col: "CommentEmotional", label: "ด้านอารมณ์และจิตใจ" },
  { key: "commentSocial", col: "CommentSocial", label: "ด้านสังคม" },
  { key: "commentIntellectual", col: "CommentIntellectual", label: "ด้านสติปัญญา" },
];

function isKindergartenGradeLevel(gradeLevel) {
  return String(gradeLevel || "").trim().indexOf("อนุบาล") === 0;
}

/**
 * ปีการศึกษาปัจจุบัน (IsCurrent = TRUE) ถ้าไม่มีปีใดถูกตั้งไว้ให้ fallback ไปใช้ปีล่าสุด (ตรรกะเดียวกับที่ใช้ทั่วระบบ)
 * ใช้ handleGetAcademicYears() ที่แคชไว้ 5 นาทีและเรียงปีล่าสุดขึ้นก่อนอยู่แล้ว
 */
function getCurrentAcademicYearRow() {
  const years = handleGetAcademicYears().data;
  return (
    years.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE") || years[0] || null
  );
}

/**
 * ห้องเรียนที่ userId เป็นครูประจำชั้น (คนที่ 1 หรือคนที่ 2) ในปีการศึกษาที่ระบุ
 */
function getHomeroomClassesOfUser(userId, academicYearId) {
  return getCachedSheetData("Classes", 60).filter(
    (c) =>
      String(c.AcademicYearID) === String(academicYearId) &&
      (String(c.HomeroomTeacherUserID) === String(userId) || String(c.HomeroomTeacherUserID2) === String(userId))
  );
}

/**
 * ระดับชั้นที่ครูประจำชั้นดูแลในปีการศึกษาปัจจุบัน: "KINDERGARTEN" (อนุบาลล้วน) / "PRIMARY" (ประถมล้วน) / "MIXED" (ทั้งสองแบบ) / "" (ไม่ได้ดูแลห้องใด)
 */
function getHomeroomLevelForUser(userId) {
  const currentYear = getCurrentAcademicYearRow();
  if (!currentYear) return "";
  const myClasses = getHomeroomClassesOfUser(userId, currentYear.AcademicYearID);
  if (myClasses.length === 0) return "";
  const kindergartenCount = myClasses.filter((c) => isKindergartenGradeLevel(c.GradeLevel)).length;
  if (kindergartenCount === 0) return "PRIMARY";
  return kindergartenCount === myClasses.length ? "KINDERGARTEN" : "MIXED";
}

/**
 * อ่านผลคะแนน ปถ.12 ของห้อง (หลายห้องได้) ในปีการศึกษาที่ระบุ ถ้ายังไม่มีชีต Pt12Results คืน [] (ไม่ทำให้หน้าอื่นพัง)
 * ไม่แคชโดยตั้งใจ เพราะเป็นข้อมูลที่ครูเพิ่งบันทึกแล้วต้องเห็นตรงกับที่บันทึกทันที
 */
function getPt12Results(academicYearId, classIds) {
  if (!SS.getSheetByName("Pt12Results")) return [];
  const classIdSet = {};
  classIds.forEach((id) => (classIdSet[String(id)] = true));
  return getSheetData("Pt12Results").filter(
    (r) => String(r.AcademicYearID) === String(academicYearId) && classIdSet[String(r.ClassID)] === true
  );
}

function isPt12RowComplete(r) {
  return ["ThaiScore", "MathScore", "EnglishScore", "ExperienceScore"].every(
    (k) => r[k] !== "" && r[k] !== null && r[k] !== undefined
  );
}

/**
 * หน้าหลักของครูประจำชั้นอนุบาลล้วน: การ์ดสรุปจำนวนนักเรียน + จำนวนคนที่บันทึกคะแนน ปถ.12 ครบ 4 ด้านแล้วแยกรายภาคเรียน
 */
function buildKindergartenHomeroomDashboard(myClasses, currentYearId) {
  const classIds = myClasses.map((c) => String(c.ClassID));
  const totalStudents = getActiveEnrollments().filter(
    (e) => classIds.indexOf(String(e.ClassID)) !== -1
  ).length;

  const results = getPt12Results(currentYearId, classIds);
  const completeCount = (semester) =>
    results.filter((r) => Number(r.Semester) === semester && isPt12RowComplete(r)).length;

  return {
    status: "success",
    data: {
      cards: [
        { icon: "fa-user-graduate", label: "จำนวนนักเรียน", value: totalStudents + " คน" },
        {
          icon: "fa-pen-to-square",
          label: "บันทึกคะแนน ปถ.12 ครบ 4 ด้านแล้ว",
          value:
            "ภาคเรียนที่ 1: " +
            completeCount(1) +
            " / " +
            totalStudents +
            " คน<br>ภาคเรียนที่ 2: " +
            completeCount(2) +
            " / " +
            totalStudents +
            " คน",
        },
      ],
      progress: [],
      quickActions: [{ icon: "fa-file-pdf", label: "ออกรายงาน ปถ.12", href: "pt12-report.html" }],
      subjects: [],
    },
  };
}

/**
 * ตรวจสิทธิ์: ห้องนี้ต้องเป็นห้องอนุบาลที่ userId เป็นครูประจำชั้นในปีการศึกษาปัจจุบันเท่านั้น
 * คืน { cls, currentYear, myKindergartenClasses } หรือ { error } ถ้าไม่ผ่าน
 */
function resolvePt12Class(userId, requestedClassId, requestedYearId) {
  const years = handleGetAcademicYears().data;
  const currentYear = getCurrentAcademicYearRow();
  if (!currentYear) return { error: "ยังไม่ได้ตั้งค่าปีการศึกษาในระบบ" };

  // ปีการศึกษาที่ครูเคยเป็นครูประจำชั้นห้องอนุบาล (ใช้เป็นตัวเลือกปีในหน้าเว็บ) อ่านตารางห้องครั้งเดียว
  const myUserId = String(userId);
  const allClasses = getCachedSheetData("Classes", 60).filter(
    (c) =>
      isKindergartenGradeLevel(c.GradeLevel) &&
      (String(c.HomeroomTeacherUserID) === myUserId || String(c.HomeroomTeacherUserID2) === myUserId)
  );
  const yearOptions = years
    .filter((y) => allClasses.some((c) => String(c.AcademicYearID) === String(y.AcademicYearID)))
    .map((y) => ({
      academicYearId: y.AcademicYearID,
      year: y.Year,
      isCurrent: String(y.AcademicYearID) === String(currentYear.AcademicYearID),
    }));

  // ปีที่เลือก: ตามที่ขอมา (ต้องเป็นปีที่ครูมีห้องอนุบาลจริง) ถ้าไม่ระบุ ใช้ปีปัจจุบัน ถ้าปีปัจจุบันไม่มีห้องให้ใช้ปีล่าสุดที่มี
  let year = currentYear;
  if (requestedYearId) {
    const found = yearOptions.find((o) => String(o.academicYearId) === String(requestedYearId));
    if (!found) return { error: "คุณไม่มีสิทธิ์เข้าถึงปีการศึกษานี้" };
    year = years.find((y) => String(y.AcademicYearID) === String(requestedYearId));
  } else if (yearOptions.length > 0 && !yearOptions.some((o) => o.isCurrent)) {
    year = years.find((y) => String(y.AcademicYearID) === String(yearOptions[0].academicYearId));
  }

  const myKindergartenClasses = allClasses.filter((c) => String(c.AcademicYearID) === String(year.AcademicYearID));
  const isCurrentYear = String(year.AcademicYearID) === String(currentYear.AcademicYearID);

  if (myKindergartenClasses.length === 0) {
    return { year: year, isCurrentYear: isCurrentYear, yearOptions: yearOptions, myKindergartenClasses: [], cls: null };
  }

  const cls = requestedClassId
    ? myKindergartenClasses.find((c) => String(c.ClassID) === String(requestedClassId))
    : myKindergartenClasses[0];
  if (!cls) return { error: "คุณไม่มีสิทธิ์เข้าถึงห้องเรียนนี้" };

  return {
    year: year,
    isCurrentYear: isCurrentYear,
    yearOptions: yearOptions,
    myKindergartenClasses: myKindergartenClasses,
    cls: cls,
  };
}

/**
 * ดึงข้อมูลหน้า "ออกรายงาน ปถ.12": รายชื่อนักเรียนในห้อง + คะแนน/ความคิดเห็นที่เคยบันทึกไว้ของภาคเรียนที่เลือก
 * body: { userId, academicYearId (ไม่บังคับ ค่าเริ่มต้น = ปีปัจจุบัน), classId (ไม่บังคับ), semester (1|2, ค่าเริ่มต้น 1) }
 * ปีการศึกษาที่ผ่านมาดูได้อย่างเดียว (isEditable = false) แก้ไข/บันทึกได้เฉพาะปีการศึกษาปัจจุบัน
 */
function handleGetPt12PageData(body) {
  const semester = Number(body.semester) === 2 ? 2 : 1;

  const resolved = resolvePt12Class(body.userId, body.classId, body.academicYearId);
  if (resolved.error) return { status: "error", message: resolved.error };

  if (!resolved.cls) {
    return {
      status: "success",
      data: {
        yearOptions: resolved.yearOptions,
        selectedYearId: resolved.year.AcademicYearID,
        isEditable: resolved.isCurrentYear,
        classOptions: [],
        selectedClassId: null,
        classLabel: "",
        semester: semester,
        maxScores: PT12_MAX_SCORES,
        students: [],
      },
    };
  }

  const cls = resolved.cls;
  const classId = String(cls.ClassID);

  const allStudents = getCachedSheetData("Students", 120);
  const enrollments = getCachedSheetData("StudentEnrollments", 60).filter((e) => String(e.ClassID) === classId);
  const savedByStudent = {};
  getPt12Results(resolved.year.AcademicYearID, [classId])
    .filter((r) => Number(r.Semester) === semester)
    .forEach((r) => (savedByStudent[String(r.StudentID)] = r));

  const students = enrollments
    .map((e) => {
      const st = allStudents.find((s) => String(s.StudentID) === String(e.StudentID));
      if (!st) return null;
      const saved = savedByStudent[String(e.StudentID)] || {};
      return {
        studentId: st.StudentID,
        studentNumber: e.StudentNumber,
        fullName: (st.PrefixName || "") + (st.FirstName || "") + " " + (st.LastName || ""),
        isActive: isActiveStudentRow(st), // false = ไม่ได้ "กำลังศึกษา" ล็อกการบันทึกผล
        studentStatus: st.Status || "",
        thai: saved.ThaiScore === undefined ? "" : saved.ThaiScore,
        math: saved.MathScore === undefined ? "" : saved.MathScore,
        english: saved.EnglishScore === undefined ? "" : saved.EnglishScore,
        experience: saved.ExperienceScore === undefined ? "" : saved.ExperienceScore,
        commentPhysical: saved.CommentPhysical === undefined ? "" : String(saved.CommentPhysical),
        commentEmotional: saved.CommentEmotional === undefined ? "" : String(saved.CommentEmotional),
        commentSocial: saved.CommentSocial === undefined ? "" : String(saved.CommentSocial),
        commentIntellectual: saved.CommentIntellectual === undefined ? "" : String(saved.CommentIntellectual),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));

  return {
    status: "success",
    data: {
      yearOptions: resolved.yearOptions,
      selectedYearId: resolved.year.AcademicYearID,
      isEditable: resolved.isCurrentYear,
      academicYearLabel: resolved.year.Year,
      classOptions: resolved.myKindergartenClasses.map((c) => ({
        classId: c.ClassID,
        label: c.GradeLevel + "/" + c.RoomNumber,
      })),
      selectedClassId: cls.ClassID,
      classLabel: cls.GradeLevel + "/" + cls.RoomNumber,
      semester: semester,
      maxScores: PT12_MAX_SCORES,
      students: students,
    },
  };
}

/**
 * บันทึกคะแนน 4 ด้าน + ความเห็นครูประจำชั้น 4 ด้านของนักเรียนที่ส่งมา (upsert ด้วย ปี+ห้อง+นักเรียน+ภาคเรียน)
 * body: { userId, academicYearId, classId, semester, results: [{ studentId, thai, math, english, experience,
 *         commentPhysical, commentEmotional, commentSocial, commentIntellectual }] }
 * ช่องคะแนนเว้นว่างได้ (= ยังไม่บันทึก) แต่ถ้ากรอกต้องเป็นตัวเลข 0 ถึงคะแนนเต็มของด้านนั้น
 */
function handleSavePt12Results(body) {
  const semester = Number(body.semester);
  const results = body.results;

  if ((semester !== 1 && semester !== 2) || !body.classId || !Array.isArray(results) || results.length === 0) {
    return { status: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

  const resolved = resolvePt12Class(body.userId, body.classId, body.academicYearId);
  if (resolved.error) return { status: "error", message: resolved.error };
  if (!resolved.cls) {
    return { status: "error", message: "คุณไม่ได้เป็นครูประจำชั้นอนุบาลห้องใดในปีการศึกษานี้" };
  }
  if (!resolved.isCurrentYear) {
    return { status: "error", message: "ปีการศึกษาที่ผ่านมาดูข้อมูลได้อย่างเดียว แก้ไขได้เฉพาะปีการศึกษาปัจจุบัน" };
  }

  const classId = String(resolved.cls.ClassID);
  const academicYearId = resolved.year.AcademicYearID;

  const enrolledStudentIds = {};
  getActiveEnrollments()
    .filter((e) => String(e.ClassID) === classId)
    .forEach((e) => (enrolledStudentIds[String(e.StudentID)] = e.StudentNumber));

  const fields = [
    { key: "thai", label: "ภาษาไทย", col: "ThaiScore", max: PT12_MAX_SCORES.thai },
    { key: "math", label: "คณิตศาสตร์", col: "MathScore", max: PT12_MAX_SCORES.math },
    { key: "english", label: "ภาษาอังกฤษ", col: "EnglishScore", max: PT12_MAX_SCORES.english },
    { key: "experience", label: "เสริมประสบการณ์", col: "ExperienceScore", max: PT12_MAX_SCORES.experience },
  ];

  // ตรวจสอบข้อมูลทุกแถวก่อนเริ่มเขียน (ถ้ามีแถวใดไม่ผ่าน จะไม่บันทึกอะไรเลย)
  const cleaned = [];
  for (let i = 0; i < results.length; i++) {
    const item = results[i] || {};
    const sid = String(item.studentId);
    if (!enrolledStudentIds.hasOwnProperty(sid)) {
      return { status: "error", message: "พบนักเรียนที่ไม่ได้อยู่ในห้องเรียนนี้หรือไม่ได้มีสถานะ \"กำลังศึกษา\" กรุณารีเฟรชหน้าแล้วลองใหม่" };
    }
    const numberLabel = "เลขที่ " + enrolledStudentIds[sid];

    const row = { studentId: sid };
    for (let c = 0; c < PT12_COMMENT_FIELDS.length; c++) {
      const cf = PT12_COMMENT_FIELDS[c];
      const text = String(item[cf.key] === undefined || item[cf.key] === null ? "" : item[cf.key]).trim();
      if (text.length > PT12_COMMENT_MAX_LENGTH) {
        return {
          status: "error",
          message: numberLabel + ": ความเห็น" + cf.label + " ยาวเกิน " + PT12_COMMENT_MAX_LENGTH + " ตัวอักษร",
        };
      }
      row[cf.col] = text;
    }

    for (let f = 0; f < fields.length; f++) {
      const field = fields[f];
      const raw = item[field.key];
      if (raw === "" || raw === null || raw === undefined) {
        row[field.col] = "";
        continue;
      }
      const num = Number(raw);
      if (isNaN(num) || num < 0 || num > field.max) {
        return {
          status: "error",
          message: numberLabel + ": คะแนน" + field.label + " ต้องเป็นตัวเลข 0 ถึง " + field.max,
        };
      }
      row[field.col] = Math.round(num * 100) / 100;
    }
    cleaned.push(row);
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(30000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const sheet = SS.getSheetByName("Pt12Results");
    if (!sheet) {
      return { status: "error", message: "ไม่พบชีต Pt12Results กรุณาติดต่อผู้ดูแลระบบให้สร้างชีตนี้ก่อนใช้งาน" };
    }

    const range = sheet.getDataRange();
    const data = range.getValues();
    const headers = data[0];
    const colIndex = {};
    headers.forEach((h, i) => (colIndex[h] = i));

    // เช็คว่าหัวคอลัมน์ครบตามที่ระบบใช้ (กันกรณีสร้างชีตไว้ด้วยหัวคอลัมน์เวอร์ชันเก่า เช่นยังเป็น TeacherComment)
    const requiredHeaders = ["Pt12ResultID", "AcademicYearID", "ClassID", "StudentID", "Semester", "RecordedBy", "RecordedAt"]
      .concat(fields.map((f) => f.col))
      .concat(PT12_COMMENT_FIELDS.map((c) => c.col));
    const missingHeaders = requiredHeaders.filter((h) => colIndex[h] === undefined);
    if (missingHeaders.length > 0) {
      return {
        status: "error",
        message: "ชีต Pt12Results ขาดหัวคอลัมน์: " + missingHeaders.join(", ") + " กรุณาติดต่อผู้ดูแลระบบ",
      };
    }

    const now = new Date();
    const rowIndexByStudent = {};
    let maxNum = 0;
    for (let r = 1; r < data.length; r++) {
      const idNum = parseInt(String(data[r][colIndex.Pt12ResultID]).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(idNum) && idNum > maxNum) maxNum = idNum;

      if (
        String(data[r][colIndex.AcademicYearID]) === String(academicYearId) &&
        String(data[r][colIndex.ClassID]) === classId &&
        Number(data[r][colIndex.Semester]) === semester
      ) {
        rowIndexByStudent[String(data[r][colIndex.StudentID])] = r;
      }
    }

    const rowsToAppend = [];
    cleaned.forEach((row) => {
      if (rowIndexByStudent.hasOwnProperty(row.studentId)) {
        const r = rowIndexByStudent[row.studentId];
        fields.forEach((f) => (data[r][colIndex[f.col]] = row[f.col]));
        PT12_COMMENT_FIELDS.forEach((c) => (data[r][colIndex[c.col]] = row[c.col]));
        data[r][colIndex.RecordedBy] = body.userId;
        data[r][colIndex.RecordedAt] = now;
      } else {
        maxNum += 1;
        const newRow = new Array(headers.length).fill("");
        newRow[colIndex.Pt12ResultID] = "P12" + String(maxNum).padStart(6, "0");
        newRow[colIndex.AcademicYearID] = academicYearId;
        newRow[colIndex.ClassID] = classId;
        newRow[colIndex.StudentID] = row.studentId;
        newRow[colIndex.Semester] = semester;
        fields.forEach((f) => (newRow[colIndex[f.col]] = row[f.col]));
        PT12_COMMENT_FIELDS.forEach((c) => (newRow[colIndex[c.col]] = row[c.col]));
        newRow[colIndex.RecordedBy] = body.userId;
        newRow[colIndex.RecordedAt] = now;
        rowsToAppend.push(newRow);
      }
    });

    range.setValues(data);
    if (rowsToAppend.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }

    return { status: "success", message: "บันทึกคะแนน ปถ.12 ภาคเรียนที่ " + semester + " สำเร็จ " + cleaned.length + " คน" };
  } finally {
    lock.releaseLock();
  }
}

/**
 * รายการที่ยังไม่ครบของนักเรียน 1 คนในภาคเรียนหนึ่ง (อ่านจากแถวที่บันทึกในชีต Pt12Results) คืน [] ถ้าครบทุกอย่าง
 * ครบ = คะแนนครบ 4 ด้าน + ความเห็นครูประจำชั้นครบ 4 ด้าน (ไม่เป็นช่องว่าง)
 */
function getPt12MissingItems(row) {
  const missing = [];
  if (!row) return ["คะแนนและความเห็นทั้งหมด"];
  [
    ["ThaiScore", "คะแนนภาษาไทย"],
    ["MathScore", "คะแนนคณิตศาสตร์"],
    ["EnglishScore", "คะแนนภาษาอังกฤษ"],
    ["ExperienceScore", "คะแนนเสริมประสบการณ์"],
  ].forEach((p) => {
    if (row[p[0]] === "" || row[p[0]] === null || row[p[0]] === undefined) missing.push(p[1]);
  });
  PT12_COMMENT_FIELDS.forEach((f) => {
    if (String(row[f.col] === undefined || row[f.col] === null ? "" : row[f.col]).trim() === "") {
      missing.push("ความเห็น" + f.label);
    }
  });
  return missing;
}

/**
 * คืนค่า Folder ID สำหรับเก็บ PDF รายงาน ปถ.12 — สร้างโฟลเดอร์ใหม่อัตโนมัติครั้งแรก แล้วจำ ID ไว้ใน Script Properties
 */
function getPt12ReportsFolderId() {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty("PT12_REPORTS_FOLDER_ID");
  if (saved) {
    try {
      DriveApp.getFolderById(saved);
      return saved;
    } catch (err) {
      // โฟลเดอร์เดิมถูกลบไปแล้ว สร้างใหม่แทนด้านล่าง
    }
  }
  const folder = DriveApp.createFolder("W-Score รายงาน ปถ.12");
  props.setProperty("PT12_REPORTS_FOLDER_ID", folder.getId());
  return folder.getId();
}

/**
 * กรอกข้อมูลนักเรียน 1 คนลงชีตเทมเพลต ปถ.12 ที่คัดลอกมาแล้ว (sheet = สำเนาของชีต "ปพ.6" ของไฟล์เทมเพลต ปถ.12)
 * แผนที่เซลล์ของเทมเพลต (6 ต.ค. 2569):
 *   B3 (merge B3:F3) = ชั้น/ปีการศึกษา (ต่อท้ายด้วยภาคเรียน), B4 (merge B4:F4) = ชื่อ/เลขประจำตัว/ห้อง/เลขที่
 *   แถว 8-11 = ภาษาไทย/คณิตศาสตร์/ภาษาอังกฤษ/เสริมประสบการณ์ : D = เต็ม, E = ได้, F = หมายเหตุ (เว้นว่าง)
 *   แถว 14-17 (merge A:F ต่อแถว) = ความเห็นครูประจำชั้น ร่างกาย/อารมณ์จิตใจ/สังคม/สติปัญญา
 *   แถว 19-22 = ความเห็นของผู้ปกครอง (เว้นว่างให้เขียนเอง)
 */
function fillPt12Sheet(sheet, student, enrollment, cls, academicYear, semester, row) {
  const gradeNumber = String(cls.GradeLevel).replace(/[^0-9]/g, "") || cls.GradeLevel;
  sheet.getRange("B3").setValue("ชั้นอนุบาลปีที่ " + gradeNumber + "  ปีการศึกษา " + academicYear.Year + "  ภาคเรียนที่ " + semester);
  sheet
    .getRange("B4")
    .setValue(
      "ชื่อ   " +
        (student.PrefixName || "") + (student.FirstName || "") + " " + (student.LastName || "") +
        "     เลขประจำตัว   " + student.StudentID +
        "     ห้อง   " + cls.RoomNumber +
        "     เลขที่   " + enrollment.StudentNumber
    );

  const fmt = (v) => Math.round(Number(v) * 100) / 100;
  sheet.getRange("D8:E11").setValues([
    [PT12_MAX_SCORES.thai, fmt(row.ThaiScore)],
    [PT12_MAX_SCORES.math, fmt(row.MathScore)],
    [PT12_MAX_SCORES.english, fmt(row.EnglishScore)],
    [PT12_MAX_SCORES.experience, fmt(row.ExperienceScore)],
  ]);

  // ความเห็น 4 ด้าน แถว 14-17: ใช้ป้ายชื่อตามเทมเพลต (ด้านอารมณ์จิตใจ) และเพิ่มความสูงแถวตามความยาวข้อความ (เซลล์ที่ merge ไม่ขยายอัตโนมัติ)
  const labels = ["ด้านร่างกาย", "ด้านอารมณ์จิตใจ", "ด้านสังคม", "ด้านสติปัญญา"];
  const keys = ["CommentPhysical", "CommentEmotional", "CommentSocial", "CommentIntellectual"];
  let widthPx = 0;
  for (let c = 1; c <= 6; c++) widthPx += sheet.getColumnWidth(c);
  const THAI_COMBINING_MARKS = /[ัิ-ฺ็-๎]/g;
  const fontPt = 16;
  const lineHeight = 24;

  labels.forEach((label, i) => {
    const rowNum = 14 + i;
    const text = label + " : " + String(row[keys[i]]).trim().replace(/\s*\n\s*/g, " ");
    const cell = sheet.getRange(rowNum, 1);
    cell.setValue(text);
    cell.setWrap(true);
    cell.setVerticalAlignment("middle");
    const charCount = text.replace(THAI_COMBINING_MARKS, "").length;
    const lines = Math.max(1, Math.ceil((charCount * fontPt * 0.62) / Math.max(widthPx - 12, 50)));
    sheet.setRowHeight(rowNum, Math.max(lineHeight, lines * lineHeight));
  });
}

/**
 * ออกรายงาน ปถ.12 (PDF) รายบุคคล แยกตามภาคเรียน — เฉพาะนักเรียนที่บันทึกครบทุกอย่างแล้ว (คะแนน 4 ด้าน + ความเห็น 4 ด้าน)
 * body: { userId, academicYearId, classId, studentId, semester }
 * ครูประจำชั้นห้องนั้นเท่านั้น (ตรวจผ่าน resolvePt12Class) ปีการศึกษาที่ผ่านมาก็ออกรายงานได้ (ดูอย่างเดียว ไม่แก้ข้อมูล)
 */
function handleGeneratePt12StudentReport(body) {
  const semester = Number(body.semester);
  const studentId = body.studentId;
  if (semester !== 1 && semester !== 2) return { status: "error", message: "ภาคเรียนไม่ถูกต้อง" };
  if (!body.classId || !studentId) return { status: "error", message: "กรุณาเลือกห้องเรียนและนักเรียน" };

  if (!PT12_TEMPLATE_FILE_ID || PT12_TEMPLATE_FILE_ID.indexOf("ใส่_") === 0) {
    return { status: "error", message: "ระบบยังไม่ได้ตั้งค่าไฟล์เทมเพลต ปถ.12 กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const resolved = resolvePt12Class(body.userId, body.classId, body.academicYearId);
  if (resolved.error) return { status: "error", message: resolved.error };
  if (!resolved.cls) return { status: "error", message: "ไม่พบห้องเรียน" };

  const cls = resolved.cls;
  const year = resolved.year;
  const classId = String(cls.ClassID);

  const enrollment = getCachedSheetData("StudentEnrollments", 60).find(
    (e) => String(e.ClassID) === classId && String(e.StudentID) === String(studentId)
  );
  if (!enrollment) return { status: "error", message: "ไม่พบนักเรียนคนนี้ในห้องเรียนที่เลือก" };

  const student = getCachedSheetData("Students", 120).find((s) => String(s.StudentID) === String(studentId));
  if (!student) return { status: "error", message: "ไม่พบข้อมูลนักเรียน" };

  const row = getPt12Results(year.AcademicYearID, [classId]).find(
    (r) => String(r.StudentID) === String(studentId) && Number(r.Semester) === semester
  );
  const missing = getPt12MissingItems(row);
  if (missing.length > 0) {
    return { status: "error", message: "ข้อมูลยังไม่ครบ ไม่สามารถออกรายงานได้ ยังขาด: " + missing.join(", ") };
  }

  const fileName =
    "ปถ12_" + studentId + "_" + student.FirstName + student.LastName +
    "_อ." + String(cls.GradeLevel).replace(/[^0-9]/g, "") + "-" + cls.RoomNumber +
    "_" + year.Year + "_ภาค" + semester;

  const reportsFolder = DriveApp.getFolderById(getPt12ReportsFolderId());
  const copyFile = DriveApp.getFileById(PT12_TEMPLATE_FILE_ID).makeCopy(fileName, reportsFolder);

  try {
    const reportSs = SpreadsheetApp.openById(copyFile.getId());
    fillPt12Sheet(reportSs.getSheets()[0], student, enrollment, cls, year, semester, row);
    SpreadsheetApp.flush();

    const exportUrl =
      "https://docs.google.com/spreadsheets/d/" +
      copyFile.getId() +
      "/export?format=pdf&size=A4&portrait=true&scale=4&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25&horizontal_alignment=CENTER&vertical_alignment=TOP&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false";
    const pdfResponse = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });
    if (pdfResponse.getResponseCode() !== 200) {
      return { status: "error", message: "ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง" };
    }

    const pdfBlob = pdfResponse.getBlob().setName(fileName + ".pdf");
    const pdfFile = reportsFolder.createFile(pdfBlob);
    return {
      status: "success",
      data: {
        fileName: fileName + ".pdf",
        driveUrl: pdfFile.getUrl(),
        base64: Utilities.base64Encode(pdfBlob.getBytes()),
      },
    };
  } finally {
    copyFile.setTrashed(true);
  }
}

/**
 * อ่านผลการเรียนทั้งปี (FinalResults) ของ "ทั้งโรงเรียน" ในปีการศึกษาที่ระบุ ครั้งเดียว (ไม่จำกัด ClassID เหมือน getFinalResultsByClass)
 * ใช้สำหรับหน้า "รายงานสรุปผู้บริหาร" ที่ต้องคำนวณสถิติภาพรวมทั้งโรงเรียน — ตำแหน่งคอลัมน์อ้างอิงตามชีตเดียวกับ getFinalResultsByClass ทุกประการ
 */
function getFinalResultsBySchoolYear(academicYearId) {
  const sheet = SS.getSheetByName("FinalResults");
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  // ใช้คำนวณสถิติภาพรวมเท่านั้น: ไม่นับผลของนักเรียนที่ไม่ได้ "กำลังศึกษา" (6 ต.ค. 2569)
  const activeIds = getActiveStudentIdSet();
  return data
    .slice(1)
    .filter((r) => String(r[4]) === String(academicYearId) && activeIds[String(r[1])] === true)
    .map((r) => ({
      studentId: r[1],
      subjectId: r[2],
      classId: r[3],
      gradePoint: Number(r[12]),
    }));
}

/**
 * หน้า "รายงานสรุปผู้บริหาร" (Executive Report Dashboard) สำหรับผู้อำนวยการสถานศึกษา — 27 ก.ย. 2569
 * อ่านอย่างเดียว (Read-only) ยังไม่มีปุ่มอนุมัติผลการเรียนระดับสถานศึกษาในหน้านี้ (ตกลงกับผู้ใช้ไว้ว่าจะทำในอนาคต)
 * แสดงเฉพาะปีการศึกษาปัจจุบันของระบบเท่านั้น (ยังไม่รองรับเลือกเปรียบเทียบย้อนหลังหลายปี)
 * body.gradeLevel (ไม่บังคับ) : ถ้าระบุ จะกรองเฉพาะ "ตาราง/กราฟสรุปผลสัมฤทธิ์แยกตามกลุ่มสาระ" ให้เหลือเฉพาะระดับชั้นนั้น
 *                                ถ้าไม่ระบุ (ค่าว่าง) = ภาพรวมทั้งโรงเรียนทุกระดับชั้นรวมกัน
 * กิจกรรมพัฒนาผู้เรียน (ประเมินแบบ ผ/มผ) ถูกตัดออกจากทุกการคำนวณในหน้านี้เสมอ (ไม่มีความหมายเป็นเกรด 0-4) เหมือนจุดอื่นๆ ในระบบ
 */
function handleGetDirectorReportData(body) {
  const gradeLevelFilter = body.gradeLevel || "";

  const academicYears = getSheetData("AcademicYears");
  const currentYear =
    academicYears.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE") ||
    academicYears.slice().sort((a, b) => String(b.Year).localeCompare(String(a.Year)))[0];
  if (!currentYear) {
    return { status: "error", message: "ยังไม่ได้ตั้งค่าปีการศึกษาในระบบ" };
  }
  const currentYearId = currentYear.AcademicYearID;

  const classes = getCachedSheetData("Classes", 60).filter((c) => String(c.AcademicYearID) === String(currentYearId));
  if (classes.length === 0) {
    return { status: "error", message: "ยังไม่มีข้อมูลห้องเรียนของปีการศึกษาปัจจุบัน กรุณาติดต่อนายทะเบียน" };
  }
  const classGradeLevelMap = {};
  classes.forEach((c) => (classGradeLevelMap[String(c.ClassID)] = c.GradeLevel));
  const classIdsCurrentYear = classes.map((c) => String(c.ClassID));

  const gradeLevelOptions = Array.from(new Set(classes.map((c) => c.GradeLevel))).sort(
    (a, b) => GRADE_LEVEL_ORDER_ACTIVITY.indexOf(a) - GRADE_LEVEL_ORDER_ACTIVITY.indexOf(b)
  );

  const totalStudents = getActiveEnrollments().filter(
    (e) => classIdsCurrentYear.indexOf(String(e.ClassID)) !== -1
  ).length;

  const subjects = handleGetSubjects().data;
  const subjectGroupById = {};
  const evalTypeById = {};
  const nonActivitySubjectIds = new Set();
  subjects.forEach((s) => {
    subjectGroupById[String(s.SubjectID)] = s.SubjectGroup || "ไม่ระบุกลุ่มสาระ";
    evalTypeById[String(s.SubjectID)] = s.EvaluationType;
    if (s.SubjectType !== "กิจกรรมพัฒนาผู้เรียน") nonActivitySubjectIds.add(String(s.SubjectID));
  });

  // ผลการเรียนทั้งปีของทุกวิชา/ทุกห้องในปีการศึกษาปัจจุบัน อ่านครั้งเดียว (ไม่วนอ่านซ้ำต่อห้อง/ต่อวิชา)
  const finalResults = getFinalResultsBySchoolYear(currentYearId).filter(
    (r) => classIdsCurrentYear.indexOf(String(r.classId)) !== -1
  );
  const gradedResults = finalResults.filter((r) => evalTypeById[String(r.subjectId)] !== "ผ่าน-ไม่ผ่าน (ผ/มผ)");

  // ----- การ์ดสรุป -----
  const schoolGpax =
    gradedResults.length > 0
      ? Math.round((gradedResults.reduce((sum, r) => sum + r.gradePoint, 0) / gradedResults.length) * 100) / 100
      : null;

  // ----- ความคืบหน้าการส่งผลการเรียน: นับจากคู่ "รายวิชา x ห้องเรียน" ที่ถูกมอบหมายให้สอนจริงในปีนี้ (ไม่รวมกิจกรรมพัฒนาผู้เรียน) -----
  const assignments = getCachedSheetData("TeachingAssignments", 120).filter(
    (a) => String(a.AcademicYearID) === String(currentYearId) && classIdsCurrentYear.indexOf(String(a.ClassID)) !== -1
  );
  const subjectClassPairs = Array.from(
    new Set(
      assignments.filter((a) => nonActivitySubjectIds.has(String(a.SubjectID))).map((a) => a.SubjectID + "|" + a.ClassID)
    )
  );
  const submissionKeySet = new Set(
    getCachedSheetData("SemesterSubmissions", 60).map((r) => r.SubjectID + "|" + r.ClassID + "|" + r.Semester)
  );
  let sem1Submitted = 0;
  let sem2Submitted = 0;
  subjectClassPairs.forEach((pair) => {
    if (submissionKeySet.has(pair + "|1")) sem1Submitted++;
    if (submissionKeySet.has(pair + "|2")) sem2Submitted++;
  });
  const totalPairs = subjectClassPairs.length;
  const sem1SubmittedPercent = totalPairs > 0 ? Math.round((sem1Submitted / totalPairs) * 10000) / 100 : 0;
  const sem2SubmittedPercent = totalPairs > 0 ? Math.round((sem2Submitted / totalPairs) * 10000) / 100 : 0;

  // ----- GPAX เฉลี่ยแยกตามระดับชั้น (ใช้ภาพรวมทั้งโรงเรียนเสมอ ไม่ขึ้นกับ body.gradeLevel) -----
  const gpaxByGradeLevel = gradeLevelOptions.map((gl) => {
    const rowsOfLevel = gradedResults.filter((r) => String(classGradeLevelMap[String(r.classId)]) === String(gl));
    const avgGpax =
      rowsOfLevel.length > 0
        ? Math.round((rowsOfLevel.reduce((sum, r) => sum + r.gradePoint, 0) / rowsOfLevel.length) * 100) / 100
        : null;
    return { gradeLevel: gl, avgGpax: avgGpax, resultCount: rowsOfLevel.length };
  });

  // ----- สรุปผลสัมฤทธิ์แยกตามกลุ่มสาระการเรียนรู้ (กรองตามระดับชั้นถ้ามี body.gradeLevel ระบุมา) -----
  const scopedResults = gradeLevelFilter
    ? gradedResults.filter((r) => String(classGradeLevelMap[String(r.classId)]) === String(gradeLevelFilter))
    : gradedResults;

  // ระดับผลการเรียน 8 ระดับตามตารางหน้าปกรายงาน ปถ.05 (เรียงมากไปน้อยเหมือนกันเพื่อความคุ้นเคย)
  const gradeBuckets = [4, 3.5, 3, 2.5, 2, 1.5, 1, 0];
  const groupNames = Array.from(new Set(scopedResults.map((r) => subjectGroupById[String(r.subjectId)]))).sort();

  const buildDistributionRow = (rows) => {
    const total = rows.length;
    const counts = gradeBuckets.map((lv) => rows.filter((r) => Number(r.gradePoint) === lv).length);
    const percents = counts.map((c) => (total > 0 ? Math.round((c / total) * 10000) / 100 : "-"));
    const avgGradePoint = total > 0 ? Math.round((rows.reduce((s, r) => s + r.gradePoint, 0) / total) * 100) / 100 : null;
    const passCount = rows.filter((r) => Number(r.gradePoint) >= 3).length; // เกณฑ์เดียวกับ "ร้อยละผ่านเกณฑ์ดี" ในรายงาน ปถ.05
    const failCount = rows.filter((r) => Number(r.gradePoint) === 0).length;
    const passPercent = total > 0 ? Math.round((passCount / total) * 10000) / 100 : "-";
    const failPercent = total > 0 ? Math.round((failCount / total) * 10000) / 100 : "-";
    return { total: total, counts: counts, percents: percents, avgGradePoint: avgGradePoint, passPercent: passPercent, failPercent: failPercent };
  };

  const achievementRows = groupNames.map((groupName) =>
    Object.assign({ subjectGroup: groupName }, buildDistributionRow(scopedResults.filter((r) => subjectGroupById[String(r.subjectId)] === groupName)))
  );
  const achievementTotalRow = buildDistributionRow(scopedResults);

  return {
    status: "success",
    data: {
      academicYearLabel: currentYear.Year,
      gradeLevelOptions: gradeLevelOptions,
      cards: {
        totalStudents: totalStudents,
        schoolGpax: schoolGpax,
        sem1SubmittedPercent: sem1SubmittedPercent,
        sem2SubmittedPercent: sem2SubmittedPercent,
      },
      gpaxByGradeLevel: gpaxByGradeLevel,
      submissionProgress: {
        sem1: { submitted: sem1Submitted, total: totalPairs, percent: sem1SubmittedPercent },
        sem2: { submitted: sem2Submitted, total: totalPairs, percent: sem2SubmittedPercent },
      },
      achievementBySubjectGroup: achievementRows.map((r) => ({
        subjectGroup: r.subjectGroup,
        avgGradePoint: r.avgGradePoint,
        passPercent: r.passPercent,
        total: r.total,
      })),
      achievementTable: {
        gradeLevels: gradeBuckets,
        rows: achievementRows,
        totalRow: achievementTotalRow,
      },
    },
  };
}

/**
 * หน้าแรกของนายทะเบียน/ผู้ช่วยนายทะเบียน (dashboard.html) — กำกับติดตามความคืบหน้าการบันทึกคะแนนของครูประจำวิชาทุกคน (อ่านอย่างเดียว) — 5 ต.ค. 2569
 * เกณฑ์ "ครบ" ของนักเรียน 1 คน ในวิชา/ห้อง/ภาคเรียนหนึ่ง = มีคะแนนครบทุกช่องเก็บคะแนน (ทุกหน่วย + ปลายภาค) ตามที่ตั้งค่าไว้ใน GradeComponents/GradeSubComponents
 * ดูเฉพาะ "ภาคเรียนปัจจุบันที่เปิดให้บันทึกอยู่" เท่านั้น (ดู getCurrentOpenSemester) ไม่รวมกิจกรรมพัฒนาผู้เรียน (ไม่มีช่องเก็บคะแนนแบบนี้)
 * body.gradeLevel (ไม่บังคับ) : กรองเฉพาะห้องเรียนของระดับชั้นนั้น ถ้าไม่ระบุ = ทุกระดับชั้น
 */
function handleGetRegistrarTeacherProgressOverview(body) {
  const gradeLevelFilter = body.gradeLevel || "";

  const academicYears = getSheetData("AcademicYears");
  const currentYear =
    academicYears.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE") ||
    academicYears.slice().sort((a, b) => String(b.Year).localeCompare(String(a.Year)))[0];
  if (!currentYear) {
    return { status: "error", message: "ยังไม่ได้ตั้งค่าปีการศึกษาในระบบ" };
  }
  const currentYearId = currentYear.AcademicYearID;

  const currentSemester = getCurrentOpenSemester(currentYearId);
  if (!currentSemester) {
    return {
      status: "success",
      data: { noOpenSemester: true, academicYearLabel: currentYear.Year, gradeLevelOptions: [], cards: null, rows: [] },
    };
  }

  let classes = getCachedSheetData("Classes", 60).filter((c) => String(c.AcademicYearID) === String(currentYearId));
  const gradeLevelOptions = Array.from(new Set(classes.map((c) => c.GradeLevel))).sort(
    (a, b) => GRADE_LEVEL_ORDER_ACTIVITY.indexOf(a) - GRADE_LEVEL_ORDER_ACTIVITY.indexOf(b)
  );
  if (gradeLevelFilter) classes = classes.filter((c) => String(c.GradeLevel) === String(gradeLevelFilter));

  if (classes.length === 0) {
    return {
      status: "success",
      data: {
        noOpenSemester: false,
        academicYearLabel: currentYear.Year,
        currentSemester: currentSemester,
        gradeLevelOptions: gradeLevelOptions,
        cards: { totalCombos: 0, completeCombos: 0, inProgressCombos: 0, notStartedCombos: 0, overallPercent: 0 },
        rows: [],
      },
    };
  }

  const classIds = classes.map((c) => String(c.ClassID));
  const classById = {};
  classes.forEach((c) => (classById[String(c.ClassID)] = c));

  const subjects = handleGetSubjects().data;
  const subjectById = {};
  subjects.forEach((s) => (subjectById[String(s.SubjectID)] = s));

  const usersForTeacherName = getCachedSheetData("Users", 300);

  // คู่ "รายวิชา x ห้องเรียน" ทั้งหมดที่ถูกมอบหมายให้สอนจริงในขอบเขตที่เลือก (ไม่รวมกิจกรรมพัฒนาผู้เรียน ซึ่งไม่มีช่องเก็บคะแนนแบบนี้)
  const assignments = getCachedSheetData("TeachingAssignments", 120).filter(
    (a) =>
      String(a.AcademicYearID) === String(currentYearId) &&
      classIds.indexOf(String(a.ClassID)) !== -1 &&
      subjectById[String(a.SubjectID)] &&
      subjectById[String(a.SubjectID)].SubjectType !== "กิจกรรมพัฒนาผู้เรียน"
  );
  const comboKeys = Array.from(new Set(assignments.map((a) => a.SubjectID + "|" + a.ClassID)));
  const teacherIdsByCombo = {};
  assignments.forEach((a) => {
    const k = a.SubjectID + "|" + a.ClassID;
    if (!teacherIdsByCombo[k]) teacherIdsByCombo[k] = {};
    teacherIdsByCombo[k][String(a.TeacherUserID)] = true;
  });
  const teacherNameById = {};
  usersForTeacherName.forEach((u) => (teacherNameById[String(u.UserID)] = u.FullName));

  // โครงสร้างช่องเก็บคะแนนของภาคเรียนปัจจุบัน อ่านครั้งเดียว ไม่วนอ่านซ้ำต่อคู่วิชา/ห้อง
  const componentsBySubject = {};
  getCachedSheetData("GradeComponents", 120)
    .filter((c) => String(c.AcademicYearID) === String(currentYearId) && Number(c.Semester) === currentSemester)
    .forEach((c) => {
      const key = String(c.SubjectID);
      if (!componentsBySubject[key]) componentsBySubject[key] = [];
      componentsBySubject[key].push(c);
    });

  const validCells = getValidScoreCellSet();
  const subComponentCountByComponentId = {};
  getCachedSheetData("GradeSubComponents", 60).forEach((sc) => {
    const key = String(sc.ComponentID);
    subComponentCountByComponentId[key] = (subComponentCountByComponentId[key] || 0) + 1;
  });

  // คะแนนของภาคเรียนปัจจุบันเฉพาะห้องในขอบเขตที่เลือก อ่านครั้งเดียว แล้วจัดกลุ่มตามคู่วิชา/ห้อง
  const scoresByComboKey = {};
  const classIdSet = {};
  classIds.forEach((id) => (classIdSet[id] = true));
  getSheetColumnsData("StudentScores", ["StudentID", "ClassID", "SubjectID", "AcademicYearID", "Semester", "ComponentID", "SubComponentID"])
    .filter(
      (sc) =>
        String(sc.AcademicYearID) === String(currentYearId) &&
        Number(sc.Semester) === currentSemester &&
        classIdSet[String(sc.ClassID)] === true
    )
    .forEach((sc) => {
      const key = sc.SubjectID + "|" + sc.ClassID;
      if (!scoresByComboKey[key]) scoresByComboKey[key] = [];
      scoresByComboKey[key].push(sc);
    });

  const enrollmentsByClassId = {};
  getActiveEnrollments()
    .filter((e) => classIds.indexOf(String(e.ClassID)) !== -1)
    .forEach((e) => {
      const key = String(e.ClassID);
      if (!enrollmentsByClassId[key]) enrollmentsByClassId[key] = [];
      enrollmentsByClassId[key].push(String(e.StudentID));
    });

  const STATUS_PRIORITY = { not_started: 0, in_progress: 1, complete: 2 };
  // วิชา x ห้อง ที่ครูกด "ส่งผลการเรียน" ของภาคเรียนปัจจุบันแล้ว (อ่านครั้งเดียว) — 8 ต.ค. 2569
  const submittedComboSet = {};
  getCachedSheetData("SemesterSubmissions", 60).forEach((r) => {
    if (String(r.AcademicYearID) === String(currentYearId) && Number(r.Semester) === Number(currentSemester)) {
      submittedComboSet[String(r.SubjectID) + "|" + String(r.ClassID)] = true;
    }
  });

  const rows = comboKeys
    .map((key) => {
      const parts = key.split("|");
      const subjectId = parts[0];
      const classId = parts[1];
      const subject = subjectById[subjectId];
      const cls = classById[classId];
      if (!subject || !cls) return null;

      const studentIds = enrollmentsByClassId[classId] || [];
      const totalStudents = studentIds.length;
      if (totalStudents === 0) return null; // ห้องนี้ยังไม่มีนักเรียนลงทะเบียน ไม่มีอะไรให้ติดตาม

      const components = componentsBySubject[subjectId] || [];
      const expectedPerStudent = components.reduce((sum, c) => {
        if (c.ComponentType === "ปลายภาค") return sum + 1;
        return sum + (subComponentCountByComponentId[String(c.ComponentID)] || 0);
      }, 0);

      const teacherNames = Object.keys(teacherIdsByCombo[key] || {})
        .map((uid) => teacherNameById[uid] || "")
        .filter(Boolean)
        .join(", ");

      let completeCount = 0;
      let totalRecordedCells = 0;

      if (components.length > 0 && expectedPerStudent > 0) {
        const comboScores = scoresByComboKey[subjectId + "|" + classId] || [];
        const recordedSetByStudent = {};
        comboScores.forEach((sc) => {
          const sid = String(sc.StudentID);
          if (!recordedSetByStudent[sid]) recordedSetByStudent[sid] = new Set();
          const cellKey = sc.ComponentID + "|" + (sc.SubComponentID || "");
          if (validCells[cellKey] === true) recordedSetByStudent[sid].add(cellKey); // ไม่นับคะแนนค้างของช่องที่ถูกลบแล้ว
        });
        studentIds.forEach((sid) => {
          const recordedCount = recordedSetByStudent[sid] ? recordedSetByStudent[sid].size : 0;
          totalRecordedCells += recordedCount;
          if (recordedCount >= expectedPerStudent) completeCount++;
        });
      }

      const percent = totalStudents > 0 ? Math.round((completeCount / totalStudents) * 100) : 0;
      const status =
        components.length === 0 || expectedPerStudent === 0 || totalRecordedCells === 0
          ? "not_started"
          : percent === 100
          ? "complete"
          : "in_progress";

      return {
        subjectId: subjectId,
        subjectName: subject.SubjectName,
        subjectGroup: subject.SubjectGroup || "",
        classId: classId,
        className: cls.GradeLevel + "/" + cls.RoomNumber,
        gradeLevel: cls.GradeLevel,
        teacherNames: teacherNames || "ไม่พบข้อมูลครูผู้สอน",
        totalStudents: totalStudents,
        completeCount: completeCount,
        percent: percent,
        status: status,
        submitted: submittedComboSet[subjectId + "|" + classId] === true,        
      };
    })
    .filter(Boolean)
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || a.percent - b.percent || a.className.localeCompare(b.className, "th", { numeric: true }));

  const totalCombos = rows.length;
  const completeCombos = rows.filter((r) => r.status === "complete").length;
  const notStartedCombos = rows.filter((r) => r.status === "not_started").length;
  const inProgressCombos = totalCombos - completeCombos - notStartedCombos;
  const totalStudentsAll = rows.reduce((sum, r) => sum + r.totalStudents, 0);
  const totalCompleteAll = rows.reduce((sum, r) => sum + r.completeCount, 0);
  const overallPercent = totalStudentsAll > 0 ? Math.round((totalCompleteAll / totalStudentsAll) * 100) : 0;

  return {
    status: "success",
    data: {
      noOpenSemester: false,
      academicYearLabel: currentYear.Year,
      currentSemester: currentSemester,
      gradeLevelOptions: gradeLevelOptions,
      cards: {
        totalCombos: totalCombos,
        completeCombos: completeCombos,
        inProgressCombos: inProgressCombos,
        notStartedCombos: notStartedCombos,
        overallPercent: overallPercent,
      },
      rows: rows,
    },
  };
}

/**
 * รายละเอียดเจาะลึกของ 1 คู่ "รายวิชา x ห้องเรียน" สำหรับ Modal "ดูรายละเอียด" ในหน้าแรกนายทะเบียน — 5 ต.ค. 2569
 * คืนรายชื่อนักเรียนที่ยังกรอกคะแนนไม่ครบ พร้อมระบุว่าขาดช่องเก็บคะแนนใดบ้าง (ใช้ภาคเรียนปัจจุบันที่เปิดอยู่เสมอ เหมือนหน้าภาพรวม)
 */
function handleGetTeacherProgressDetail(body) {
  const subjectId = body.subjectId;
  const classId = body.classId;
  if (!subjectId || !classId) {
    return { status: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

  const academicYears = getSheetData("AcademicYears");
  const currentYear =
    academicYears.find((y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE") ||
    academicYears.slice().sort((a, b) => String(b.Year).localeCompare(String(a.Year)))[0];
  if (!currentYear) {
    return { status: "error", message: "ยังไม่ได้ตั้งค่าปีการศึกษาในระบบ" };
  }
  const currentYearId = currentYear.AcademicYearID;

  const currentSemester = getCurrentOpenSemester(currentYearId);
  if (!currentSemester) {
    return { status: "error", message: "ขณะนี้ไม่มีภาคเรียนใดเปิดให้บันทึกคะแนนอยู่" };
  }

  const cls = getCachedSheetData("Classes", 60).find((c) => String(c.ClassID) === String(classId));
  const subject = handleGetSubjects().data.find((s) => String(s.SubjectID) === String(subjectId));
  if (!cls || !subject) {
    return { status: "error", message: "ไม่พบข้อมูลวิชาหรือห้องเรียนนี้" };
  }

  const components = getCachedSheetData("GradeComponents", 120)
    .filter(
      (c) =>
        String(c.SubjectID) === String(subjectId) &&
        String(c.AcademicYearID) === String(currentYearId) &&
        Number(c.Semester) === currentSemester
    )
    .sort((a, b) => {
      if (a.ComponentType !== b.ComponentType) return a.ComponentType === "หน่วย" ? -1 : 1;
      return Number(a.ComponentOrder || 0) - Number(b.ComponentOrder || 0);
    });

  if (components.length === 0) {
    return {
      status: "success",
      data: { className: cls.GradeLevel + "/" + cls.RoomNumber, subjectLabel: subjectId + " " + subject.SubjectName, notSetUp: true, missingStudents: [] },
    };
  }

  const subComponentsByComponentId = {};
  getCachedSheetData("GradeSubComponents", 60).forEach((sc) => {
    const key = String(sc.ComponentID);
    if (!subComponentsByComponentId[key]) subComponentsByComponentId[key] = [];
    subComponentsByComponentId[key].push(sc);
  });

  const enrollments = getActiveEnrollments().filter((e) => String(e.ClassID) === String(classId));
  const allStudents = getCachedSheetData("Students", 120);
  const scores = getStudentScoresWhere({
    ClassID: classId,
    SubjectID: subjectId,
    AcademicYearID: currentYearId,
    Semester: currentSemester,
  });

  const students = enrollments
    .map((e) => {
      const st = allStudents.find((s) => String(s.StudentID) === String(e.StudentID));
      return {
        studentId: e.StudentID,
        studentNumber: Number(e.StudentNumber) || 0,
        fullName: st ? (st.PrefixName || "") + (st.FirstName || "") + " " + (st.LastName || "") : e.StudentID,
      };
    })
    .sort((a, b) => a.studentNumber - b.studentNumber);

  const missingStudents = [];
  let completeCount = 0;

  students.forEach((st) => {
    const scoresForStudent = scores.filter((sc) => String(sc.StudentID) === String(st.studentId));
    const missingComponents = [];

    components.forEach((c) => {
      const isFinalExam = c.ComponentType === "ปลายภาค";
      const expected = isFinalExam ? 1 : (subComponentsByComponentId[String(c.ComponentID)] || []).length;
      const recorded = isFinalExam
        ? scoresForStudent.filter((sc) => String(sc.ComponentID) === String(c.ComponentID)).length
        : new Set(
            scoresForStudent
              .filter((sc) => String(sc.ComponentID) === String(c.ComponentID))
              .map((sc) => String(sc.SubComponentID))
              // นับเฉพาะช่องที่ยังมีอยู่จริง (ไม่นับคะแนนค้างของช่องที่ถูกลบไปแล้ว)
              .filter((id) => (subComponentsByComponentId[String(c.ComponentID)] || []).some((x) => String(x.SubComponentID) === id))
          ).size;

      if (recorded < expected) {
        missingComponents.push({ componentName: c.ComponentName, recorded: recorded, expected: expected });
      }
    });

    if (missingComponents.length > 0) {
      missingStudents.push({
        studentId: st.studentId,
        studentNumber: st.studentNumber,
        fullName: st.fullName,
        missingComponents: missingComponents,
      });
    } else {
      completeCount++;
    }
  });

  return {
    status: "success",
    data: {
      className: cls.GradeLevel + "/" + cls.RoomNumber,
      subjectLabel: subjectId + " " + subject.SubjectName,
      currentSemester: currentSemester,
      totalStudents: students.length,
      completeCount: completeCount,
      notSetUp: false,
      missingStudents: missingStudents,
    },
  };
}

/**
 * แปลงชื่อระดับชั้นให้เป็นรหัสย่อ สำหรับใช้สร้าง ClassID
 */
function gradeLevelCode(gradeLevel) {
  const map = {
    "อนุบาล 1": "AN1",
    "อนุบาล 2": "AN2",
    "อนุบาล 3": "AN3",
    "ป.1": "P1",
    "ป.2": "P2",
    "ป.3": "P3",
    "ป.4": "P4",
    "ป.5": "P5",
    "ป.6": "P6",
  };
  return map[gradeLevel] || gradeLevel.replace(/\s/g, "");
}

/**
 * ดึงรายการห้องเรียนทั้งหมด
 */
function handleGetClasses() {
  const classes = getSheetData("Classes");
  return { status: "success", data: classes };
}

/**
 * เพิ่มห้องเรียนใหม่ (ClassID สร้างอัตโนมัติจาก ระดับชั้น+ห้องที่+ปีการศึกษา)
 */
function handleAddClass(body) {
  const required = ["gradeLevel", "roomNumber", "academicYearId"];
  for (const field of required) {
    if (!body[field]) {
      return { status: "error", message: "กรุณากรอกข้อมูลให้ครบถ้วน" };
    }
  }

  const classId = "C-" + gradeLevelCode(body.gradeLevel) + "-" + body.roomNumber + "-" + body.academicYearId;

  if (findRowIndexByColumnValue("Classes", "ClassID", classId) !== -1) {
    return { status: "error", message: "มีห้องเรียนนี้อยู่ในระบบแล้ว" };
  }

  const sheet = SS.getSheetByName("Classes");
  sheet.appendRow([
    classId,
    body.gradeLevel,
    body.roomNumber,
    body.academicYearId,
    body.homeroomTeacherUserId || "",
    body.homeroomTeacherUserId2 || "",
    0,
  ]);

  CacheService.getScriptCache().remove("classesPageData");
  invalidateSheetCache("Classes");
  return { status: "success", message: "เพิ่มห้องเรียนเรียบร้อยแล้ว" };
  }

/**
 * แก้ไขห้องเรียน (แก้ได้เฉพาะครูประจำชั้น ไม่ให้แก้ระดับชั้น/ห้องที่/ปีการศึกษา
 * เพราะเป็นส่วนประกอบของ ClassID)
 */
function handleUpdateClass(body) {
  if (!body.classId) {
    return { status: "error", message: "ไม่พบห้องเรียนที่ต้องการแก้ไข" };
  }

  const rowIndex = findRowIndexByColumnValue("Classes", "ClassID", body.classId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบห้องเรียนนี้ในระบบ" };
  }

  const sheet = SS.getSheetByName("Classes");
  const existing = sheet.getRange(rowIndex, 1, 1, 7).getValues()[0];

  sheet.getRange(rowIndex, 1, 1, 7).setValues([[
    existing[0], // ClassID เดิม
    existing[1], // GradeLevel เดิม
    existing[2], // RoomNumber เดิม
    existing[3], // AcademicYearID เดิม
    body.homeroomTeacherUserId || "",
    body.homeroomTeacherUserId2 || "",
    existing[6], // StudentCount เดิม
  ]]);

  CacheService.getScriptCache().remove("classesPageData");
  invalidateSheetCache("Classes");
  return { status: "success", message: "แก้ไขห้องเรียนเรียบร้อยแล้ว" };
  }

/**
 * ลบห้องเรียน
 */
function handleDeleteClass(body) {
  const classId = typeof body === "object" ? body.classId : body;
  const force = typeof body === "object" && !!body.force;

  if (!classId) {
    return { status: "error", message: "ไม่พบห้องเรียนที่ต้องการลบ" };
  }

  const rowIndex = findRowIndexByColumnValue("Classes", "ClassID", classId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบห้องเรียนนี้ในระบบ" };
  }

  if (!force) {
    const enrollmentCount = getSheetData("StudentEnrollments").filter((e) => String(e.ClassID) === String(classId)).length;
    const assignmentCount = getSheetData("TeachingAssignments").filter((a) => String(a.ClassID) === String(classId)).length;
    const scoreCount = getStudentScoresWhere({ ClassID: classId }, true);
    const finalResultCount = getSheetData("FinalResults").filter((r) => String(r.ClassID) === String(classId)).length;

    if (enrollmentCount > 0 || assignmentCount > 0 || scoreCount > 0 || finalResultCount > 0) {
      const parts = [];
      if (enrollmentCount > 0) parts.push(`นักเรียนที่ลงทะเบียน ${enrollmentCount} คน`);
      if (assignmentCount > 0) parts.push(`การมอบหมายการสอน ${assignmentCount} รายการ`);
      if (scoreCount > 0) parts.push(`คะแนนที่กรอกไว้แล้ว ${scoreCount} รายการ`);
      if (finalResultCount > 0) parts.push(`ผลการเรียนที่ตัดสินแล้ว ${finalResultCount} รายการ`);

      return {
        status: "confirm_required",
        message: `ห้องเรียนนี้มี${parts.join(", ")} ผูกอยู่ หากลบห้องนี้ ข้อมูลดังกล่าวจะไม่ถูกลบไปด้วย แต่จะกลายเป็นข้อมูลที่ไม่มีห้องเรียนอ้างอิงอยู่ ต้องการดำเนินการลบต่อหรือไม่`,
      };
    }
  }

  SS.getSheetByName("Classes").deleteRow(rowIndex);

  CacheService.getScriptCache().remove("classesPageData");
  invalidateSheetCache("Classes");
  return { status: "success", message: "ลบห้องเรียนเรียบร้อยแล้ว" };
  }



function handleGetClassesPageData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("classesPageData");
  if (cached) {
    return { status: "success", data: JSON.parse(cached) };
  }

  const academicYears = getSheetData("AcademicYears");
  academicYears.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));

  const users = getCachedSheetData("Users", 300);
  const userRoles = getCachedSheetData("UserRoles", 300);
  const homeroomUserIds = userRoles.filter((r) => r.RoleType === "HOMEROOM_TEACHER").map((r) => r.UserID);
  const homeroomTeachers = users
    .filter((u) => homeroomUserIds.indexOf(u.UserID) !== -1)
    .map((u) => ({ userId: u.UserID, fullName: u.FullName, position: u.Position }));

  // จำนวนนักเรียนในห้อง นับเฉพาะนักเรียนที่ "กำลังศึกษา" (ไม่ใช้ค่า StudentCount ที่เก็บไว้ในชีต เพราะไม่ตามการเปลี่ยนสถานะนักเรียน)
  const activeCountByClass = {};
  getActiveEnrollments().forEach((e) => {
    const k = String(e.ClassID);
    activeCountByClass[k] = (activeCountByClass[k] || 0) + 1;
  });
  const classes = getCachedSheetData("Classes", 60).map((c) =>
    Object.assign({}, c, { StudentCount: activeCountByClass[String(c.ClassID)] || 0 })
  );

  const data = { academicYears, homeroomTeachers, classes };
  cache.put("classesPageData", JSON.stringify(data), 120); // แคชสั้นกว่ารายวิชา เพราะ StudentCount เปลี่ยนบ่อยกว่า
  return { status: "success", data };
}


function handleGetEnrollmentsByClass(classId) {
  const enrollments = getSheetData("StudentEnrollments").filter((e) => String(e.ClassID) === String(classId));
  const students = getSheetData("Students");

  const merged = enrollments.map((e) => {
    const s = students.find((st) => String(st.StudentID) === String(e.StudentID)) || {};
    return {
      enrollmentId: e.EnrollmentID,
      studentId: e.StudentID,
      studentNumber: e.StudentNumber,
      fullName: (s.PrefixName || "") + (s.FirstName || "") + " " + (s.LastName || ""),
    };
  });

  merged.sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));
  return { status: "success", data: merged };
}


function handleGetEnrollmentsPageData() {
  const academicYears = getSheetData("AcademicYears");
  academicYears.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));

  const classes = getCachedSheetData("Classes", 60);

  return { status: "success", data: { academicYears, classes } };
}


function handleGetAvailableStudents(academicYearId) {
  const enrollments = getSheetData("StudentEnrollments").filter(
    (e) => String(e.AcademicYearID) === String(academicYearId)
  );
  const enrolledIds = enrollments.map((e) => String(e.StudentID));

  const students = getSheetData("Students").filter(
    (s) => s.Status === "กำลังศึกษา" && enrolledIds.indexOf(String(s.StudentID)) === -1
  );

  const sanitized = students.map((s) => ({
    studentId: s.StudentID,
    fullName: (s.PrefixName || "") + (s.FirstName || "") + " " + (s.LastName || ""),
  }));

  return { status: "success", data: sanitized };
}



function handleAddEnrollment(body) {
  if (!body.studentId || !body.classId || !body.academicYearId || !body.studentNumber) {
    return { status: "error", message: "กรุณาเลือกนักเรียนและระบุเลขที่ให้ครบถ้วน" };
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const sheet = SS.getSheetByName("StudentEnrollments");
    const enrollments = getSheetData("StudentEnrollments");

    const dupStudentYear = enrollments.some(
      (e) => String(e.StudentID) === String(body.studentId) && String(e.AcademicYearID) === String(body.academicYearId)
    );
    if (dupStudentYear) {
      return { status: "error", message: "นักเรียนคนนี้ถูกจัดเข้าห้องเรียนในปีการศึกษานี้แล้ว" };
    }

    const dupNumber = enrollments.some(
      (e) => String(e.ClassID) === String(body.classId) && String(e.StudentNumber) === String(body.studentNumber)
    );
    if (dupNumber) {
      return { status: "error", message: "เลขที่นี้มีนักเรียนคนอื่นใช้อยู่แล้วในห้องนี้" };
    }

    const enrollmentId = "ENR-" + new Date().getTime();
    sheet.appendRow([enrollmentId, body.studentId, body.classId, body.academicYearId, body.studentNumber]);

    adjustClassStudentCount(body.classId, 1);

    invalidateSheetCache("StudentEnrollments");
    return { status: "success", message: "เพิ่มนักเรียนเข้าห้องเรียนสำเร็จ" };
  } finally {
    lock.releaseLock();
  }
}


function handleAddEnrollmentsBulk(body) {
  if (!body.studentIds || !Array.isArray(body.studentIds) || body.studentIds.length === 0 || !body.classId || !body.academicYearId) {
    return { status: "error", message: "กรุณาเลือกนักเรียนอย่างน้อย 1 คน" };
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const sheet = SS.getSheetByName("StudentEnrollments");
    const enrollments = getSheetData("StudentEnrollments");

    // กันข้อมูลซ้ำ: ตัดคนที่ถูกจัดห้องในปีนี้ไปแล้วออก (เผื่อเปิดโมดัลค้างไว้)
    const alreadyEnrolledIds = enrollments
      .filter((e) => String(e.AcademicYearID) === String(body.academicYearId))
      .map((e) => String(e.StudentID));

    let selectedIds = body.studentIds.filter((id) => alreadyEnrolledIds.indexOf(String(id)) === -1);

    if (selectedIds.length === 0) {
      return { status: "error", message: "นักเรียนที่เลือกถูกจัดเข้าห้องเรียนในปีการศึกษานี้ไปแล้วทั้งหมด" };
    }

    // เรียงลำดับตามเลขประจำตัวนักเรียนจากน้อยไปมาก
    selectedIds.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

    // หาเลขที่เริ่มต้น = เลขที่มากสุดในห้องนี้ + 1
    const currentNumbersInClass = enrollments
      .filter((e) => String(e.ClassID) === String(body.classId))
      .map((e) => Number(e.StudentNumber) || 0);
    let nextNumber = currentNumbersInClass.length > 0 ? Math.max(...currentNumbersInClass) + 1 : 1;

    selectedIds.forEach((studentId) => {
      const enrollmentId = "ENR-" + new Date().getTime() + "-" + studentId;
      sheet.appendRow([enrollmentId, studentId, body.classId, body.academicYearId, nextNumber]);
      nextNumber++;
    });

    adjustClassStudentCount(body.classId, selectedIds.length);

    invalidateSheetCache("StudentEnrollments");
    return { status: "success", message: `เพิ่มนักเรียนเข้าห้องเรียนสำเร็จ ${selectedIds.length} คน` };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateEnrollmentNumber(body) {
  if (!body.enrollmentId || !body.studentNumber) {
    return { status: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const enrollments = getSheetData("StudentEnrollments");
    const target = enrollments.find((e) => String(e.EnrollmentID) === String(body.enrollmentId));
    if (!target) {
      return { status: "error", message: "ไม่พบข้อมูลการลงทะเบียนนี้" };
    }

    const dupNumber = enrollments.some(
      (e) =>
        String(e.ClassID) === String(target.ClassID) &&
        String(e.StudentNumber) === String(body.studentNumber) &&
        String(e.EnrollmentID) !== String(body.enrollmentId)
    );
    if (dupNumber) {
      return { status: "error", message: "เลขที่นี้มีนักเรียนคนอื่นใช้อยู่แล้วในห้องนี้" };
    }

    const rowIndex = findRowIndexByColumnValue("StudentEnrollments", "EnrollmentID", body.enrollmentId);
    if (rowIndex === -1) {
      return { status: "error", message: "ไม่พบข้อมูลการลงทะเบียนนี้" };
    }

    SS.getSheetByName("StudentEnrollments").getRange(rowIndex, 5).setValue(body.studentNumber);
    invalidateSheetCache("StudentEnrollments");
    return { status: "success", message: "แก้ไขเลขที่สำเร็จ" };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteEnrollment(enrollmentId) {
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const enrollments = getSheetData("StudentEnrollments");
    const target = enrollments.find((e) => String(e.EnrollmentID) === String(enrollmentId));
    if (!target) {
      return { status: "error", message: "ไม่พบข้อมูลการลงทะเบียนนี้" };
    }

    const rowIndex = findRowIndexByColumnValue("StudentEnrollments", "EnrollmentID", enrollmentId);
    if (rowIndex === -1) {
      return { status: "error", message: "ไม่พบข้อมูลการลงทะเบียนนี้" };
    }

    SS.getSheetByName("StudentEnrollments").deleteRow(rowIndex);
    adjustClassStudentCount(target.ClassID, -1);

    invalidateSheetCache("StudentEnrollments");
    return { status: "success", message: "นำนักเรียนออกจากห้องเรียนสำเร็จ" };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ปรับจำนวนนักเรียนในห้อง (StudentCount) ขึ้น/ลง
 * ฟังก์ชันนี้ไม่มี LockService ของตัวเอง เพราะถูกเรียกใช้จากภายในฟังก์ชันที่ถือ Lock ไว้อยู่แล้วเสมอ
 * (handleAddEnrollment, handleAddEnrollmentsBulk, handleDeleteEnrollment) ห้ามเรียกใช้นอกเหนือจาก
 * ภายใต้ Lock เพราะจะเสี่ยงต่อการอ่าน/เขียนค่าทับกันเมื่อมีการลงทะเบียนพร้อมกันหลายคำขอ
 */
function adjustClassStudentCount(classId, delta) {
  const rowIndex = findRowIndexByColumnValue("Classes", "ClassID", classId);
  if (rowIndex === -1) return;

  const sheet = SS.getSheetByName("Classes");
  const currentCount = Number(sheet.getRange(rowIndex, 7).getValue()) || 0;
  const newCount = Math.max(0, currentCount + delta);
  sheet.getRange(rowIndex, 7).setValue(newCount);
  CacheService.getScriptCache().remove("classesPageData");
  invalidateSheetCache("Classes");
}


function handleGetTeachingAssignmentsPageData() {
  const academicYears = getSheetData("AcademicYears");
  academicYears.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));

  const classes = getCachedSheetData("Classes", 60);
  const subjects = handleGetSubjects().data;

  const users = getCachedSheetData("Users", 300);
  const userRoles = getCachedSheetData("UserRoles", 300);
  const subjectTeacherUserIds = userRoles
    .filter((r) => r.RoleType === "SUBJECT_TEACHER")
    .map((r) => r.UserID);
  const teachers = users
    .filter((u) => subjectTeacherUserIds.indexOf(u.UserID) !== -1)
    .map((u) => ({ userId: u.UserID, fullName: u.FullName, position: u.Position }));

  const assignments = getSheetData("TeachingAssignments");

  return {
    status: "success",
    data: { academicYears, classes, subjects, teachers, assignments },
  };
}

function handleAddTeachingAssignment(body) {
  const classId = body.classId;
  const subjectId = body.subjectId;
  const academicYearId = body.academicYearId;
  const teacherUserId = body.teacherUserId;

  if (!classId || !subjectId || !academicYearId || !teacherUserId) {
    return { status: "error", message: "กรุณาระบุข้อมูลให้ครบถ้วน" };
  }

  // ล็อกกันข้อมูลชนกันตอนมีการมอบหมายการสอนพร้อมกันหลายรายการ (เช่น เพิ่มครูสอนวิชาเดียวกันพร้อมกัน)
  // และกันแคช TeachingAssignments ที่ครูประจำวิชาใช้ตรวจสอบสิทธิ์ทุก request ไม่ตรงกับข้อมูลจริง
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const assignments = getSheetData("TeachingAssignments");

    const sameGroup = assignments.filter(
      (a) =>
        String(a.ClassID) === String(classId) &&
        String(a.SubjectID) === String(subjectId) &&
        String(a.AcademicYearID) === String(academicYearId)
    );

    const duplicate = sameGroup.find((a) => String(a.TeacherUserID) === String(teacherUserId));
    if (duplicate) {
      return { status: "error", message: "ครูคนนี้ถูกมอบหมายให้สอนวิชานี้ในห้องนี้อยู่แล้ว" };
    }

    if (sameGroup.length >= 4) {
      return { status: "error", message: "วิชานี้ในห้องนี้มีครูผู้สอนครบ 4 คนแล้ว" };
    }

    let maxNum = 0;
    assignments.forEach((a) => {
      const match = String(a.TeachingAssignmentID).match(/^TA(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    const newId = "TA" + String(maxNum + 1).padStart(4, "0");

    SS.getSheetByName("TeachingAssignments").appendRow([newId, academicYearId, classId, subjectId, teacherUserId]);
    invalidateSheetCache("TeachingAssignments");

    return { status: "success", data: { teachingAssignmentId: newId } };
  } finally {
    lock.releaseLock();
  }
}

/**
 * เพิ่มมอบหมายการสอนหลายห้องพร้อมกันในครั้งเดียว (ครู 1 คน + วิชา 1 วิชา + ห้องที่สอนหลายห้อง)
 * ตรวจสอบฝั่ง Server ครบทุกเงื่อนไข ไม่พึ่งพาการกรองข้อมูลจากฝั่งเว็บอย่างเดียว:
 * - ห้องเรียนต้องมีอยู่จริงและอยู่ในปีการศึกษาที่ระบุ
 * - ระดับชั้นของห้องต้องตรงกับระดับชั้นของวิชา
 * - ไม่ซ้ำกับที่มอบหมายไว้แล้ว และไม่เกิน 4 คนต่อวิชา/ห้อง
 * ห้องที่ไม่ผ่านเงื่อนไขจะถูกข้าม (ไม่ทำให้ทั้งคำขอ error) พร้อมแจ้งเหตุผลกลับไปให้ผู้ใช้เห็น
 */
function handleAddTeachingAssignmentsBulk(body) {
  const academicYearId = body.academicYearId;
  const subjectId = body.subjectId;
  const teacherUserId = body.teacherUserId;
  const classIds = body.classIds;

  if (!academicYearId || !subjectId || !teacherUserId || !Array.isArray(classIds) || classIds.length === 0) {
    return { status: "error", message: "กรุณาระบุครู วิชา และห้องที่สอนให้ครบถ้วน" };
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const subjects = getSheetData("Subjects");
    const subject = subjects.find((s) => String(s.SubjectID) === String(subjectId));
    if (!subject) {
      return { status: "error", message: "ไม่พบวิชานี้ในระบบ" };
    }

    const classes = getSheetData("Classes");
    const assignments = getSheetData("TeachingAssignments");

    let maxNum = 0;
    assignments.forEach((a) => {
      const match = String(a.TeachingAssignmentID).match(/^TA(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });

    const newRows = [];
    const skipped = [];
    const addedCountByClass = {}; // กันกรณีห้องเดียวกันถูกส่งซ้ำมาในคำขอเดียว

    classIds.forEach((classId) => {
      const cls = classes.find((c) => String(c.ClassID) === String(classId));

      if (!cls || String(cls.AcademicYearID) !== String(academicYearId)) {
        skipped.push(classId + " (ไม่พบห้องเรียนนี้ในปีการศึกษาที่ระบุ)");
        return;
      }
      if (String(cls.GradeLevel) !== String(subject.GradeLevel)) {
        skipped.push(`${cls.GradeLevel}/${cls.RoomNumber} (ระดับชั้นไม่ตรงกับวิชา)`);
        return;
      }

      const sameGroup = assignments.filter(
        (a) =>
          String(a.ClassID) === String(classId) &&
          String(a.SubjectID) === String(subjectId) &&
          String(a.AcademicYearID) === String(academicYearId)
      );

      if (sameGroup.some((a) => String(a.TeacherUserID) === String(teacherUserId))) {
        skipped.push(`${cls.GradeLevel}/${cls.RoomNumber} (ครูคนนี้ถูกมอบหมายไว้แล้ว)`);
        return;
      }

      const currentCount = sameGroup.length + (addedCountByClass[classId] || 0);
      if (currentCount >= 4) {
        skipped.push(`${cls.GradeLevel}/${cls.RoomNumber} (มีครูผู้สอนครบ 4 คนแล้ว)`);
        return;
      }

      maxNum += 1;
      const newId = "TA" + String(maxNum).padStart(4, "0");
      newRows.push([newId, academicYearId, classId, subjectId, teacherUserId]);
      addedCountByClass[classId] = currentCount + 1;
    });

    if (newRows.length > 0) {
      const sheet = SS.getSheetByName("TeachingAssignments");
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, newRows.length, 5).setValues(newRows);
      invalidateSheetCache("TeachingAssignments");
    }

    const message =
      newRows.length > 0
        ? `มอบหมายสำเร็จ ${newRows.length} ห้อง` + (skipped.length > 0 ? ` (ข้าม ${skipped.length} ห้อง: ${skipped.join(", ")})` : "")
        : `ไม่สามารถมอบหมายห้องใดได้เลย: ${skipped.join(", ")}`;

    return {
      status: newRows.length > 0 ? "success" : "error",
      message: message,
      data: { addedCount: newRows.length, skipped: skipped },
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * นำมอบหมายการสอนออก
 * ถ้าวิชา/ห้อง/ปีนี้มีคะแนนที่กรอกไว้แล้ว (StudentScores) จะยังไม่ลบทันที แต่ตอบกลับ status "confirm_required"
 * พร้อมข้อความเตือนจำนวนคะแนนที่พบ ให้ฝั่งเว็บถามยืนยันอีกครั้งก่อนส่งซ้ำพร้อม force: true
 * (ข้อมูลคะแนนจะไม่ถูกลบไปด้วย เพียงแต่ครูจะเข้าถึงไม่ได้จนกว่าจะมอบหมายให้ใหม่)
 */
/**
 * แก้ไขข้อมูลมอบหมายการสอนที่มีอยู่แล้ว (เปลี่ยนครู/วิชา/ห้อง/ปีการศึกษาของแถวเดิมได้)
 * body: { teachingAssignmentId, academicYearId, classId, subjectId, teacherUserId, force }
 * - ถ้าเปลี่ยนวิชา/ห้อง/ปีการศึกษาไปจากเดิม และของเดิมมีคะแนนกรอกไว้แล้ว ต้องส่ง force:true มายืนยันอีกครั้ง
 *   (คะแนนอ้างอิงตาม ClassID/SubjectID/AcademicYearID ไม่ใช่ TeachingAssignmentID
 *    เปลี่ยนแล้วจะเข้าถึงคะแนนชุดเดิมไม่ได้ทันที แต่ข้อมูลคะแนนจะไม่ถูกลบ)
 */
function handleUpdateTeachingAssignment(body) {
  const teachingAssignmentId = body.teachingAssignmentId;
  const academicYearId = body.academicYearId;
  const classId = body.classId;
  const subjectId = body.subjectId;
  const teacherUserId = body.teacherUserId;
  const force = !!body.force;

  if (!teachingAssignmentId || !academicYearId || !classId || !subjectId || !teacherUserId) {
    return { status: "error", message: "กรุณาระบุข้อมูลให้ครบถ้วน" };
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const assignments = getSheetData("TeachingAssignments");
    const original = assignments.find((a) => String(a.TeachingAssignmentID) === String(teachingAssignmentId));
    if (!original) {
      return { status: "error", message: "ไม่พบข้อมูลมอบหมายการสอนนี้" };
    }

    const classes = getSheetData("Classes");
    const cls = classes.find((c) => String(c.ClassID) === String(classId));
    if (!cls || String(cls.AcademicYearID) !== String(academicYearId)) {
      return { status: "error", message: "ไม่พบห้องเรียนนี้ในปีการศึกษาที่ระบุ" };
    }

    const subjects = getSheetData("Subjects");
    const subject = subjects.find((s) => String(s.SubjectID) === String(subjectId));
    if (!subject) {
      return { status: "error", message: "ไม่พบวิชานี้ในระบบ" };
    }
    if (String(cls.GradeLevel) !== String(subject.GradeLevel)) {
      return { status: "error", message: "ระดับชั้นของห้องเรียนไม่ตรงกับวิชาที่เลือก" };
    }

    const sameGroup = assignments.filter(
      (a) =>
        String(a.TeachingAssignmentID) !== String(teachingAssignmentId) &&
        String(a.ClassID) === String(classId) &&
        String(a.SubjectID) === String(subjectId) &&
        String(a.AcademicYearID) === String(academicYearId)
    );
    if (sameGroup.some((a) => String(a.TeacherUserID) === String(teacherUserId))) {
      return { status: "error", message: "ครูคนนี้ถูกมอบหมายไว้แล้วสำหรับวิชา/ห้องนี้" };
    }
    if (sameGroup.length >= 4) {
      return { status: "error", message: "ห้องเรียนนี้มีครูผู้สอนวิชานี้ครบ 4 คนแล้ว" };
    }

    const scopeChanged =
      String(original.ClassID) !== String(classId) ||
      String(original.SubjectID) !== String(subjectId) ||
      String(original.AcademicYearID) !== String(academicYearId);

    if (scopeChanged && !force) {
      const scoreCount = getStudentScoresWhere(
        { ClassID: original.ClassID, SubjectID: original.SubjectID, AcademicYearID: original.AcademicYearID },
        true
      );

      if (scoreCount > 0) {
        return {
          status: "confirm_required",
          message: `วิชา/ห้องเดิมมีคะแนนที่กรอกไว้แล้ว ${scoreCount} รายการ หากเปลี่ยนวิชา/ห้อง/ปีการศึกษา จะเข้าถึงคะแนนชุดเดิมไม่ได้ทันที (ข้อมูลจะไม่ถูกลบ จะกลับมาเห็นได้ถ้ามอบหมายกลับค่าเดิมอีกครั้ง) ต้องการดำเนินการต่อหรือไม่`,
        };
      }
    }

    const rowIndex = findRowIndexByColumnValue("TeachingAssignments", "TeachingAssignmentID", teachingAssignmentId);
    if (rowIndex === -1) {
      return { status: "error", message: "ไม่พบข้อมูลมอบหมายการสอนนี้" };
    }

    SS.getSheetByName("TeachingAssignments")
      .getRange(rowIndex, 1, 1, 5)
      .setValues([[teachingAssignmentId, academicYearId, classId, subjectId, teacherUserId]]);

    invalidateSheetCache("TeachingAssignments");
    return { status: "success", message: "บันทึกการแก้ไขเรียบร้อยแล้ว" };
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteTeachingAssignment(body) {
  const teachingAssignmentId = body.teachingAssignmentId;
  const force = !!body.force;

  if (!teachingAssignmentId) {
    return { status: "error", message: "ไม่พบข้อมูลมอบหมายการสอนนี้" };
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const assignments = getSheetData("TeachingAssignments");
    const target = assignments.find((a) => String(a.TeachingAssignmentID) === String(teachingAssignmentId));

    if (!target) {
      return { status: "error", message: "ไม่พบข้อมูลมอบหมายการสอนนี้" };
    }

    if (!force) {
      const scoreCount = getStudentScoresWhere(
        { ClassID: target.ClassID, SubjectID: target.SubjectID, AcademicYearID: target.AcademicYearID },
        true
      );

      if (scoreCount > 0) {
        return {
          status: "confirm_required",
          message: `วิชา/ห้องนี้มีคะแนนที่กรอกไว้แล้ว ${scoreCount} รายการ หากนำครูออก จะเข้าถึงคะแนนเหล่านี้ไม่ได้ทันที (ข้อมูลจะไม่ถูกลบ จะกลับมาเห็นได้ถ้ามอบหมายให้ใหม่อีกครั้ง) ต้องการดำเนินการต่อหรือไม่`,
        };
      }
    }

    const rowIndex = findRowIndexByColumnValue("TeachingAssignments", "TeachingAssignmentID", teachingAssignmentId);
    if (rowIndex === -1) {
      return { status: "error", message: "ไม่พบข้อมูลมอบหมายการสอนนี้" };
    }

    SS.getSheetByName("TeachingAssignments").deleteRow(rowIndex);
    invalidateSheetCache("TeachingAssignments");
    return { status: "success" };
  } finally {
    lock.releaseLock();
  }
}


function handleGetTeacherSubjectsPageData(userId) {
  // ใช้ข้อมูลปีการศึกษา/รายวิชาที่แคชไว้แล้วจาก handleGetAcademicYears()/handleGetSubjects() แทนการอ่านทั้งชีตซ้ำ
  const academicYears = handleGetAcademicYears().data;

  const myAssignments = getCachedSheetData("TeachingAssignments", 120).filter(
    (a) => String(a.TeacherUserID) === String(userId)
  );

  const classes = getSheetData("Classes");
  const subjects = handleGetSubjects().data;

  const assignments = myAssignments.map((a) => {
    const cls = classes.find((c) => String(c.ClassID) === String(a.ClassID));
    const subj = subjects.find((s) => String(s.SubjectID) === String(a.SubjectID));
    return {
      teachingAssignmentId: a.TeachingAssignmentID,
      academicYearId: a.AcademicYearID,
      classId: a.ClassID,
      className: cls ? cls.GradeLevel + "/" + cls.RoomNumber : a.ClassID,
      subjectId: a.SubjectID,
      subjectName: subj ? subj.SubjectName : a.SubjectID,
    };
  });

  return {
    status: "success",
    data: { academicYears, assignments },
  };
}

/**
 * ดึงโครงสร้างการเก็บคะแนน (หน่วย + ปลายภาค) ของวิชา/ปีการศึกษา/ภาคเรียนที่ระบุ
 * ถ้ายังไม่เคยตั้งค่ามาก่อน จะสร้างค่าเริ่มต้นให้อัตโนมัติ (4 หน่วย + ปลายภาค)
 * ต้องเป็นครูที่ได้รับมอบหมายให้สอนวิชานี้ในปีการศึกษานี้เท่านั้นจึงจะเข้าถึงได้
 */
function handleGetGradeSetup(body) {
  const subjectId = body.subjectId;
  const academicYearId = body.academicYearId;
  const semester = Number(body.semester);

  if (!isAssignedToTeach(body.userId, subjectId, academicYearId)) {
    return { status: "error", message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลวิชานี้" };
  }

  const sheet = SS.getSheetByName("GradeComponents");
  let components = getCachedSheetData("GradeComponents", 120).filter(
    (c) =>
      String(c.SubjectID) === String(subjectId) &&
      String(c.AcademicYearID) === String(academicYearId) &&
      Number(c.Semester) === semester
  );

  if (components.length === 0) {
    // ล็อกกันไม่ให้สร้างชุดค่าเริ่มต้น (4 หน่วย + ปลายภาค) ซ้ำซ้อน กรณีเปิดหลายหน้าพร้อมกัน
    // (บันทึกคะแนน/ตัดสินผลการเรียน/ออกรายงาน ต่างก็เรียกฟังก์ชันนี้ และอาจมาถึงพร้อมกันในครั้งแรกที่ยังไม่เคยตั้งค่า)
    const lock = LockService.getScriptLock();
    const gotLock = lock.tryLock(20000);
    if (!gotLock) {
      return { status: "error", message: "ขณะนี้มีผู้ใช้งานเข้าถึงข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
    }

    try {
      // เช็คซ้ำอีกครั้งด้วยข้อมูลสดหลังได้ล็อกแล้ว เผื่อมีคำขออื่นสร้างข้อมูลเสร็จไปก่อนระหว่างที่รอคิว
      components = getSheetData("GradeComponents").filter(
        (c) =>
          String(c.SubjectID) === String(subjectId) &&
          String(c.AcademicYearID) === String(academicYearId) &&
          Number(c.Semester) === semester
      );

      if (components.length === 0) {
        const startOrder = semester === 1 ? 1 : 5;
        const allComponents = getSheetData("GradeComponents");
        let maxNum = 0;
        allComponents.forEach((c) => {
          const match = String(c.ComponentID).match(/^GC(\d+)$/);
          if (match) {
            const n = parseInt(match[1], 10);
            if (n > maxNum) maxNum = n;
          }
        });

        for (let i = 0; i < 4; i++) {
          maxNum++;
          const order = startOrder + i;
          sheet.appendRow([
            "GC" + String(maxNum).padStart(5, "0"),
            academicYearId,
            subjectId,
            semester,
            "หน่วย",
            order,
            "หน่วยที่ " + order,
            10,
          ]);
        }
        maxNum++;
        sheet.appendRow([
          "GC" + String(maxNum).padStart(5, "0"),
          academicYearId,
          subjectId,
          semester,
          "ปลายภาค",
          "",
          "ปลายภาคเรียนที่ " + semester,
          30,
        ]);

        invalidateSheetCache("GradeComponents");

        components = getSheetData("GradeComponents").filter(
          (c) =>
            String(c.SubjectID) === String(subjectId) &&
            String(c.AcademicYearID) === String(academicYearId) &&
            Number(c.Semester) === semester
        );
      }
    } finally {
      lock.releaseLock();
    }
  }

  const subComponents = getCachedSheetData("GradeSubComponents", 60);

  const componentsWithSub = components
    .sort((a, b) => {
      if (a.ComponentType !== b.ComponentType) return a.ComponentType === "หน่วย" ? -1 : 1;
      return Number(a.ComponentOrder || 0) - Number(b.ComponentOrder || 0);
    })
    .map((c) => ({
      componentId: c.ComponentID,
      componentType: c.ComponentType,
      componentOrder: c.ComponentOrder,
      componentName: c.ComponentName,
      maxScore: c.MaxScore,
      subComponents: subComponents
        .filter((sc) => String(sc.ComponentID) === String(c.ComponentID))
        .sort((a, b) => Number(a.OrderIndex || 0) - Number(b.OrderIndex || 0))
        .map((sc) => ({
          subComponentId: sc.SubComponentID,
          subComponentName: sc.SubComponentName,
          maxScore: sc.MaxScore,
        })),
    }));

  return { status: "success", data: componentsWithSub };
}

/**
 * เพิ่มช่องเก็บคะแนนย่อยในหน่วยที่ระบุ ต้องเป็นครูที่สอนวิชานี้จริงเท่านั้น
 */
function handleAddGradeSubComponent(body) {
  const componentId = body.componentId;
  const subComponentName = String(body.subComponentName || "").trim();
  const maxScore = 10;

  if (!subComponentName) {
    return { status: "error", message: "กรุณาระบุชื่อช่องเก็บคะแนน" };
  }

  const component = getSheetData("GradeComponents").find((c) => String(c.ComponentID) === String(componentId));
  if (!component) {
    return { status: "error", message: "ไม่พบหน่วยการเรียนรู้นี้" };
  }
  if (!isAssignedToTeach(body.userId, component.SubjectID, component.AcademicYearID)) {
    return { status: "error", message: "คุณไม่มีสิทธิ์แก้ไขข้อมูลวิชานี้" };
  }

  // ห้ามแก้โครงสร้างช่องเก็บคะแนน (เพิ่ม/ลบ) ถ้าภาคเรียนนี้ของวิชานี้มีห้องใดห้องหนึ่ง "ส่งผลการเรียน" ไปแล้ว
  // (GradeComponents/GradeSubComponents ใช้ร่วมกันทุกห้องของวิชา/ปี/ภาคเรียนเดียวกัน ไม่ได้แยกตามห้อง จึงต้องเช็คทุกห้อง)
  if (isSemesterSubmittedForAnyClass(component.SubjectID, component.AcademicYearID, component.Semester)) {
    return {
      status: "error",
      message: `ไม่สามารถแก้ไขโครงสร้างช่องเก็บคะแนนได้ เนื่องจากภาคเรียนที่ ${component.Semester} ของวิชานี้มีบางห้อง "ส่งผลการเรียน" ไปแล้ว กรุณา "ถอนผลการเรียน" ของห้องนั้นก่อน จึงจะแก้ไขโครงสร้างคะแนนได้`,
    };
  }

  // เพิ่ม/ลบช่องเก็บคะแนนได้เฉพาะในช่วงเวลาที่นายทะเบียนเปิดให้บันทึกคะแนนของภาคเรียนนั้น (7 ต.ค. 2569)
  if (!isGradingPeriodOpen(component.AcademicYearID, component.Semester)) {
    return { status: "error", message: GRADE_STRUCTURE_PERIOD_CLOSED_MESSAGE };
  }

  // ล็อกกันช่องเก็บคะแนนซ้ำรหัส/เกิน 10 ช่อง กรณีกดเพิ่มพร้อมกัน (เช่น กดปุ่มรัว หรือเปิดหลายแท็บ)
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    // เช็คซ้ำอีกครั้งหลังได้ lock แล้ว เผื่อมีการส่งผลการเรียนแทรกเข้ามาระหว่างรอคิว
    if (isSemesterSubmittedForAnyClass(component.SubjectID, component.AcademicYearID, component.Semester)) {
      return {
        status: "error",
        message: `ไม่สามารถแก้ไขโครงสร้างช่องเก็บคะแนนได้ เนื่องจากภาคเรียนที่ ${component.Semester} ของวิชานี้มีบางห้อง "ส่งผลการเรียน" ไปแล้ว กรุณา "ถอนผลการเรียน" ของห้องนั้นก่อน จึงจะแก้ไขโครงสร้างคะแนนได้`,
      };
    }

    const allSub = getSheetData("GradeSubComponents");
    const existing = allSub.filter((sc) => String(sc.ComponentID) === String(componentId));

    if (existing.length >= 10) {
      return { status: "error", message: "หน่วยนี้มีช่องเก็บคะแนนครบ 10 ช่องแล้ว" };
    }

    let maxNum = 0;
    allSub.forEach((sc) => {
      const match = String(sc.SubComponentID).match(/^GSC(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    const newId = "GSC" + String(maxNum + 1).padStart(5, "0");

    // ลำดับใหม่ = ลำดับมากสุดที่มีอยู่ + 1 (ไม่ใช้จำนวนช่อง เพราะลำดับอาจซ้ำถ้าเคยลบช่องกลาง)
    const nextOrder = existing.reduce((m, sc) => Math.max(m, Number(sc.OrderIndex) || 0), 0) + 1;
    SS.getSheetByName("GradeSubComponents").appendRow([newId, componentId, subComponentName, maxScore, nextOrder]);
    invalidateSheetCache("GradeSubComponents");

    return { status: "success", data: { subComponentId: newId } };
  } finally {
    lock.releaseLock();
  }
}

const GRADE_STRUCTURE_PERIOD_CLOSED_MESSAGE =
  "ไม่สามารถเพิ่ม/ลบช่องเก็บคะแนนได้ เนื่องจากยังไม่ถึง หรือพ้นช่วงเวลาที่นายทะเบียนกำหนดให้บันทึกคะแนนของภาคเรียนนี้แล้ว กรุณาติดต่อนายทะเบียนเพื่อขอเปิดช่วงเวลา";

/**
 * แก้ไขชื่อช่องเก็บคะแนน (เฉพาะชื่อ ไม่แตะรหัสช่อง/คะแนนที่บันทึกไว้) — 7 ต.ค. 2569
 * แก้ได้ตราบที่ภาคเรียนนั้นของวิชานี้ยังไม่ถูก "ส่งผลการเรียน" (ไม่ผูกกับช่วงเวลาบันทึกคะแนน เพราะไม่กระทบการคำนวณ)
 */
function handleUpdateGradeSubComponent(body) {
  const subComponentId = body.subComponentId;
  const newName = String(body.subComponentName || "").trim();

  if (!subComponentId) return { status: "error", message: "ไม่พบช่องเก็บคะแนนที่ต้องการแก้ไข" };
  if (!newName) return { status: "error", message: "กรุณาระบุชื่อช่องเก็บคะแนน" };
  if (newName.length > 100) return { status: "error", message: "ชื่อช่องเก็บคะแนนยาวเกินไป (ไม่เกิน 100 ตัวอักษร)" };

  const subComponent = getSheetData("GradeSubComponents").find((sc) => String(sc.SubComponentID) === String(subComponentId));
  if (!subComponent) return { status: "error", message: "ไม่พบช่องเก็บคะแนนนี้" };

  const component = getSheetData("GradeComponents").find((c) => String(c.ComponentID) === String(subComponent.ComponentID));
  if (!component || !isAssignedToTeach(body.userId, component.SubjectID, component.AcademicYearID)) {
    return { status: "error", message: "คุณไม่มีสิทธิ์แก้ไขข้อมูลวิชานี้" };
  }

  if (isSemesterSubmittedForAnyClass(component.SubjectID, component.AcademicYearID, component.Semester)) {
    return {
      status: "error",
      message: `ไม่สามารถแก้ไขชื่อช่องเก็บคะแนนได้ เนื่องจากภาคเรียนที่ ${component.Semester} ของวิชานี้ "ส่งผลการเรียน" ไปแล้ว`,
    };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    const sheet = SS.getSheetByName("GradeSubComponents");
    const data = sheet.getDataRange().getValues();
    const idCol = data[0].indexOf("SubComponentID");
    const nameCol = data[0].indexOf("SubComponentName");
    if (idCol === -1 || nameCol === -1) {
      return { status: "error", message: "ไม่พบคอลัมน์ในชีต GradeSubComponents กรุณาติดต่อผู้ดูแลระบบ" };
    }

    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idCol]).trim() === String(subComponentId).trim()) {
        sheet.getRange(r + 1, nameCol + 1).setValue(newName);
        invalidateSheetCache("GradeSubComponents");
        return { status: "success" };
      }
    }
    return { status: "error", message: "ไม่พบช่องเก็บคะแนนนี้" };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ลบช่องเก็บคะแนนย่อย ต้องเป็นครูที่สอนวิชานี้จริงเท่านั้น
 * 7 ต.ค. 2569: ถ้าช่องนี้มีคะแนนบันทึกไว้แล้ว ต้องยืนยัน (body.force = true) ก่อน — ครั้งแรกคืน status "needs_confirm" พร้อมจำนวนที่กระทบ
 * เมื่อลบจริง จะลบแถวคะแนนของช่องนั้นออกจากทุกห้องของวิชา/ภาคเรียนเดียวกันพร้อมกัน (ไม่ปล่อยคะแนนค้าง) และเรียงลำดับช่องที่เหลือใหม่เป็น 1,2,3...
 * เพิ่ม/ลบได้เฉพาะในช่วงเวลาที่นายทะเบียนเปิดให้บันทึกคะแนนของภาคเรียนนั้น
 */
function handleDeleteGradeSubComponent(body) {
  const subComponentId = body.subComponentId;
  const force = body.force === true;

  const subComponent = getSheetData("GradeSubComponents").find(
    (sc) => String(sc.SubComponentID) === String(subComponentId)
  );
  if (!subComponent) {
    return { status: "error", message: "ไม่พบช่องเก็บคะแนนนี้" };
  }

  const component = getSheetData("GradeComponents").find(
    (c) => String(c.ComponentID) === String(subComponent.ComponentID)
  );
  if (!component || !isAssignedToTeach(body.userId, component.SubjectID, component.AcademicYearID)) {
    return { status: "error", message: "คุณไม่มีสิทธิ์แก้ไขข้อมูลวิชานี้" };
  }

  const submittedMessage = `ไม่สามารถแก้ไขโครงสร้างช่องเก็บคะแนนได้ เนื่องจากภาคเรียนที่ ${component.Semester} ของวิชานี้ "ส่งผลการเรียน" ไปแล้ว (โครงสร้างช่องเก็บคะแนนใช้ร่วมกันทุกห้องของวิชา/ปี/ภาคเรียนเดียวกัน) กรุณา "ถอนผลการเรียน" ให้ครบทุกห้องก่อน`;

  // ห้ามแก้โครงสร้างช่องเก็บคะแนน (เพิ่ม/ลบ) ถ้าภาคเรียนนี้ของวิชานี้มีห้องใดส่งผลการเรียนไปแล้ว
  if (isSemesterSubmittedForAnyClass(component.SubjectID, component.AcademicYearID, component.Semester)) {
    return { status: "error", message: submittedMessage };
  }

  if (!isGradingPeriodOpen(component.AcademicYearID, component.Semester)) {
    return { status: "error", message: GRADE_STRUCTURE_PERIOD_CLOSED_MESSAGE };
  }

  // ยังไม่ยืนยัน: นับจำนวนคะแนนที่จะหายไปให้ครูเห็นก่อน (อ่านสด เพราะเป็นข้อมูลที่ครูเพิ่งกรอก)
  if (!force) {
    const affected = getStudentScoresWhere({ SubComponentID: subComponentId });
    if (affected.length > 0) {
      const studentSet = {};
      const classSet = {};
      affected.forEach((sc) => {
        studentSet[String(sc.StudentID)] = true;
        classSet[String(sc.ClassID)] = true;
      });
      return {
        status: "needs_confirm",
        message: "ช่องเก็บคะแนนนี้มีคะแนนที่บันทึกไว้แล้ว",
        data: {
          scoreCount: affected.length,
          studentCount: Object.keys(studentSet).length,
          classCount: Object.keys(classSet).length,
        },
      };
    }
  }

  // ล็อกกันการลบชนกัน (เช่น ครูที่สอนวิชาเดียวกันคนละห้องเปิดหน้านี้พร้อมกัน)
  // GradeComponents/GradeSubComponents ใช้ร่วมกันทุกห้องของวิชา/ปี/ภาคเรียนเดียวกัน
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    // เช็คซ้ำอีกครั้งหลังได้ lock แล้ว เผื่อมีการส่งผลการเรียนแทรกเข้ามาระหว่างรอคิว
    if (isSemesterSubmittedForAnyClass(component.SubjectID, component.AcademicYearID, component.Semester)) {
      return { status: "error", message: submittedMessage };
    }

    // หาตำแหน่งแถว "หลังได้ lock แล้ว" เท่านั้น (ข้อมูลสดล่าสุด ไม่ใช่ตำแหน่งเก่า)
    const subSheet = SS.getSheetByName("GradeSubComponents");
    const subData = subSheet.getDataRange().getValues();
    const subHeaders = subData[0];
    const subIdCol = subHeaders.indexOf("SubComponentID");
    const subCompCol = subHeaders.indexOf("ComponentID");
    const subOrderCol = subHeaders.indexOf("OrderIndex");

    let targetRow = -1;
    for (let r = 1; r < subData.length; r++) {
      if (String(subData[r][subIdCol]).trim() === String(subComponentId).trim()) {
        targetRow = r + 1;
        break;
      }
    }
    if (targetRow === -1) {
      return { status: "error", message: "ไม่พบช่องเก็บคะแนนนี้" };
    }

    // 1) ลบแถวคะแนนของช่องนี้ออกจากทุกห้องก่อน (กันคะแนนค้าง) แล้วจึงลบตัวช่อง
    const scoreSheet = SS.getSheetByName("StudentScores");
    const scoreData = scoreSheet.getDataRange().getValues();
    const scoreSubCol = scoreData[0].indexOf("SubComponentID");
    const scoreRowsToDelete = [];
    for (let r = 1; r < scoreData.length; r++) {
      if (String(scoreData[r][scoreSubCol]).trim() === String(subComponentId).trim()) scoreRowsToDelete.push(r + 1);
    }
    if (scoreRowsToDelete.length > 0) deleteSheetRowsDescending(scoreSheet, scoreRowsToDelete);

    subSheet.deleteRow(targetRow);

    // 2) เรียงลำดับ (OrderIndex) ของช่องที่เหลือในหน่วยเดียวกันใหม่เป็น 1,2,3...
    if (subOrderCol !== -1) {
      const remaining = [];
      for (let r = 1; r < subData.length; r++) {
        if (r + 1 === targetRow) continue;
        if (String(subData[r][subCompCol]) === String(subComponent.ComponentID)) {
          remaining.push({ oldRow: r + 1, order: Number(subData[r][subOrderCol]) || 0 });
        }
      }
      remaining.sort((a, b) => a.order - b.order || a.oldRow - b.oldRow);
      remaining.forEach((item, i) => {
        // แถวที่อยู่ต่ำกว่าแถวที่ลบจะเลื่อนขึ้น 1 แถว
        const newRow = item.oldRow > targetRow ? item.oldRow - 1 : item.oldRow;
        if (item.order !== i + 1) subSheet.getRange(newRow, subOrderCol + 1).setValue(i + 1);
      });
    }

    invalidateSheetCache("GradeSubComponents");
    return { status: "success", data: { deletedScoreCount: scoreRowsToDelete.length } };
  } finally {
    lock.releaseLock();
  }
}

function handleGetGradeEntryPageData(body) {
  const classId = body.classId;
  const subjectId = body.subjectId;
  const academicYearId = body.academicYearId;
  const semester = Number(body.semester);

  if (!isAssignedToTeach(body.userId, subjectId, academicYearId, classId)) {
    return { status: "error", message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลห้องเรียน/วิชานี้" };
  }

  const setupResult = handleGetGradeSetup({ subjectId, academicYearId, semester, userId: body.userId });
  const components = setupResult.data;

  const enrollments = getCachedSheetData("StudentEnrollments", 60).filter(
    (e) => String(e.ClassID) === String(classId)
  );
  const students = getCachedSheetData("Students", 120);

  const studentList = enrollments
    .map((e) => {
      const st = students.find((s) => String(s.StudentID) === String(e.StudentID));
      return {
        studentId: e.StudentID,
        studentNumber: e.StudentNumber,
        fullName: st ? (st.PrefixName || "") + st.FirstName + " " + st.LastName : e.StudentID,
        isActive: isActiveStudentRow(st), // false = ไม่ได้ "กำลังศึกษา" ล็อกการบันทึกคะแนน
        studentStatus: st ? st.Status || "" : "",
      };
    })
    .sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));

  // คะแนนต้องอ่านสด ห้ามแคช เพราะเป็นข้อมูลที่ครูกำลังแก้ไข/ต้องเห็นค่าล่าสุดเสมอ
  const scores = getStudentScoresWhere({
    ClassID: classId,
    SubjectID: subjectId,
    AcademicYearID: academicYearId,
    Semester: semester,
  });

  // เช็คว่า "ภาคเรียนนี้" ของวิชา/ห้องนี้ถูกส่งผลการเรียนไปแล้วหรือยัง (แยกเช็คเป็นรายภาคเรียน)
  // ถ้าส่งไปแล้ว หน้าเว็บจะล็อกการแก้ไขคะแนนของภาคเรียนนี้ เพื่อไม่ให้ผลการเรียนที่ส่งไปเพี้ยนไปจากคะแนนจริง
  const isSubmitted = isSemesterSubmitted(subjectId, academicYearId, classId, semester);
  // เช็คว่านายทะเบียนเปิดให้บันทึกคะแนนของปี/ภาคเรียนนี้อยู่หรือไม่ (ถ้าไม่เคยตั้งค่าไว้ ถือว่าเปิดเสมอ)
  const isPeriodOpen = isGradingPeriodOpen(academicYearId, semester);

  return {
    status: "success",
    data: { components, students: studentList, scores, isSubmitted, isPeriodOpen },
  };
}

function handleSaveStudentScores(body) {
  const classId = body.classId;
  const subjectId = body.subjectId;
  const academicYearId = body.academicYearId;
  const semester = body.semester;
  const scores = body.scores;

  if (!classId || !subjectId || !academicYearId || !semester || !Array.isArray(scores)) {
    return { status: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

  if (!isAssignedToTeach(body.userId, subjectId, academicYearId, classId)) {
    return { status: "error", message: "คุณไม่มีสิทธิ์บันทึกคะแนนวิชา/ห้องเรียนนี้" };
  }

  // ล็อกการแก้ไขคะแนน เฉพาะภาคเรียนที่ถูก "ส่งผลการเรียน" ไปแล้ว (แยกล็อกเป็นรายภาคเรียน)
  // ป้องกันไม่ให้คะแนนของภาคเรียนนั้นเปลี่ยนไปโดยที่ผลการเรียนที่ส่งไปแล้วไม่ได้อัพเดทตาม
  // ส่วนอีกภาคเรียนที่ยังไม่ได้ส่ง ยังแก้ไขคะแนนได้ตามปกติ
  if (isSemesterSubmitted(subjectId, academicYearId, classId, semester)) {
    return {
      status: "error",
      message: `ไม่สามารถแก้ไขคะแนนได้ เนื่องจากภาคเรียนที่ ${semester} ของวิชา/ห้องนี้ "ส่งผลการเรียน" ไปแล้ว กรุณา "ถอนผลการเรียน" ในเมนูตัดสินผลการเรียนก่อน จึงจะแก้ไขคะแนนได้`,
    };
  }

  // เช็คว่าอยู่ในช่วงเวลาที่นายทะเบียนเปิดให้บันทึกคะแนนของภาคเรียนนี้หรือไม่ (ถ้าไม่เคยตั้งค่าไว้ ถือว่าเปิดเสมอ)
  // หมดเวลาแล้ว = ดูข้อมูลได้อย่างเดียว ห้ามบันทึก/แก้ไขคะแนนต่อ
  if (!isGradingPeriodOpen(academicYearId, semester)) {
    return {
      status: "error",
      message: `ไม่สามารถบันทึกคะแนนได้ เนื่องจากยังไม่ถึง หรือพ้นช่วงเวลาที่นายทะเบียนกำหนดให้บันทึกคะแนนของภาคเรียนที่ ${semester} แล้ว`,
    };
  }

  // ตรวจสอบคะแนนที่ส่งมาทุกช่อง ต้องไม่ติดลบและไม่เกินคะแนนเต็มของช่องนั้นจริง (กันข้อมูลผิดปกติหลุดเข้าระบบ
  // แม้หน้าเว็บจะจำกัดค่าไว้แล้ว แต่ฝั่ง Server ต้องตรวจซ้ำเสมอ เผื่อมีการยิง request ตรงเข้ามา)
  const componentsForValidation = getCachedSheetData("GradeComponents", 120).filter(
    (c) =>
      String(c.SubjectID) === String(subjectId) &&
      String(c.AcademicYearID) === String(academicYearId) &&
      Number(c.Semester) === Number(semester)
  );
  const subComponentsForValidation = getCachedSheetData("GradeSubComponents", 60);

  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    if (s.score === "" || s.score === null || s.score === undefined) continue;

    const comp = componentsForValidation.find((c) => String(c.ComponentID) === String(s.componentId));
    if (!comp) {
      return { status: "error", message: "พบข้อมูลคะแนนที่ไม่ตรงกับวิชา/ภาคเรียนนี้ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง" };
    }

    let maxScore;
    if (comp.ComponentType === "ปลายภาค") {
      maxScore = Number(comp.MaxScore) || 0;
    } else {
      const subComp = subComponentsForValidation.find((sc) => String(sc.SubComponentID) === String(s.subComponentId));
      if (!subComp || String(subComp.ComponentID) !== String(comp.ComponentID)) {
        return { status: "error", message: "พบข้อมูลคะแนนที่ไม่ตรงกับช่องเก็บคะแนน กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง" };
      }
      maxScore = Number(subComp.MaxScore) || 0;
    }

    const scoreNum = Number(s.score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) {
      return {
        status: "error",
        message: `พบคะแนนที่ไม่ถูกต้อง (${s.score}) เกินคะแนนเต็ม (${maxScore}) หรือติดลบ กรุณาตรวจสอบคะแนนอีกครั้งก่อนบันทึก`,
      };
    }
  }

  // ล็อกนักเรียนที่ไม่ได้มีสถานะ "กำลังศึกษา": ห้ามบันทึกคะแนนให้ (ตรวจฝั่ง Server เสมอ เผื่อมีการยิง request ตรง)
  const activeIdsForScores = getActiveStudentIdSet();
  const lockedInScores = scores.filter((s) => activeIdsForScores[String(s.studentId)] !== true);
  if (lockedInScores.length > 0) {
    return {
      status: "error",
      message: "ไม่สามารถบันทึกคะแนนได้ เนื่องจากมีนักเรียนที่ไม่ได้มีสถานะ \"กำลังศึกษา\" กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง",
    };
  }

  // กันชนกันตอนมีครูหลายคนบันทึกคะแนนพร้อมกัน (รองรับสูงสุด ~80 คนพร้อมกัน)
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000); // รอคิวสูงสุด 20 วินาที
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกคะแนนพร้อมกันจำนวนมาก กรุณาลองบันทึกใหม่อีกครั้ง" };
  }

  try {
    // ตรวจซ้ำอีกครั้ง "หลังได้ lock แล้ว" (กันกรณีที่มีการ "ส่งผลการเรียน" ของภาคเรียนนี้แทรกเข้ามาระหว่างที่ request นี้
    // เพิ่งผ่านการเช็คด้านบนแต่ยังไม่ได้คิว lock พอดี ซึ่งจะทำให้คะแนนถูกบันทึกทับหลังผลถูกส่ง/อนุมัติไปแล้วโดยไม่ตั้งใจ)
    if (isSemesterSubmitted(subjectId, academicYearId, classId, semester)) {
      return {
        status: "error",
        message: `ไม่สามารถแก้ไขคะแนนได้ เนื่องจากภาคเรียนที่ ${semester} ของวิชา/ห้องนี้ "ส่งผลการเรียน" ไปแล้ว กรุณา "ถอนผลการเรียน" ในเมนูตัดสินผลการเรียนก่อน จึงจะแก้ไขคะแนนได้`,
      };
    }

    const sheet = SS.getSheetByName("StudentScores");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const colIndex = {};
    headers.forEach((h, i) => (colIndex[h] = i));

    // เก็บ key ของแถวเดิมที่อยู่ใน scope นี้ (ห้อง/วิชา/ปี/ภาคเรียนเดียวกัน) -> เลขแถวจริงในชีท
    const existingMap = {};
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      // ข้ามแถวคะแนนของนักเรียนที่ไม่ได้ "กำลังศึกษา": หน้ากรอกไม่ส่งคะแนนของคนเหล่านี้มา ถ้าไม่ข้ามจะถูกลบทิ้งผิดๆ ในขั้นตอนลบด้านล่าง
      if (
        activeIdsForScores[String(row[colIndex.StudentID])] === true &&
        String(row[colIndex.ClassID]) === String(classId) &&
        String(row[colIndex.SubjectID]) === String(subjectId) &&
        String(row[colIndex.AcademicYearID]) === String(academicYearId) &&
        String(row[colIndex.Semester]) === String(semester)
      ) {
        const key = row[colIndex.StudentID] + "|" + row[colIndex.ComponentID] + "|" + (row[colIndex.SubComponentID] || "");
        existingMap[key] = r + 1; // เลขแถวจริง (1-based รวม header)
      }
    }

    const validScores = scores.filter((s) => s.score !== "" && s.score !== null && s.score !== undefined);
    const incomingKeys = {};
    const rowsToAppend = [];
    const updatedRows = []; // { row, score } เฉพาะแถวที่ค่าคะแนนเปลี่ยนจริงเท่านั้น
    const scoreColNum = colIndex.Score + 1;

    validScores.forEach((s) => {
      const key = s.studentId + "|" + s.componentId + "|" + (s.subComponentId || "");
      incomingKeys[key] = true;

      if (existingMap[key]) {
        const rowNum = existingMap[key];
        const newScore = Number(s.score);
        if (Number(data[rowNum - 1][colIndex.Score]) !== newScore) {
          updatedRows.push({ row: rowNum, score: newScore });
        }
      } else {
        rowsToAppend.push(s);
      }
    });

    // เขียนกลับเฉพาะ "แถวที่คะแนนเปลี่ยนจริง" เท่านั้น (ไม่ rewrite ทั้งชีต StudentScores ทั้งเล่มเหมือนเดิม)
    // เดิมเขียนทับทั้งชีตทุกครั้งที่บันทึก ทำให้ยิ่งชีตใหญ่ขึ้นเรื่อยๆ ตลอดปีการศึกษา เวลาที่ถือ lock ต่อครั้งก็นานขึ้นตามไปด้วย
    // ส่งผลให้ตอนครูหลายสิบคนบันทึกคะแนนพร้อมกัน (เช่น ใกล้ปิดเทอม) ต้องรอคิวนานขึ้นเรื่อยๆ — ปรับให้แก้เฉพาะแถวของวิชา/ห้องที่กำลังบันทึกจริงๆ
    // เพื่อให้เวลาถือ lock ต่อครั้งขึ้นอยู่กับ "จำนวนคะแนนที่บันทึกในครั้งนี้" (คงที่ต่อห้อง) ไม่ใช่ขนาดของชีตทั้งเล่ม — 5 ต.ค. 2569
    updatedRows.forEach((u) => sheet.getRange(u.row, scoreColNum).setValue(u.score));

    // แถวเดิมที่ไม่มีคะแนนส่งมาแล้ว (ครูลบคะแนนออก) -> ลบทิ้งเฉพาะแถวที่จำเป็นจริงๆ
    const rowsToDelete = Object.keys(existingMap)
      .filter((key) => !incomingKeys[key])
      .map((key) => existingMap[key])
      .sort((a, b) => b - a);
    rowsToDelete.forEach((rowNum) => sheet.deleteRow(rowNum));

    // เพิ่มแถวใหม่ (คะแนนที่ยังไม่เคยมีมาก่อน)
    if (rowsToAppend.length > 0) {
      const allScoreIds = getSheetColumnsData("StudentScores", ["ScoreID"]);
      const maxNum = allScoreIds.reduce((max, sc) => {
        const match = String(sc.ScoreID || "").match(/^SCR(\d+)$/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);

      const newRows = rowsToAppend.map((s, i) => [
        "SCR" + String(maxNum + i + 1).padStart(6, "0"),
        s.studentId,
        classId,
        subjectId,
        academicYearId,
        semester,
        s.componentId,
        s.subComponentId || "",
        Number(s.score),
      ]);

      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, newRows.length, 9).setValues(newRows);
    }

    return { status: "success" };
  } finally {
    lock.releaseLock();
  }
}


// ===== ตัดสินผลการเรียน (Finalize Grades) =====

// แปลงคะแนนเต็ม 100 เป็นผลการเรียน 0-4 ตามมาตรฐาน 8 ระดับ
function scoreToGradePoint(score) {
  if (score >= 80) return 4;
  if (score >= 75) return 3.5;
  if (score >= 70) return 3;
  if (score >= 65) return 2.5;
  if (score >= 60) return 2;
  if (score >= 55) return 1.5;
  if (score >= 50) return 1;
  return 0;
}

function computeUnitScoreServer(comp, scoresMap, studentId) {
  if (!comp.subComponents || comp.subComponents.length === 0) return 0;

  const ratios = comp.subComponents.map((sc) => {
    const key = studentId + "|" + comp.componentId + "|" + sc.subComponentId;
    const score = Number(scoresMap[key]) || 0;
    const max = Number(sc.maxScore) || 1;
    return score / max;
  });

  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return avgRatio * Number(comp.maxScore || 10);
}

function computeSemesterScores(components, scoresMap, studentId) {
  let unitsRaw = 0;
  let unitsMax = 0;
  let examRaw = 0;
  let examMax = 0;

  components.forEach((comp) => {
    if (comp.componentType === "ปลายภาค") {
      const key = studentId + "|" + comp.componentId + "|";
      examRaw += Number(scoresMap[key]) || 0;
      examMax += Number(comp.maxScore || 0);
    } else {
      unitsRaw += computeUnitScoreServer(comp, scoresMap, studentId);
      unitsMax += Number(comp.maxScore || 0);
    }
  });

  // แปลงสัดส่วนคะแนนหน่วย (ระหว่างภาค) ให้เป็นฐาน 70 และคะแนนปลายภาคให้เป็นฐาน 30 เสมอ
  // ไม่ว่าคะแนนเต็มจริงที่ตั้งค่าไว้ของแต่ละส่วนจะเป็นเท่าไหร่ก็ตาม แล้วจึงรวมกันเป็นคะแนนเต็ม 100
  // 7 ต.ค. 2569: ปัดทศนิยม 2 ตำแหน่งตั้งแต่ขั้นนี้ ให้ "ค่าที่เก็บ = ค่าที่แสดง = ค่าที่ใช้ตัดเกรด" เสมอ
  // (เดิมเก็บค่าเต็มไม่ปัด แต่แสดงปัด 2 ตำแหน่ง ทำให้บางกรณีแสดง 60.00 แต่ค่าจริง 59.999… ได้เกรดต่ำกว่าที่เห็น)
  // คำนวณเป็น "สตางค์" (จำนวนเต็ม) เพื่อตัดปัญหาทศนิยมคลาดเคลื่อน: รวม = ระหว่างภาคที่ปัดแล้ว + ปลายภาคที่ปัดแล้ว
  const raw70Cents = toScoreCents(unitsMax > 0 ? (unitsRaw / unitsMax) * 70 : 0);
  const exam30Cents = toScoreCents(examMax > 0 ? (examRaw / examMax) * 30 : 0);

  return { raw70: raw70Cents / 100, exam30: exam30Cents / 100, total100: (raw70Cents + exam30Cents) / 100 };
}

/**
 * ปัดคะแนนเป็นทศนิยม 2 ตำแหน่ง (ปัดขึ้นเมื่อเป็น .5 พอดี) คืนค่าเป็น "จำนวนเต็มหน่วยสตางค์" เช่น 79.995 -> 8000
 * เติมค่าเล็กน้อย (1e-6) เพื่อกันกรณีเลขทศนิยมคลาดเคลื่อน เช่น 49.99999999999999 ต้องได้ 5000 และ 0.285 ต้องได้ 29 ไม่ใช่ 28
 * ต้องใช้กฎเดียวกับหน้าเว็บ (fmtScore2 ใน grade-entry.js)
 */
function toScoreCents(x) {
  return Math.round(Number(x) * 100 + 1e-6);
}

/**
 * คะแนนทั้งปีจากคะแนนของ 2 ภาคเรียน: ระหว่างภาค/ปลายภาค = ค่าเฉลี่ยของ 2 ภาค (ปัดขึ้นเมื่อ .5 พอดี) รวม = ระหว่างภาค + ปลายภาค
 * ทำให้ตัวเลขที่แสดงบวกกันได้พอดีเสมอ และเป็นค่าเดียวที่ใช้ตัดเกรด ทุกค่าเป็นทศนิยมไม่เกิน 2 ตำแหน่ง (7 ต.ค. 2569)
 */
function computeYearScores(sem1Raw70, sem1Exam30, sem2Raw70, sem2Exam30) {
  const raw70Cents = Math.round((toScoreCents(sem1Raw70) + toScoreCents(sem2Raw70)) / 2);
  const exam30Cents = Math.round((toScoreCents(sem1Exam30) + toScoreCents(sem2Exam30)) / 2);
  return { raw70: raw70Cents / 100, exam30: exam30Cents / 100, total100: (raw70Cents + exam30Cents) / 100 };
}

// ===== ควบคุมช่วงเวลาเปิด/ปิดการบันทึกคะแนน (Sheet: GradingPeriods) =====
// คอลัมน์ (เรียงตามลำดับ): AcademicYearID, Semester, StartDateTime, EndDateTime, ManualStatus
// 1 แถว = 1 ช่วงเวลาที่นายทะเบียนอนุญาตให้บันทึกคะแนนของปีการศึกษา/ภาคเรียนนั้น (ตั้งแยกอิสระรายภาคเรียน)
// ถ้าไม่มีแถวที่ตรงกับปี/ภาคเรียนใด ให้ถือว่า "เปิด" เสมอ (ค่าเริ่มต้น) เพื่อไม่ให้กระทบปีการศึกษาเดิมที่ยังไม่เคยตั้งค่านี้มาก่อน
//
// ManualStatus = ปุ่มเปิด/ปิดแบบไม่กำหนดเวลา (บังคับ override ทับ StartDateTime/EndDateTime เสมอ):
//   "OPEN"   -> บังคับเปิดไม่จำกัดเวลา ไม่สนช่วงเวลาที่ตั้งไว้
//   "CLOSED" -> บังคับปิดทันที ไม่สนช่วงเวลาที่ตั้งไว้
//   ""       -> (ค่าเริ่มต้น/AUTO) ใช้ตาม StartDateTime/EndDateTime ตามปกติ

function findGradingPeriodRow(academicYearId, semester) {
  return getSheetData("GradingPeriods").find(
    (r) =>
      String(r.AcademicYearID) === String(academicYearId) &&
      String(r.Semester) === String(semester)
  );
}

function isGradingPeriodOpen(academicYearId, semester) {
  const row = findGradingPeriodRow(academicYearId, semester);
  if (!row) return true; // ยังไม่ได้ตั้งค่า -> เปิดให้บันทึกได้เสมอ

  const manualStatus = String(row.ManualStatus || "").trim().toUpperCase();
  if (manualStatus === "OPEN") return true; // บังคับเปิดไม่จำกัดเวลา
  if (manualStatus === "CLOSED") return false; // บังคับปิดทันที

  if (!row.StartDateTime || !row.EndDateTime) return true; // ยังไม่ได้ตั้งช่วงเวลา -> เปิดให้บันทึกได้เสมอ

  const now = Date.now();
  const start = new Date(row.StartDateTime).getTime();
  const end = new Date(row.EndDateTime).getTime();
  if (isNaN(start) || isNaN(end)) return true; // ข้อมูลวันที่ผิดปกติ -> ไม่ล็อก กันระบบพังจากข้อมูลเสีย

  return now >= start && now <= end;
}

/**
 * หาว่า "ภาคเรียนปัจจุบันที่เปิดให้บันทึกคะแนนอยู่" ของปีการศึกษานี้คือภาคเรียนไหน — ใช้สำหรับหน้าติดตามความคืบหน้าของนายทะเบียน
 * หลักการ: ถ้าภาคเรียนที่ 2 เปิดอยู่ ถือว่าเป็นภาคเรียนปัจจุบัน (เพราะตามปกติต้องปิดภาคเรียนที่ 1 ก่อนจะเปิดภาคเรียนที่ 2)
 * ถ้าไม่ใช่ ให้ดูภาคเรียนที่ 1 แทน (ถ้ายังไม่เคยตั้งค่า GradingPeriods ไว้เลย ถือว่าเปิดเสมอ จึงได้ภาคเรียนที่ 1 เป็นค่าเริ่มต้นไปโดยปริยาย)
 * คืนค่า null ถ้าทั้งสองภาคเรียนถูกบังคับปิด หรือพ้นช่วงเวลาที่ตั้งไว้แล้วทั้งคู่ (ไม่มีภาคเรียนใดเปิดอยู่ตอนนี้เลย)
 */
function getCurrentOpenSemester(academicYearId) {
  if (isGradingPeriodOpen(academicYearId, 2)) return 2;
  if (isGradingPeriodOpen(academicYearId, 1)) return 1;
  return null;
}

/**
 * ดึงรายการช่วงเวลาบันทึกคะแนนทั้งหมด (ทุกปีการศึกษา/ภาคเรียน) พร้อมรายชื่อปีการศึกษา
 * สำหรับหน้าตั้งค่า "ตั้งเวลาบันทึกคะแนน" (นายทะเบียน/ผู้ช่วยนายทะเบียน)
 */
function handleGetGradingPeriods() {
  const academicYears = handleGetAcademicYears().data;
  const periods = getSheetData("GradingPeriods");
  return { status: "success", data: { academicYears, periods } };
}

/**
 * ตั้ง/แก้ไข ช่วงเวลาที่อนุญาตให้บันทึกคะแนนของปีการศึกษา + ภาคเรียนที่ระบุ (upsert ทับแถวเดิมถ้ามีอยู่แล้ว)
 */
function handleSetGradingPeriod(body) {
  const academicYearId = body.academicYearId;
  const semester = Number(body.semester);
  const startDateTime = body.startDateTime;
  const endDateTime = body.endDateTime;

  if (!academicYearId || (semester !== 1 && semester !== 2) || !startDateTime || !endDateTime) {
    return { status: "error", message: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  const startMs = new Date(startDateTime).getTime();
  const endMs = new Date(endDateTime).getTime();
  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
    return { status: "error", message: "ช่วงเวลาไม่ถูกต้อง วันเวลาสิ้นสุดต้องอยู่หลังวันเวลาเริ่มต้น" };
  }

  const sheet = SS.getSheetByName("GradingPeriods");
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const yearCol = headers.indexOf("AcademicYearID");
  const semCol = headers.indexOf("Semester");
  const startCol = headers.indexOf("StartDateTime");
  const endCol = headers.indexOf("EndDateTime");
  const manualCol = headers.indexOf("ManualStatus"); // อาจไม่มีในชีทเก่า ถ้าไม่พบให้ข้ามได้ ไม่ error

  if (yearCol === -1 || semCol === -1 || startCol === -1 || endCol === -1) {
    return { status: "error", message: "โครงสร้าง Sheet GradingPeriods ไม่ถูกต้อง" };
  }

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][yearCol]) === String(academicYearId) &&
      String(values[i][semCol]) === String(semester)
    ) {
      rowIndex = i + 1; // เลขแถวจริง (1-based รวม header)
      break;
    }
  }

  if (rowIndex === -1) {
    const newRow = headers.map((h) => {
      if (h === "AcademicYearID") return academicYearId;
      if (h === "Semester") return semester;
      if (h === "StartDateTime") return startDateTime;
      if (h === "EndDateTime") return endDateTime;
      return ""; // รวมถึง ManualStatus ถ้ามีคอลัมน์นี้ -> เริ่มต้นเป็น AUTO เสมอ
    });
    sheet.appendRow(newRow);
  } else {
    sheet.getRange(rowIndex, startCol + 1).setValue(startDateTime);
    sheet.getRange(rowIndex, endCol + 1).setValue(endDateTime);
    // ตั้งช่วงเวลาใหม่ -> กลับไปใช้ตามช่วงเวลานี้เสมอ (ล้างสถานะบังคับเปิด/ปิดด้วยมือทิ้งไปโดยอัตโนมัติ)
    if (manualCol !== -1) {
      sheet.getRange(rowIndex, manualCol + 1).setValue("");
    }
  }

  return { status: "success", message: "บันทึกช่วงเวลาบันทึกคะแนนเรียบร้อยแล้ว" };
}

/**
 * ปุ่มเปิด/ปิดการบันทึกคะแนนแบบ "ไม่กำหนดเวลา" (บังคับ override ทับ StartDateTime/EndDateTime เสมอ)
 * manualStatus: "OPEN" = บังคับเปิดไม่จำกัดเวลา, "CLOSED" = บังคับปิดทันที, "" = เคลียร์กลับไปใช้ตามช่วงเวลาที่ตั้งไว้ (AUTO)
 */
function handleSetGradingPeriodManualStatus(body) {
  const academicYearId = body.academicYearId;
  const semester = Number(body.semester);
  const manualStatus = String(body.manualStatus || "").trim().toUpperCase();

  if (!academicYearId || (semester !== 1 && semester !== 2)) {
    return { status: "error", message: "กรุณาระบุปีการศึกษาและภาคเรียนให้ถูกต้อง" };
  }
  if (manualStatus !== "OPEN" && manualStatus !== "CLOSED" && manualStatus !== "") {
    return { status: "error", message: "สถานะไม่ถูกต้อง" };
  }

  const sheet = SS.getSheetByName("GradingPeriods");
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const yearCol = headers.indexOf("AcademicYearID");
  const semCol = headers.indexOf("Semester");
  const manualCol = headers.indexOf("ManualStatus");

  if (yearCol === -1 || semCol === -1 || manualCol === -1) {
    return {
      status: "error",
      message: "ไม่พบคอลัมน์ ManualStatus ใน Sheet GradingPeriods กรุณาเพิ่มคอลัมน์นี้ก่อนใช้งานปุ่มเปิด/ปิดแบบไม่กำหนดเวลา",
    };
  }

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][yearCol]) === String(academicYearId) &&
      String(values[i][semCol]) === String(semester)
    ) {
      rowIndex = i + 1; // เลขแถวจริง (1-based รวม header)
      break;
    }
  }

  if (rowIndex === -1) {
    // ยังไม่เคยมีแถวของปี/ภาคเรียนนี้เลย -> สร้างแถวใหม่ เว้นช่วงเวลาว่างไว้ (ใช้ปุ่มบังคับเปิด/ปิดอย่างเดียวได้โดยไม่ต้องตั้งช่วงเวลา)
    const newRow = headers.map((h) => {
      if (h === "AcademicYearID") return academicYearId;
      if (h === "Semester") return semester;
      if (h === "ManualStatus") return manualStatus;
      return "";
    });
    sheet.appendRow(newRow);
  } else {
    sheet.getRange(rowIndex, manualCol + 1).setValue(manualStatus);
  }

  return { status: "success", message: "บันทึกสถานะเรียบร้อยแล้ว" };
}

/**
 * สถานะช่วงเวลาบันทึกคะแนนของปีการศึกษาปัจจุบัน (ภาคเรียนที่ 1 และ 2) สำหรับตัวนับถอยหลังที่ Header
 * ใช้ได้ทุกบทบาทที่ login แล้ว (ตั้งใจไม่ใส่ไว้ใน ACTION_ROLES)
 */
function handleGetGradingPeriodStatus() {
  const academicYears = handleGetAcademicYears().data;
  const currentYear = academicYears.find(
    (y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE"
  ) || academicYears[0];
  const academicYearId = currentYear ? currentYear.AcademicYearID : null;

  const periods = [1, 2].map((semester) => {
    const row = academicYearId ? findGradingPeriodRow(academicYearId, semester) : null;
    const isConfigured = !!(row && row.StartDateTime && row.EndDateTime);
    const manualStatus = row ? String(row.ManualStatus || "").trim().toUpperCase() : "";
    return {
      semester,
      startDateTime: isConfigured ? row.StartDateTime : null,
      endDateTime: isConfigured ? row.EndDateTime : null,
      isConfigured,
      manualStatus, // "OPEN" | "CLOSED" | "" (ใช้ตามช่วงเวลาปกติ)
      isOpen: academicYearId ? isGradingPeriodOpen(academicYearId, semester) : true,
    };
  });

  return { status: "success", data: { academicYearId, periods } };
}

// ===== สถานะการส่งผลการเรียนแยกรายภาคเรียน (Sheet: SemesterSubmissions) =====
// คอลัมน์: SubmissionID, SubjectID, ClassID, AcademicYearID, Semester, UserID, Timestamp
// เป็น "จุดล็อก" ของแต่ละภาคเรียนแยกอิสระจากกัน ครูสามารถส่งภาคเรียนที่ 1 ได้ก่อน โดยยังไม่ต้องมีคะแนนภาคเรียนที่ 2 เลย

/**
 * ปรับเป็นอ่านผ่านแคช (getCachedSheetData) แทนการอ่านทั้งชีตสดทุกครั้ง (getSheetData) — 26 ก.ย. 2569
 * เดิมฟังก์ชันนี้ถูกเรียกซ้ำๆ ภายในลูปวนทุกรายวิชาของหน้ารายงาน ปถ.06 (2 ครั้ง/วิชา สำหรับภาคเรียนที่ 1 และ 2)
 * ทำให้ห้องที่มีหลายรายวิชาต้องอ่านทั้งชีต SemesterSubmissions ซ้ำหลายสิบครั้งต่อการเปิดดูรายงาน 1 ครั้ง ทำให้หน้าโหลดช้ามาก
 * แคชไว้ 60 วินาที และต้องเรียก invalidateSheetCache("SemesterSubmissions") ทันทีทุกจุดที่เขียน/ลบแถวในชีตนี้
 * (ดู handleSubmitFinalResults / handleWithdrawFinalResults) เพื่อไม่ให้เห็นสถานะการส่งผลเก่าค้างอยู่
 */
function isSemesterSubmitted(subjectId, academicYearId, classId, semester) {
  return getCachedSheetData("SemesterSubmissions", 60).some(
    (r) =>
      String(r.SubjectID) === String(subjectId) &&
      String(r.AcademicYearID) === String(academicYearId) &&
      String(r.ClassID) === String(classId) &&
      String(r.Semester) === String(semester)
  );
}

// เหมือน isSemesterSubmitted() แต่ไม่เจาะจงห้องเรียน (ไม่มี classId) — ใช้ตรวจก่อนแก้ "โครงสร้าง" ช่องเก็บคะแนน
// (GradeComponents/GradeSubComponents) ซึ่งใช้ร่วมกันทุกห้องของวิชา/ปีการศึกษา/ภาคเรียนเดียวกัน จึงต้องเช็คว่ามีห้องใดห้องหนึ่ง
// ส่งผลการเรียนไปแล้วหรือยัง ไม่ใช่เช็คเฉพาะห้องเดียว — 27 ก.ย. 2569
function isSemesterSubmittedForAnyClass(subjectId, academicYearId, semester) {
  return getCachedSheetData("SemesterSubmissions", 60).some(
    (r) =>
      String(r.SubjectID) === String(subjectId) &&
      String(r.AcademicYearID) === String(academicYearId) &&
      String(r.Semester) === String(semester)
  );
}

// ลบแถวตามเลขแถวที่ระบุ โดยจัดกลุ่มแถวที่ติดกันเป็นช่วงต่อเนื่องแล้วลบทีละก้อนด้วย deleteRows()
// เรียงจากแถวมากไปน้อยก่อนเสมอ เพื่อไม่ให้เลขแถวเคลื่อนระหว่างลบ
function deleteSheetRowsDescending(sheet, rowNums) {
  const sorted = rowNums.slice().sort((a, b) => b - a);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j] - sorted[j + 1] === 1) j++;
    const endRow = sorted[i];
    const startRow = sorted[j];
    sheet.deleteRows(startRow, endRow - startRow + 1);
    i = j + 1;
  }
}

// ผลการเรียนทั้งปี (yearScore100/gradePoint ใน FinalResults) มีความหมายก็ต่อเมื่อส่งครบทั้ง 2 ภาคเรียนแล้วเท่านั้น
// ฟังก์ชันนี้จะถูกเรียกทุกครั้งหลังส่ง/ถอนผลการเรียนภาคเรียนใดภาคเรียนหนึ่ง เพื่อ sync ข้อมูลสรุปทั้งปีให้ตรงกับความเป็นจริงเสมอ:
// - ถ้าส่งครบทั้ง 2 ภาคเรียนแล้ว -> คำนวณคะแนนปีการศึกษา/ผลการเรียนจริง แล้วบันทึก (insert/update) ลง FinalResults
// - ถ้ายังไม่ครบ (เพิ่งส่งภาคเดียว หรือเพิ่งถอนภาคใดภาคหนึ่งออกไป) -> ลบข้อมูลสรุปทั้งปีเดิมทิ้ง ไม่ให้มีข้อมูลที่ไม่สมบูรณ์ค้างอยู่
// (ปถ.05 และรายงานอื่นๆ ที่ต้องใช้ผลทั้งปี จะยังคงเช็คจาก FinalResults เหมือนเดิม ไม่ต้องแก้ที่อื่น)
function syncFinalResultsForYear(subjectId, academicYearId, classId, userId) {
  const bothSubmitted =
    isSemesterSubmitted(subjectId, academicYearId, classId, 1) &&
    isSemesterSubmitted(subjectId, academicYearId, classId, 2);

  const sheet = SS.getSheetByName("FinalResults");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIndex = {};
  headers.forEach((h, i) => (colIndex[h] = i));

  const existingRowNums = [];
  const existingMap = {};
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (
      String(row[colIndex.SubjectID]) === String(subjectId) &&
      String(row[colIndex.AcademicYearID]) === String(academicYearId) &&
      String(row[colIndex.ClassID]) === String(classId)
    ) {
      existingRowNums.push(r + 1);
      existingMap[String(row[colIndex.StudentID])] = r + 1;
    }
  }

  if (!bothSubmitted) {
    deleteSheetRowsDescending(sheet, existingRowNums);
    return;
  }

  const built = buildFinalizeData(subjectId, academicYearId, classId, userId);
  if (built.status !== "success") return;
  const results = built.data;

  const now = new Date().toISOString();
  const rowsToAppend = [];

  const allFinalIds = getSheetData("FinalResults");
  let maxNum = allFinalIds.reduce((max, r) => {
    const match = String(r.FinalResultID || "").match(/^FR(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  results.forEach((res) => {
    // ไม่บันทึก/ไม่อัปเดตผลการเรียนของนักเรียนที่ไม่ได้ "กำลังศึกษา" (แถวเดิมที่เคยบันทึกไว้คงอยู่ตามเดิม)
    if (res.isActive === false) return;
    const rowValues = [
      null,
      res.studentId,
      subjectId,
      classId,
      academicYearId,
      res.semester1Raw70,
      res.semester1Exam30,
      res.semester1Total100,
      res.semester2Raw70,
      res.semester2Exam30,
      res.semester2Total100,
      res.yearScore100,
      res.gradePoint,
      userId,
      now,
    ];

    const existingRowNum = existingMap[String(res.studentId)];
    if (existingRowNum) {
      rowValues[0] = data[existingRowNum - 1][colIndex.FinalResultID];
      for (let c = 1; c < headers.length; c++) {
        data[existingRowNum - 1][c] = rowValues[c];
      }
    } else {
      maxNum += 1;
      rowValues[0] = "FR" + String(maxNum).padStart(6, "0");
      rowsToAppend.push(rowValues);
    }
  });

  sheet.getRange(1, 1, data.length, headers.length).setValues(data);

  if (rowsToAppend.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
  }
}

/**
 * ต้องได้รับ userId ของครูผู้เรียก (ที่ผ่านการตรวจสิทธิ์แล้วจากผู้เรียก) เพื่อส่งต่อให้ handleGetGradeSetup
 * ตรวจสิทธิ์ระดับห้อง/วิชาให้ทำที่ผู้เรียกฟังก์ชันนี้ (handleGetFinalizePageData/handleSubmitFinalResults) ก่อนเสมอ
 */
function buildFinalizeData(subjectId, academicYearId, classId, userId) {
  const setup1 = handleGetGradeSetup({ subjectId, academicYearId, semester: "1", userId });
  const setup2 = handleGetGradeSetup({ subjectId, academicYearId, semester: "2", userId });

  if (setup1.status !== "success") return setup1;
  if (setup2.status !== "success") return setup2;

  const components1 = setup1.data;
  const components2 = setup2.data;

  const allEnrollments = getCachedSheetData("StudentEnrollments", 60).filter(
    (e) => String(e.ClassID) === String(classId)
  );
  const allStudents = getCachedSheetData("Students", 120);

  const students = allEnrollments
    .map((e) => {
      const st = allStudents.find((s) => String(s.StudentID) === String(e.StudentID));
      if (!st) return null;
      return {
        studentId: st.StudentID,
        studentNumber: e.StudentNumber,
        fullName: st.PrefixName + st.FirstName + " " + st.LastName,
        isActive: isActiveStudentRow(st), // false = ไม่ได้ "กำลังศึกษา" ไม่บันทึกลง FinalResults
        studentStatus: st.Status || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));

  const allScores = getStudentScoresWhere({ ClassID: classId, SubjectID: subjectId, AcademicYearID: academicYearId });

  const scoresMap1 = {};
  const scoresMap2 = {};
  allScores.forEach((sc) => {
    const key = sc.StudentID + "|" + sc.ComponentID + "|" + (sc.SubComponentID || "");
    if (String(sc.Semester) === "1") scoresMap1[key] = sc.Score;
    else if (String(sc.Semester) === "2") scoresMap2[key] = sc.Score;
  });

  const results = students.map((st) => {
    const sem1 = computeSemesterScores(components1, scoresMap1, st.studentId);
    const sem2 = computeSemesterScores(components2, scoresMap2, st.studentId);
    // คะแนนปี/เกรดคิดจากค่าที่ปัดแล้วเหมือนที่แสดงบนหน้าจอ (ดู computeYearScores)
    const yearScore100 = computeYearScores(sem1.raw70, sem1.exam30, sem2.raw70, sem2.exam30).total100;
    const gradePoint = scoreToGradePoint(yearScore100);

    return {
      studentId: st.studentId,
      studentNumber: st.studentNumber,
      fullName: st.fullName,
      isActive: st.isActive,
      studentStatus: st.studentStatus,
      semester1Raw70: sem1.raw70,
      semester1Exam30: sem1.exam30,
      semester1Total100: sem1.total100,
      semester2Raw70: sem2.raw70,
      semester2Exam30: sem2.exam30,
      semester2Total100: sem2.total100,
      yearScore100: yearScore100,
      gradePoint: gradePoint,
    };
  });

  return { status: "success", data: results };
}

/**
 * เหมือน buildFinalizeData แต่คำนวณเฉพาะภาคเรียนที่ 1 (ไม่แตะภาคเรียนที่ 2/ปีการศึกษา/ผลการเรียนเลย)
 * ใช้สำหรับออกรายงาน ปถ.05 กรณีส่งผลการเรียนแค่ภาคเรียนที่ 1 (ยังไม่ครบทั้งปี)
 */
function buildSemester1OnlyData(subjectId, academicYearId, classId, userId) {
  const setup1 = handleGetGradeSetup({ subjectId, academicYearId, semester: "1", userId });
  if (setup1.status !== "success") return setup1;
  const components1 = setup1.data;

  const allEnrollments = getCachedSheetData("StudentEnrollments", 60).filter(
    (e) => String(e.ClassID) === String(classId)
  );
  const allStudents = getCachedSheetData("Students", 120);

  const students = allEnrollments
    .map((e) => {
      const st = allStudents.find((s) => String(s.StudentID) === String(e.StudentID));
      if (!st) return null;
      return {
        studentId: st.StudentID,
        studentNumber: e.StudentNumber,
        fullName: st.PrefixName + st.FirstName + " " + st.LastName,
        isActive: isActiveStudentRow(st), // false = ไม่ได้ "กำลังศึกษา" ไม่บันทึกลง FinalResults
        studentStatus: st.Status || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));

  const allScores = getStudentScoresWhere({ ClassID: classId, SubjectID: subjectId, AcademicYearID: academicYearId, Semester: 1 });

  const scoresMap1 = {};
  allScores.forEach((sc) => {
    const key = sc.StudentID + "|" + sc.ComponentID + "|" + (sc.SubComponentID || "");
    scoresMap1[key] = sc.Score;
  });

  const results = students.map((st) => {
    const sem1 = computeSemesterScores(components1, scoresMap1, st.studentId);
    return {
      studentId: st.studentId,
      studentNumber: st.studentNumber,
      fullName: st.fullName,
      isActive: st.isActive,
      studentStatus: st.studentStatus,
      semester1Raw70: sem1.raw70,
      semester1Exam30: sem1.exam30,
      semester1Total100: sem1.total100,
    };
  });

  return { status: "success", data: results };
}

function handleGetFinalizePageData(body) {
  const subjectId = body.subjectId;
  const academicYearId = body.academicYearId;
  const classId = body.classId;

  if (!isAssignedToTeach(body.userId, subjectId, academicYearId, classId)) {
    return { status: "error", message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลห้องเรียน/วิชานี้" };
  }

  const built = buildFinalizeData(subjectId, academicYearId, classId, body.userId);
  if (built.status !== "success") return built;

  const results = built.data;

  const isSubmittedSem1 = isSemesterSubmitted(subjectId, academicYearId, classId, 1);
  const isSubmittedSem2 = isSemesterSubmitted(subjectId, academicYearId, classId, 2);

  return {
    status: "success",
    data: {
      students: results,
      isSubmittedSem1: isSubmittedSem1,
      isSubmittedSem2: isSubmittedSem2,
      // ครบทั้งปี (ใช้เป็นเงื่อนไขเดิมสำหรับหน้ารายงาน ปถ.05 ไม่ต้องแก้ที่หน้านั้น)
      isSubmitted: isSubmittedSem1 && isSubmittedSem2,
    },
  };
}

/**
 * ตรวจสอบว่านักเรียนทุกคนในห้องนี้ กรอกคะแนนครบทุกช่องเก็บคะแนนของวิชา/ภาคเรียนนี้แล้วหรือยัง
 * ใช้เป็นเงื่อนไขก่อนอนุญาตให้ "ส่งผลการเรียน" (ปิดช่องโหว่เดิมที่ส่งได้แม้คะแนนไม่ครบ แล้วช่องที่ขาดถูกคิดเป็น 0 แบบเงียบๆ) — 5 ต.ค. 2569
 * คืน array ของนักเรียนที่ยังขาดคะแนน (ว่าง = ครบทุกคนแล้ว) ถ้ายังไม่ได้ตั้งค่าช่องเก็บคะแนนของภาคเรียนนี้เลย ถือว่านักเรียนทุกคน "ขาดคะแนน" เช่นกัน
 */
function getMissingScoreStudents(subjectId, academicYearId, classId, semester) {
  const enrollments = getActiveEnrollments().filter((e) => String(e.ClassID) === String(classId));
  if (enrollments.length === 0) return [];

  const allStudents = getCachedSheetData("Students", 120);
  const studentInfo = (studentId) => {
    const st = allStudents.find((s) => String(s.StudentID) === String(studentId));
    return st ? (st.PrefixName || "") + (st.FirstName || "") + " " + (st.LastName || "") : String(studentId);
  };

  const components = getCachedSheetData("GradeComponents", 120).filter(
    (c) =>
      String(c.SubjectID) === String(subjectId) &&
      String(c.AcademicYearID) === String(academicYearId) &&
      Number(c.Semester) === Number(semester)
  );

  if (components.length === 0) {
    // ยังไม่ได้ตั้งค่าช่องเก็บคะแนนของภาคเรียนนี้เลย = ไม่มีช่องให้กรอก ถือว่ายังกรอกคะแนนไม่ครบทั้งห้อง
    return enrollments
      .map((e) => ({ studentId: e.StudentID, studentNumber: e.StudentNumber, fullName: studentInfo(e.StudentID) }))
      .sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));
  }

  const subComponentsByComponentId = {};
  getCachedSheetData("GradeSubComponents", 60).forEach((sc) => {
    const key = String(sc.ComponentID);
    if (!subComponentsByComponentId[key]) subComponentsByComponentId[key] = [];
    subComponentsByComponentId[key].push(sc);
  });

  const scores = getStudentScoresWhere({
    ClassID: classId,
    SubjectID: subjectId,
    AcademicYearID: academicYearId,
    Semester: Number(semester),
  });

  const missing = [];
  enrollments.forEach((e) => {
    const sid = String(e.StudentID);
    const scoresForStudent = scores.filter((sc) => String(sc.StudentID) === sid);

    const isMissing = components.some((c) => {
      const isFinalExam = c.ComponentType === "ปลายภาค";
      const expected = isFinalExam ? 1 : (subComponentsByComponentId[String(c.ComponentID)] || []).length;
      const recorded = isFinalExam
        ? scoresForStudent.filter((sc) => String(sc.ComponentID) === String(c.ComponentID)).length
        : new Set(
            scoresForStudent
              .filter((sc) => String(sc.ComponentID) === String(c.ComponentID))
              .map((sc) => String(sc.SubComponentID))
              // นับเฉพาะช่องที่ยังมีอยู่จริง (ไม่นับคะแนนค้างของช่องที่ถูกลบไปแล้ว)
              .filter((id) => (subComponentsByComponentId[String(c.ComponentID)] || []).some((x) => String(x.SubComponentID) === id))
          ).size;
      return recorded < expected;
    });

    if (isMissing) {
      missing.push({ studentId: e.StudentID, studentNumber: e.StudentNumber, fullName: studentInfo(e.StudentID) });
    }
  });

  return missing.sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));
}

function handleSubmitFinalResults(body) {
  const subjectId = body.subjectId;
  const academicYearId = body.academicYearId;
  const classId = body.classId;
  const semester = Number(body.semester);
  const userId = body.userId;

  if (!subjectId || !academicYearId || !classId || (semester !== 1 && semester !== 2)) {
    return { status: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

  if (!isAssignedToTeach(userId, subjectId, academicYearId, classId)) {
    return { status: "error", message: "คุณไม่มีสิทธิ์บันทึกผลการเรียนวิชา/ห้องเรียนนี้" };
  }

  const enrollmentCount = getActiveEnrollments().filter(
    (e) => String(e.ClassID) === String(classId)
  ).length;
  if (enrollmentCount === 0) {
    return { status: "error", message: "ไม่พบนักเรียนในห้องเรียนนี้" };
  }

  // ปิดช่องโหว่: ห้ามส่งผลการเรียนถ้ายังมีนักเรียนกรอกคะแนนไม่ครบทุกช่องเก็บคะแนนของภาคเรียนนี้ (เช็คก่อนเข้าคิว lock เพื่อตอบกลับเร็วถ้าเห็นได้ชัดว่าไม่ครบ)
  const missingBeforeLock = getMissingScoreStudents(subjectId, academicYearId, classId, semester);
  if (missingBeforeLock.length > 0) {
    return {
      status: "error",
      message: `ไม่สามารถส่งผลการเรียนได้ เนื่องจากยังมีนักเรียน ${missingBeforeLock.length} คน กรอกคะแนนภาคเรียนที่ ${semester} ไม่ครบทุกช่องเก็บคะแนน กรุณากรอกคะแนนให้ครบทุกคนก่อนส่งผลการเรียน`,
      missingStudents: missingBeforeLock,
    };
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    // ตรวจซ้ำอีกครั้ง "หลังได้ lock แล้ว" เผื่อมีคะแนนบางช่องถูกลบออกไประหว่างที่คำขอนี้กำลังรอคิวพอดี (กันคะแนนไม่ครบหลุดเข้า FinalResults)
    const missingAfterLock = getMissingScoreStudents(subjectId, academicYearId, classId, semester);
    if (missingAfterLock.length > 0) {
      return {
        status: "error",
        message: `ไม่สามารถส่งผลการเรียนได้ เนื่องจากยังมีนักเรียน ${missingAfterLock.length} คน กรอกคะแนนภาคเรียนที่ ${semester} ไม่ครบทุกช่องเก็บคะแนน กรุณากรอกคะแนนให้ครบทุกคนก่อนส่งผลการเรียน`,
        missingStudents: missingAfterLock,
      };
    }

    // ต้องส่งภาคเรียนที่ 1 ก่อนเสมอ จึงจะส่งภาคเรียนที่ 2 ได้ (เช็คซ้ำในนี้ด้วยเพราะถืออยู่ในโซนที่ล็อกแล้ว
    // กันกรณีภาคเรียนที่ 1 เพิ่งถูกถอนออกไปพร้อมๆ กับที่คำขอนี้กำลังรอคิว)
    if (semester === 2 && !isSemesterSubmitted(subjectId, academicYearId, classId, 1)) {
      return {
        status: "error",
        message: 'ต้อง "ส่งผลการเรียน" ภาคเรียนที่ 1 ก่อน จึงจะส่งผลการเรียนภาคเรียนที่ 2 ได้',
      };
    }

    // เช็คซ้ำอีกครั้งด้วยข้อมูลสดหลังได้ล็อกแล้ว กันการส่งซ้ำซ้อนถ้ามีคำขอมาพร้อมกัน
    if (!isSemesterSubmitted(subjectId, academicYearId, classId, semester)) {
      const sheet = SS.getSheetByName("SemesterSubmissions");
      const allSubs = getSheetData("SemesterSubmissions");
      let maxNum = allSubs.reduce((max, r) => {
        const match = String(r.SubmissionID || "").match(/^SUB(\d+)$/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      sheet.appendRow([
        "SUB" + String(maxNum + 1).padStart(6, "0"),
        subjectId,
        classId,
        academicYearId,
        semester,
        userId,
        new Date().toISOString(),
      ]);
      invalidateSheetCache("SemesterSubmissions");
    }

    // ส่งครบทั้ง 2 ภาคเรียนแล้วหรือยัง ถ้าครบให้คำนวณคะแนนปีการศึกษาจริงและบันทึกลง FinalResults
    syncFinalResultsForYear(subjectId, academicYearId, classId, userId);

    return { status: "success" };
  } finally {
    lock.releaseLock();
  }
}

function handleWithdrawFinalResults(body) {
  const subjectId = body.subjectId;
  const academicYearId = body.academicYearId;
  const classId = body.classId;
  const semester = Number(body.semester);

  if (!subjectId || !academicYearId || !classId || (semester !== 1 && semester !== 2)) {
    return { status: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

  if (!isAssignedToTeach(body.userId, subjectId, academicYearId, classId)) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ลบผลการเรียนวิชา/ห้องเรียนนี้" };
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
    // รักษาลำดับให้สอดคล้องกับตอนส่ง: ถ้าจะถอนภาคเรียนที่ 1 ต้องถอนภาคเรียนที่ 2 ออกไปก่อน (ถ้ามี)
    // ป้องกันไม่ให้เกิดสถานะ "ส่งภาค 2 แล้วแต่ภาค 1 ไม่ได้ส่ง" ซึ่งขัดกับกฎการส่งตามลำดับ
    if (semester === 1 && isSemesterSubmitted(subjectId, academicYearId, classId, 2)) {
      return {
        status: "error",
        message: 'ต้อง "ถอนผลการเรียน" ภาคเรียนที่ 2 ก่อน จึงจะถอนผลการเรียนภาคเรียนที่ 1 ได้',
      };
    }

    const sheet = SS.getSheetByName("SemesterSubmissions");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colIndex = {};
    headers.forEach((h, i) => (colIndex[h] = i));

    const rowsToDelete = [];
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (
        String(row[colIndex.SubjectID]) === String(subjectId) &&
        String(row[colIndex.AcademicYearID]) === String(academicYearId) &&
        String(row[colIndex.ClassID]) === String(classId) &&
        String(row[colIndex.Semester]) === String(semester)
      ) {
        rowsToDelete.push(r + 1);
      }
    }
    deleteSheetRowsDescending(sheet, rowsToDelete);
    invalidateSheetCache("SemesterSubmissions");

    // ถอนภาคเรียนนี้ออกแล้ว ผลการเรียนทั้งปีย่อมไม่สมบูรณ์อีกต่อไป -> sync ให้ FinalResults ถูกลบออกไปด้วย
    syncFinalResultsForYear(subjectId, academicYearId, classId, body.userId);

    return { status: "success" };
  } finally {
    lock.releaseLock();
  }
}

/**
 * สร้างรายงาน "ปถ.05" (แบบบันทึกผลการพัฒนาคุณภาพของผู้เรียนรายวิชา) เป็นไฟล์ PDF
 * โดยคัดลอกจากไฟล์ Google Sheets ต้นแบบ (PT05_TEMPLATE_FILE_ID) แล้วกรอกข้อมูลจริงลงไป
 * ใช้ข้อมูลชุดเดียวกับที่คำนวณไว้แล้วใน buildFinalizeData() (หน้า "ตัดสินผลการเรียน")
 * ต้องเป็นครูที่ได้รับมอบหมายให้สอนวิชา/ห้องเรียนนี้เท่านั้นจึงจะเรียกใช้ได้
 */
function handleGenerateSubjectReport(body) {
  const subjectId = body.subjectId;
  const academicYearId = body.academicYearId;
  const classId = body.classId;
  const userId = body.userId;

  if (!subjectId || !academicYearId || !classId) {
    return { status: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

  if (!isAssignedToTeach(userId, subjectId, academicYearId, classId)) {
    return { status: "error", message: "คุณไม่มีสิทธิ์ออกรายงานวิชา/ห้องเรียนนี้" };
  }

  if (
    !PT05_TEMPLATE_FILE_ID ||
    PT05_TEMPLATE_FILE_ID.indexOf("ใส่_") === 0 ||
    !PT05_REPORTS_FOLDER_ID ||
    PT05_REPORTS_FOLDER_ID.indexOf("ใส่_") === 0
  ) {
    return { status: "error", message: "ระบบยังไม่ได้ตั้งค่าไฟล์เทมเพลต/โฟลเดอร์เก็บรายงาน ปถ.05 กรุณาติดต่อผู้ดูแลระบบ" };
  }

  // ต้อง "ส่งผลการเรียน" อย่างน้อยภาคเรียนที่ 1 ในเมนูตัดสินผลการเรียนของวิชา/ห้องนี้ก่อน จึงจะออกรายงาน ปถ.05 ได้
  // - ส่งแค่ภาคเรียนที่ 1 -> ออกรายงานได้ แต่แสดงเฉพาะข้อมูลภาคเรียนที่ 1 (คอลัมน์ภาคเรียนที่ 2/ปีการศึกษา/ผลการเรียน เป็น "-")
  // - ส่งครบทั้ง 2 ภาคเรียน -> ออกรายงานแบบเต็ม แสดงข้อมูลครบทุกคอลัมน์
  const isSem1Submitted = isSemesterSubmitted(subjectId, academicYearId, classId, 1);
  const isSem2Submitted = isSemesterSubmitted(subjectId, academicYearId, classId, 2);

  if (!isSem1Submitted) {
    return {
      status: "error",
      message: 'กรุณา "ส่งผลการเรียน" อย่างน้อยภาคเรียนที่ 1 ในเมนูตัดสินผลการเรียนของวิชา/ห้องนี้ก่อน จึงจะออกรายงาน ปถ.05 ได้',
    };
  }
  const reportScope = isSem2Submitted ? "full" : "sem1";

  const built =
    reportScope === "full"
      ? buildFinalizeData(subjectId, academicYearId, classId, userId)
      : buildSemester1OnlyData(subjectId, academicYearId, classId, userId);
  if (built.status !== "success") return built;

  const students = built.data;
  if (students.length === 0) {
    return { status: "error", message: "ไม่พบนักเรียนในห้องเรียนนี้" };
  }
  if (students.length > 40) {
    return { status: "error", message: "จำนวนนักเรียนเกินกว่าที่เทมเพลตรองรับ (สูงสุด 40 คน)" };
  }

  const subject = getSheetData("Subjects").find((s) => String(s.SubjectID) === String(subjectId));
  const cls = getSheetData("Classes").find((c) => String(c.ClassID) === String(classId));
  const academicYear = getSheetData("AcademicYears").find(
    (y) => String(y.AcademicYearID) === String(academicYearId)
  );
  const users = getSheetData("Users");

  if (!subject || !cls || !academicYear) {
    return { status: "error", message: "ไม่พบข้อมูลวิชา/ห้องเรียน/ปีการศึกษาที่เกี่ยวข้อง" };
  }

  // ครูผู้สอน (สูงสุด 3 คน) — เอาจากผู้ที่ได้รับมอบหมายให้สอนวิชานี้ ห้องนี้ ปีการศึกษานี้
  const teacherUserIds = [];
  getSheetData("TeachingAssignments").forEach((a) => {
    if (
      String(a.SubjectID) === String(subjectId) &&
      String(a.AcademicYearID) === String(academicYearId) &&
      String(a.ClassID) === String(classId) &&
      teacherUserIds.indexOf(String(a.TeacherUserID)) === -1
    ) {
      teacherUserIds.push(String(a.TeacherUserID));
    }
  });
  const teacherNames = teacherUserIds.slice(0, 3).map((uid) => {
    const u = users.find((usr) => String(usr.UserID) === String(uid));
    return u ? u.FullName : "";
  });

  const homeroomTeacher = users.find((u) => String(u.UserID) === String(cls.HomeroomTeacherUserID));
  const homeroomTeacherName = homeroomTeacher ? homeroomTeacher.FullName : "";

  const gradeLevelNumber = String(cls.GradeLevel).replace(/[^0-9]/g, "") || cls.GradeLevel;

  const sumOf = (arr) => arr.reduce((a, b) => a + b, 0);
  const avgOf = (arr) => sumOf(arr) / arr.length;
  const stdDevOf = (arr) => {
    const m = avgOf(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
  };
  const round2 = (v) => Number(v.toFixed(2));

  // สรุปสถิติผลการเรียนของทั้งห้อง ตามช่องในเทมเพลต (ระดับ 4, 3.5, 3, 2.5, 2, 1.5, 1, 0)
  // มีความหมาย/คำนวณได้ก็ต่อเมื่อส่งผลครบทั้งปีแล้วเท่านั้น (ต้องมี gradePoint) — ถ้าเป็นรายงานภาคเรียนที่ 1 เพียงอย่างเดียว ใส่ "-" แทนทั้งหมด
  const gradeLevels = [4, 3.5, 3, 2.5, 2, 1.5, 1, 0];
  const total = students.length;
  let counts, percents, passPercent, failPercent, avgGrade, stdDev;

  if (reportScope === "full") {
    counts = gradeLevels.map((lv) => students.filter((st) => Number(st.gradePoint) === lv).length);
    percents = counts.map((c) => (c > 0 ? ((c / total) * 100).toFixed(2) : "-"));
    const passCount = students.filter((st) => Number(st.gradePoint) >= 3).length;
    const failCount = students.filter((st) => Number(st.gradePoint) === 0).length;
    passPercent = ((passCount / total) * 100).toFixed(2);
    failPercent = failCount > 0 ? ((failCount / total) * 100).toFixed(2) : "-";
    avgGrade = students.reduce((sum, st) => sum + Number(st.gradePoint), 0) / total;
    const variance = students.reduce((sum, st) => sum + Math.pow(Number(st.gradePoint) - avgGrade, 2), 0) / total;
    stdDev = Math.sqrt(variance);
  } else {
    counts = gradeLevels.map(() => "-");
    percents = gradeLevels.map(() => "-");
    passPercent = "-";
    failPercent = "-";
    avgGrade = null;
    stdDev = null;
  }

  // สถิติคะแนนดิบระดับ "ทั้งปี" สำหรับแผงสรุปในชีต "ประเมินผลสัมฤทธิ์" (คอลัมน์ K:M) — เช่นเดียวกัน มีความหมายเฉพาะตอนส่งครบทั้งปีแล้ว
  // คิดต่อนักเรียน 1 คน: ระหว่างภาค = เฉลี่ยระหว่างภาคของภาคเรียนที่ 1 และ 2 (เต็ม 70)
  //                       ปลายภาค = เฉลี่ยปลายภาคของภาคเรียนที่ 1 และ 2 (เต็ม 30)
  //                       รวม = คะแนนปีการศึกษา (yearScore100, เต็ม 100)
  let midtermValues = [];
  let finalExamValues = [];
  let yearTotalValues = [];
  let scorePanelRows = null;

  if (reportScope === "full") {
    // ใช้กฎปัดเดียวกับตอนส่งผลการเรียน (computeYearScores) เพื่อให้ ระหว่างภาค + ปลายภาค = รวม พอดีเสมอ (8 ต.ค. 2569)
    const yearScoresList = students.map((st) =>
      computeYearScores(st.semester1Raw70, st.semester1Exam30, st.semester2Raw70, st.semester2Exam30)
    );
    midtermValues = yearScoresList.map((y) => y.raw70);
    finalExamValues = yearScoresList.map((y) => y.exam30);
    yearTotalValues = yearScoresList.map((y) => y.total100);

    scorePanelRows = {
      sum: [midtermValues, finalExamValues, yearTotalValues].map((arr) => round2(sumOf(arr))),
      avg: [midtermValues, finalExamValues, yearTotalValues].map((arr) => round2(avgOf(arr))),
      sd: [midtermValues, finalExamValues, yearTotalValues].map((arr) => round2(stdDevOf(arr))),
      max: [midtermValues, finalExamValues, yearTotalValues].map((arr) => round2(Math.max.apply(null, arr))),
      min: [midtermValues, finalExamValues, yearTotalValues].map((arr) => round2(Math.min.apply(null, arr))),
    };
  }

  // คัดลอกไฟล์เทมเพลตไปไว้ในโฟลเดอร์เก็บรายงาน
  const fileName =
    "ปถ05_" +
    subjectId +
    "_" +
    subject.SubjectName +
    "_ป." +
    gradeLevelNumber +
    "-" +
    cls.RoomNumber +
    "_" +
    academicYear.Year +
    (reportScope === "sem1" ? "_ภาคเรียนที่1" : "");
  const reportsFolder = DriveApp.getFolderById(PT05_REPORTS_FOLDER_ID);
  const templateFile = DriveApp.getFileById(PT05_TEMPLATE_FILE_ID);
  const copyFile = templateFile.makeCopy(fileName, reportsFolder);

  try {
    const reportSs = SpreadsheetApp.openById(copyFile.getId());
    const coverSheet = reportSs.getSheetByName("หน้าปก");
    const scoreSheet = reportSs.getSheetByName("ประเมินผลสัมฤทธิ์");

    // ----- หน้าปก -----
    coverSheet
      .getRange("A9")
      .setValue("ชั้นประถมศึกษาปีที่  " + gradeLevelNumber + "/" + cls.RoomNumber + "  ปีการศึกษา  " + academicYear.Year);
    coverSheet.getRange("A11").setValue("กลุ่มสาระการเรียนรู้" + (subject.SubjectGroup || ""));
    coverSheet.getRange("A12").setValue("รหัสวิชา  " + subjectId + "  รายวิชา  " + subject.SubjectName);
    coverSheet.getRange("A13").setValue("เวลาเรียน  " + (subject.Hours || "") + "  ชั่วโมง/ปี");

    coverSheet.getRange("I15").setValue(teacherNames[0] || "");
    coverSheet.getRange("I16").setValue(teacherNames[1] || "");
    coverSheet.getRange("I17").setValue(teacherNames[2] || "");
    coverSheet.getRange("I18").setValue(homeroomTeacherName);

    // หมายเหตุ: เทมเพลตเวอร์ชันนี้ตัดคอลัมน์ "จำนวนนักเรียนที่เข้าสอบ" ออก และเลื่อนบล็อกสถิติขึ้น 1 แถวเทียบกับเวอร์ชันก่อนหน้า
    coverSheet.getRange("A23").setValue(total);

    const countCells = ["G23", "I23", "K23", "M23", "O23", "Q23", "S23", "U23"];
    const percentCells = ["G24", "I24", "K24", "M24", "O24", "Q24", "S24", "U24"];
    countCells.forEach((cell, idx) => coverSheet.getRange(cell).setValue(counts[idx] > 0 ? counts[idx] : "-"));
    percentCells.forEach((cell, idx) => coverSheet.getRange(cell).setValue(percents[idx]));
    // ระดับ "ร" (W23/W24) และ "มส" (Y23/Y24) — ระบบยังไม่มีการติดตามผลไม่สมบูรณ์/ไม่ผ่านสอบ จึงไม่มีข้อมูล
    coverSheet.getRange("W23").setValue("-");
    coverSheet.getRange("Y23").setValue("-");
    coverSheet.getRange("W24").setValue("-");
    coverSheet.getRange("Y24").setValue("-");

    coverSheet.getRange("L25").setValue(passPercent);
    coverSheet.getRange("AA25").setValue(avgGrade !== null ? avgGrade.toFixed(2) : "-");
    coverSheet.getRange("L26").setValue(failPercent);
    coverSheet.getRange("AA26").setValue(stdDev !== null ? stdDev.toFixed(2) : "-");

    // ----- ประเมินผลสัมฤทธิ์ -----
    scoreSheet
      .getRange("A1")
      .setValue("แบบประเมินผลคุณภาพผู้เรียน  รายวิชา  " + subject.SubjectName + "  (" + subjectId + ")");
    scoreSheet
      .getRange("A2")
      .setValue("ชั้นประถมศึกษาปีที่  " + gradeLevelNumber + "/" + cls.RoomNumber + "  ปีการศึกษา  " + academicYear.Year);

    // เทมเพลตเวอร์ชันนี้เพิ่มคอลัมน์ "ปีการศึกษา" (ระหว่าง/ปลายภาค/รวม) ไว้ก่อนคอลัมน์ "ผลการเรียน"
    // ระหว่าง = เฉลี่ยระหว่างภาคของภาคเรียนที่ 1 และ 2 (เต็ม 70), ปลายภาค = เฉลี่ยปลายภาคของภาคเรียนที่ 1 และ 2 (เต็ม 30)
    // รวม = คะแนนปีการศึกษา (yearScore100, เต็ม 100) — ใช้ค่าเดียวกับที่คำนวณไว้แล้วสำหรับแผงสถิติด้านล่าง
    const maxDataRows = 40;
    const rows = [];
    for (let i = 0; i < maxDataRows; i++) {
      const st = students[i];
      if (!st) {
        rows.push(["", "", "", "", "", "", "", "", "", "", "", ""]);
        continue;
      }
      if (reportScope === "full") {
        rows.push([
          st.studentNumber,
          st.fullName,
          Number(st.semester1Raw70.toFixed(2)),
          Number(st.semester1Exam30.toFixed(2)),
          Number(st.semester1Total100.toFixed(2)),
          Number(st.semester2Raw70.toFixed(2)),
          Number(st.semester2Exam30.toFixed(2)),
          Number(st.semester2Total100.toFixed(2)),
          Number(midtermValues[i].toFixed(2)),
          Number(finalExamValues[i].toFixed(2)),
          Number(yearTotalValues[i].toFixed(2)),
          st.gradePoint,
        ]);
      } else {
        // ส่งแค่ภาคเรียนที่ 1 -> แสดงเฉพาะคอลัมน์ภาคเรียนที่ 1 ส่วนภาคเรียนที่ 2/ปีการศึกษา/ผลการเรียน ยังไม่มีข้อมูลจริง ใส่ "-"
        rows.push([
          st.studentNumber,
          st.fullName,
          Number(st.semester1Raw70.toFixed(2)),
          Number(st.semester1Exam30.toFixed(2)),
          Number(st.semester1Total100.toFixed(2)),
          "-",
          "-",
          "-",
          "-",
          "-",
          "-",
          "-",
        ]);
      }
    }
    scoreSheet.getRange(7, 1, maxDataRows, 12).setValues(rows);

    // แผงสรุปสถิติผลสัมฤทธิ์ "สารสนเทศระดับห้องเรียน" (คอลัมน์ M:O ในเทมเพลตเวอร์ชันนี้) — คิดคะแนนเป็นระดับ "ทั้งปี" ตามที่กำหนด
    // มีความหมายเฉพาะตอนส่งครบทั้งปีแล้ว ถ้าเป็นรายงานภาคเรียนที่ 1 เพียงอย่างเดียว ใส่ "-" แทนทั้งแผง
    if (reportScope === "full") {
      scoreSheet.getRange("M10:O10").setValues([scorePanelRows.sum]);
      scoreSheet.getRange("M13:O13").setValues([scorePanelRows.avg]);
      scoreSheet.getRange("M16:O16").setValues([scorePanelRows.sd]);
      scoreSheet.getRange("M19:O19").setValues([scorePanelRows.max]);
      scoreSheet.getRange("M22:O22").setValues([scorePanelRows.min]);
    } else {
      const dashRow = [["-", "-", "-"]];
      scoreSheet.getRange("M10:O10").setValues(dashRow);
      scoreSheet.getRange("M13:O13").setValues(dashRow);
      scoreSheet.getRange("M16:O16").setValues(dashRow);
      scoreSheet.getRange("M19:O19").setValues(dashRow);
      scoreSheet.getRange("M22:O22").setValues(dashRow);
    }

    // ผลการเรียนเฉลี่ย — เป็นค่าเดียว ไม่แยกระหว่าง/ปลายภาค จึงใส่ไว้ที่ช่อง "รวม" เท่านั้น (มีความหมายเฉพาะตอนส่งครบทั้งปีแล้ว)
    scoreSheet.getRange("M26").setValue("-");
    scoreSheet.getRange("N26").setValue("-");
    scoreSheet.getRange("O26").setValue(avgGrade !== null ? round2(avgGrade) : "-");

    // ตารางกระจายผลการเรียน (N28:O35) — ใช้ตัวเลขชุดเดียวกับที่กรอกในชีต "หน้าปก"
    // คอลัมน์ M28:M35 (ระดับผลการเรียน) เป็นค่าที่มีอยู่แล้วในเทมเพลต ไม่ต้องเขียนทับ
    const distributionRows = gradeLevels.map((lv, idx) => [counts[idx] > 0 ? counts[idx] : "-", percents[idx]]);
    scoreSheet.getRange(28, 14, gradeLevels.length, 2).setValues(distributionRows);

    SpreadsheetApp.flush();

    // ส่งออกเป็น PDF ทุกชีตในไฟล์ (ไม่ระบุ gid) รวมเป็นไฟล์เดียว หน้าปกก่อน แล้วตามด้วยตารางคะแนน
    const exportUrl =
      "https://docs.google.com/spreadsheets/d/" +
      copyFile.getId() +
      "/export?format=pdf&size=A4&portrait=true&scale=4&top_margin=0.25&bottom_margin=0.25&left_margin=0.25&right_margin=0.25&horizontal_alignment=CENTER&vertical_alignment=TOP&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false";
    const pdfResponse = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    });

    if (pdfResponse.getResponseCode() !== 200) {
      return { status: "error", message: "ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง" };
    }

    const pdfBlob = pdfResponse.getBlob().setName(fileName + ".pdf");
    const pdfFile = reportsFolder.createFile(pdfBlob);
    const base64 = Utilities.base64Encode(pdfBlob.getBytes());

    return {
      status: "success",
      data: {
        fileName: fileName + ".pdf",
        driveUrl: pdfFile.getUrl(),
        base64: base64,
      },
    };
  } finally {
    // เก็บเฉพาะไฟล์ PDF ไว้ ลบไฟล์ Google Sheets ชั่วคราวที่ใช้กรอกข้อมูลทิ้ง
    copyFile.setTrashed(true);
  }
}

/**
 * ===== งานบำรุงรักษา (รันมือครั้งเดียวจาก Apps Script Editor) — 7 ต.ค. 2569 =====
 * คำนวณคะแนนปี/เกรดใน FinalResults ใหม่ทั้งหมดด้วยกฎการปัดล่าสุด (ทศนิยม 2 ตำแหน่ง ตัดเกรดตามค่าที่แสดง)
 * ใช้กับวิชา/ห้อง/ปีที่ "ส่งผลการเรียนครบทั้ง 2 ภาคเรียน" และมีแถวใน FinalResults อยู่แล้วเท่านั้น (ไม่สร้างผลใหม่ให้วิชาที่ยังส่งไม่ครบ)
 * วิธีใช้: เปิด Apps Script Editor > เลือกฟังก์ชัน recomputeAllFinalResultsWithRounding > กด Run > ดูผลที่ View > Logs
 */
function recomputeAllFinalResultsWithRounding() {
  const finalRows = getSheetData("FinalResults");
  const assignments = getSheetData("TeachingAssignments");
  const done = {};
  let recomputed = 0;
  let skipped = 0;

  finalRows.forEach((r) => {
    const key = [r.SubjectID, r.AcademicYearID, r.ClassID].join("|");
    if (done[key]) return;
    done[key] = true;

    const teacher = assignments.find(
      (a) =>
        String(a.SubjectID) === String(r.SubjectID) &&
        String(a.AcademicYearID) === String(r.AcademicYearID) &&
        String(a.ClassID) === String(r.ClassID)
    );
    if (!teacher) {
      skipped++;
      Logger.log("ข้าม (ไม่พบครูผู้สอนที่มอบหมาย): " + key);
      return;
    }
    // ขอ lock ทีละชุด (ใช้ lock เดียวกับตอนส่ง/ถอนผลการเรียน) กันชนกับครูที่กำลังส่งผลอยู่
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) {
      skipped++;
      Logger.log("ข้าม (ระบบกำลังถูกใช้งาน ขอ lock ไม่ได้): " + key + " — รันฟังก์ชันนี้ซ้ำอีกครั้งได้");
      return;
    }
    try {
      syncFinalResultsForYear(r.SubjectID, r.AcademicYearID, r.ClassID, teacher.TeacherUserID);
      recomputed++;
    } finally {
      lock.releaseLock();
    }
  });

  Logger.log("คำนวณใหม่แล้ว " + recomputed + " ชุด (วิชา/ห้อง/ปี) ข้าม " + skipped + " ชุด");
}

/**
 * ===== ล้างเซสชันที่หมดอายุ (8 ต.ค. 2569) =====
 * ชีต Sessions เพิ่มแถวทุกครั้งที่ login แต่แถวหมดอายุจะถูกลบเฉพาะเมื่อมีคนใช้ token นั้นอีกครั้ง ทำให้ชีตโตขึ้นเรื่อยๆ
 * และ verifySession ต้องอ่านทั้งชีตทุกครั้งที่แคชหมด -> ฟังก์ชันนี้ลบแถวที่หมดอายุทิ้งทั้งหมดในครั้งเดียว
 * ตั้งให้รันอัตโนมัติวันละครั้งด้วย setupSessionCleanupTrigger() (รันมือครั้งเดียว)
 */
function cleanupExpiredSessions() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    Logger.log("ขอ lock ไม่ได้ ข้ามรอบนี้");
    return;
  }
  try {
    const sheet = SS.getSheetByName("Sessions");
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const expIdx = headers.indexOf("ExpiresAt");
    if (expIdx === -1) throw new Error("ไม่พบคอลัมน์ ExpiresAt ในชีต Sessions");

    const expValues = sheet.getRange(2, expIdx + 1, lastRow - 1, 1).getValues();
    const now = Date.now();
    const rowsToDelete = [];
    expValues.forEach((row, i) => {
      const t = new Date(row[0]).getTime();
      if (isNaN(t) || t < now) rowsToDelete.push(i + 2);
    });

    if (rowsToDelete.length > 0) deleteSheetRowsDescending(sheet, rowsToDelete);
    Logger.log("ลบเซสชันที่หมดอายุแล้ว " + rowsToDelete.length + " รายการ");
  } finally {
    lock.releaseLock();
  }
}

/**
 * รันมือครั้งเดียวจาก Apps Script Editor เพื่อตั้งให้ cleanupExpiredSessions() ทำงานอัตโนมัติทุกวันเวลาตี 3 (ไม่สร้างซ้ำถ้ามีอยู่แล้ว)
 */
function setupSessionCleanupTrigger() {
  const exists = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === "cleanupExpiredSessions");
  if (exists) {
    Logger.log("มี trigger ล้างเซสชันอยู่แล้ว ไม่สร้างซ้ำ");
    return;
  }
  ScriptApp.newTrigger("cleanupExpiredSessions").timeBased().everyDays(1).atHour(3).create();
  Logger.log("ตั้ง trigger ล้างเซสชันรายวัน (ตี 3) เรียบร้อย");
}