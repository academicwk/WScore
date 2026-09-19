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
  deleteTeachingAssignment: ["REGISTRAR", "ASSISTANT_REGISTRAR"],
};

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
      case "updateSubject":
        result = handleUpdateSubject(body);
        break;
      case "deleteSubject":
        result = handleDeleteSubject(body.subjectId);
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
        result = handleDeleteStudent(body.studentId);
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
        result = handleDeleteClass(body.classId);
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
      case "deleteTeachingAssignment":
        result = handleDeleteTeachingAssignment(body.teachingAssignmentId);
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
function handleDeleteSubject(subjectId) {
  if (!subjectId) {
    return { status: "error", message: "ไม่พบรหัสวิชาที่ต้องการลบ" };
  }

  const rowIndex = findRowIndexByColumnValue("Subjects", "SubjectID", subjectId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบรายวิชานี้ในระบบ" };
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
  return { status: "success", message: "แก้ไขข้อมูลนักเรียนเรียบร้อยแล้ว" };
}

/**
 * ลบนักเรียน
 */
function handleDeleteStudent(studentId) {
  if (!studentId) {
    return { status: "error", message: "ไม่พบเลขประจำตัวนักเรียนที่ต้องการลบ" };
  }

  const rowIndex = findRowIndexByColumnValue("Students", "StudentID", studentId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบนักเรียนคนนี้ในระบบ" };
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

function handleGetDashboardData(body) {
  const role = body.role;
  const userId = body.userId;

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

    const classes = getSheetData("Classes");
    const subjects = handleGetSubjects().data;
    const allComponents = getCachedSheetData("GradeComponents", 120);
    const allSubComponents = getCachedSheetData("GradeSubComponents", 60);
    const allEnrollments = getCachedSheetData("StudentEnrollments", 60);
    // คะแนนและสถานะส่งผลการเรียนต้องอ่านสดเสมอ เพื่อให้ % ความคืบหน้าและสถานะส่งผลตรงกับความเป็นจริงเสมอ
    const allScores = getSheetData("StudentScores");
    const allSemesterSubmissions = getSheetData("SemesterSubmissions");

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

          const filled = allScores.filter(
            (s) => String(s.ClassID) === String(a.ClassID) && String(s.ComponentID) === String(c.ComponentID)
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
        label: (subj ? subj.SubjectName : a.SubjectID) + " - " + (cls ? cls.GradeLevel + "/" + cls.RoomNumber : a.ClassID),
        semester1Components: semesterComponents(1),
        semester2Components: semesterComponents(2),
        isSubmittedSem1: isSemesterSubmittedLocal(1),
        isSubmittedSem2: isSemesterSubmittedLocal(2),
      };
    });

    // การ์ดสรุป: รายวิชา = นับแยกตามรหัสวิชา (ไม่ซ้ำ) ไม่ว่าจะสอนกี่ห้องก็ตาม
    const distinctSubjectCount = new Set(myAssignments.map((a) => String(a.SubjectID))).size;
    // ห้องที่สอน = นับห้องไม่ซ้ำ รวมทุกวิชา
    const distinctClassCount = new Set(myAssignments.map((a) => String(a.ClassID))).size;
    // นักเรียนที่สอน = รวมจำนวนนักเรียนที่ลงทะเบียนของทุกวิชา/ทุกห้องที่สอน (นับซ้ำได้ถ้าสอนหลายวิชาในห้องเดียวกัน)
    const totalStudents = myAssignments.reduce(
      (sum, a) => sum + allEnrollments.filter((e) => String(e.ClassID) === String(a.ClassID)).length,
      0
    );

    const dashboardResult = {
      cards: [
        { icon: "fa-book-open", label: "รายวิชาที่สอน", value: distinctSubjectCount + " วิชา" },
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
    const currentYear = academicYears.find(
      (y) => y.IsCurrent === true || String(y.IsCurrent).toUpperCase() === "TRUE"
    );
    const currentYearId = currentYear ? currentYear.AcademicYearID : null;

    const classes = getSheetData("Classes");
    const myClasses = classes.filter(
      (c) =>
        String(c.AcademicYearID) === String(currentYearId) &&
        (String(c.HomeroomTeacherUserID) === String(userId) ||
          String(c.HomeroomTeacherUserID2) === String(userId))
    );
    const studentCount = myClasses.reduce((sum, c) => sum + (Number(c.StudentCount) || 0), 0);

    return {
      status: "success",
      data: {
        cards: [
          { icon: "fa-user-graduate", label: "นักเรียนในห้อง", value: studentCount + " คน" },
          { icon: "fa-triangle-exclamation", label: "ข้อมูลไม่ครบ", value: "ยังไม่เปิดใช้งาน" },
          { icon: "fa-chart-line", label: "เกรดเฉลี่ยห้อง", value: "ยังไม่เปิดใช้งาน" },
        ],
        progress: [],
        quickActions: [
          { icon: "fa-user-check", label: "บันทึกเวลาเรียน/กิจกรรมโฮมรูม", href: "homeroom-activity.html" },
          { icon: "fa-star", label: "ประเมินคุณลักษณะ/อ่านคิดวิเคราะห์", href: "homeroom-evaluation.html" },
        ],
      },
    };
  }

  if (role === "DIRECTOR") {
    const students = getSheetData("Students");
    const activeStudents = students.filter((s) => String(s.Status).trim() === "กำลังศึกษา");

    return {
      status: "success",
      data: {
        cards: [
          { icon: "fa-user-graduate", label: "นักเรียนทั้งหมด", value: activeStudents.length + " คน" },
          { icon: "fa-chart-line", label: "ผลสัมฤทธิ์เฉลี่ยรวม", value: "ยังไม่เปิดใช้งาน" },
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
  const students = getSheetData("Students");
  const activeStudents = students.filter((s) => String(s.Status).trim() === "กำลังศึกษา");

  const subjects = getSheetData("Subjects");

  const userRoles = getSheetData("UserRoles");
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
        { icon: "fa-user-graduate", label: "นักเรียนทั้งหมด", value: activeStudents.length + " คน" },
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
  return { status: "success", message: "แก้ไขห้องเรียนเรียบร้อยแล้ว" };
  }

/**
 * ลบห้องเรียน
 */
function handleDeleteClass(classId) {
  if (!classId) {
    return { status: "error", message: "ไม่พบห้องเรียนที่ต้องการลบ" };
  }

  const rowIndex = findRowIndexByColumnValue("Classes", "ClassID", classId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบห้องเรียนนี้ในระบบ" };
  }

  SS.getSheetByName("Classes").deleteRow(rowIndex);

  CacheService.getScriptCache().remove("classesPageData");
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

  const users = getSheetData("Users");
  const userRoles = getSheetData("UserRoles");
  const homeroomUserIds = userRoles.filter((r) => r.RoleType === "HOMEROOM_TEACHER").map((r) => r.UserID);
  const homeroomTeachers = users
    .filter((u) => homeroomUserIds.indexOf(u.UserID) !== -1)
    .map((u) => ({ userId: u.UserID, fullName: u.FullName, position: u.Position }));

  const classes = getSheetData("Classes");

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

  const classes = getSheetData("Classes");

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
}


function handleAddEnrollmentsBulk(body) {
  if (!body.studentIds || !Array.isArray(body.studentIds) || body.studentIds.length === 0 || !body.classId || !body.academicYearId) {
    return { status: "error", message: "กรุณาเลือกนักเรียนอย่างน้อย 1 คน" };
  }

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
}

function handleUpdateEnrollmentNumber(body) {
  if (!body.enrollmentId || !body.studentNumber) {
    return { status: "error", message: "ข้อมูลไม่ครบถ้วน" };
  }

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
}

function handleDeleteEnrollment(enrollmentId) {
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
}

function adjustClassStudentCount(classId, delta) {
  const rowIndex = findRowIndexByColumnValue("Classes", "ClassID", classId);
  if (rowIndex === -1) return;

  const sheet = SS.getSheetByName("Classes");
  const currentCount = Number(sheet.getRange(rowIndex, 7).getValue()) || 0;
  const newCount = Math.max(0, currentCount + delta);
  sheet.getRange(rowIndex, 7).setValue(newCount);
  CacheService.getScriptCache().remove("classesPageData");
}


function handleGetTeachingAssignmentsPageData() {
  const academicYears = getSheetData("AcademicYears");
  academicYears.sort((a, b) => String(b.Year).localeCompare(String(a.Year)));

  const classes = getSheetData("Classes");
  const subjects = getSheetData("Subjects");

  const users = getSheetData("Users");
  const userRoles = getSheetData("UserRoles");
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

function handleDeleteTeachingAssignment(teachingAssignmentId) {
  const rowIndex = findRowIndexByColumnValue("TeachingAssignments", "TeachingAssignmentID", teachingAssignmentId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบข้อมูลมอบหมายการสอนนี้" };
  }
  SS.getSheetByName("TeachingAssignments").deleteRow(rowIndex);
  invalidateSheetCache("TeachingAssignments");
  return { status: "success" };
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

  // ล็อกกันช่องเก็บคะแนนซ้ำรหัส/เกิน 10 ช่อง กรณีกดเพิ่มพร้อมกัน (เช่น กดปุ่มรัว หรือเปิดหลายแท็บ)
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
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

    SS.getSheetByName("GradeSubComponents").appendRow([newId, componentId, subComponentName, maxScore, existing.length + 1]);
    invalidateSheetCache("GradeSubComponents");

    return { status: "success", data: { subComponentId: newId } };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ลบช่องเก็บคะแนนย่อย ต้องเป็นครูที่สอนวิชานี้จริงเท่านั้น
 */
function handleDeleteGradeSubComponent(body) {
  const subComponentId = body.subComponentId;

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

  const rowIndex = findRowIndexByColumnValue("GradeSubComponents", "SubComponentID", subComponentId);
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบช่องเก็บคะแนนนี้" };
  }
  SS.getSheetByName("GradeSubComponents").deleteRow(rowIndex);
  invalidateSheetCache("GradeSubComponents");
  return { status: "success" };
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
      };
    })
    .sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));

  // คะแนนต้องอ่านสด ห้ามแคช เพราะเป็นข้อมูลที่ครูกำลังแก้ไข/ต้องเห็นค่าล่าสุดเสมอ
  const scores = getSheetData("StudentScores").filter(
    (s) =>
      String(s.ClassID) === String(classId) &&
      String(s.SubjectID) === String(subjectId) &&
      String(s.AcademicYearID) === String(academicYearId) &&
      Number(s.Semester) === semester
  );

  // เช็คว่า "ภาคเรียนนี้" ของวิชา/ห้องนี้ถูกส่งผลการเรียนไปแล้วหรือยัง (แยกเช็คเป็นรายภาคเรียน)
  // ถ้าส่งไปแล้ว หน้าเว็บจะล็อกการแก้ไขคะแนนของภาคเรียนนี้ เพื่อไม่ให้ผลการเรียนที่ส่งไปเพี้ยนไปจากคะแนนจริง
  const isSubmitted = isSemesterSubmitted(subjectId, academicYearId, classId, semester);

  return {
    status: "success",
    data: { components, students: studentList, scores, isSubmitted },
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

  // กันชนกันตอนมีครูหลายคนบันทึกคะแนนพร้อมกัน (รองรับสูงสุด ~80 คนพร้อมกัน)
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000); // รอคิวสูงสุด 20 วินาที
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกคะแนนพร้อมกันจำนวนมาก กรุณาลองบันทึกใหม่อีกครั้ง" };
  }

  try {
    const sheet = SS.getSheetByName("StudentScores");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const colIndex = {};
    headers.forEach((h, i) => (colIndex[h] = i));

    // เก็บ key ของแถวเดิมที่อยู่ใน scope นี้ (ห้อง/วิชา/ปี/ภาคเรียนเดียวกัน) -> เลขแถวจริงในชีท
    const existingMap = {};
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (
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
    const scoreColNum = colIndex.Score + 1;

    validScores.forEach((s) => {
      const key = s.studentId + "|" + s.componentId + "|" + (s.subComponentId || "");
      incomingKeys[key] = true;

      if (existingMap[key]) {
        // มีแถวเดิมอยู่แล้ว -> อัพเดทเฉพาะค่าคะแนนในหน่วยความจำ (เขียนกลับทีเดียวด้านล่าง เร็วกว่าการ setValue ทีละเซลล์)
        data[existingMap[key] - 1][colIndex.Score] = Number(s.score);
      } else {
        rowsToAppend.push(s);
      }
    });

    // เขียนค่าที่อัพเดททั้งหมดกลับในครั้งเดียว (แทนการลบ/สร้างใหม่ทั้งหมด)
    sheet.getRange(1, 1, data.length, headers.length).setValues(data);

    // แถวเดิมที่ไม่มีคะแนนส่งมาแล้ว (ครูลบคะแนนออก) -> ลบทิ้งเฉพาะแถวที่จำเป็นจริงๆ
    const rowsToDelete = Object.keys(existingMap)
      .filter((key) => !incomingKeys[key])
      .map((key) => existingMap[key])
      .sort((a, b) => b - a);
    rowsToDelete.forEach((rowNum) => sheet.deleteRow(rowNum));

    // เพิ่มแถวใหม่ (คะแนนที่ยังไม่เคยมีมาก่อน)
    if (rowsToAppend.length > 0) {
      const allScoreIds = getSheetData("StudentScores");
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
  const raw70 = unitsMax > 0 ? (unitsRaw / unitsMax) * 70 : 0;
  const exam30 = examMax > 0 ? (examRaw / examMax) * 30 : 0;
  const total100 = raw70 + exam30;

  return { raw70: raw70, exam30: exam30, total100: total100 };
}

// ===== สถานะการส่งผลการเรียนแยกรายภาคเรียน (Sheet: SemesterSubmissions) =====
// คอลัมน์: SubmissionID, SubjectID, ClassID, AcademicYearID, Semester, UserID, Timestamp
// เป็น "จุดล็อก" ของแต่ละภาคเรียนแยกอิสระจากกัน ครูสามารถส่งภาคเรียนที่ 1 ได้ก่อน โดยยังไม่ต้องมีคะแนนภาคเรียนที่ 2 เลย

function isSemesterSubmitted(subjectId, academicYearId, classId, semester) {
  return getSheetData("SemesterSubmissions").some(
    (r) =>
      String(r.SubjectID) === String(subjectId) &&
      String(r.AcademicYearID) === String(academicYearId) &&
      String(r.ClassID) === String(classId) &&
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
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));

  const allScores = getSheetData("StudentScores").filter(
    (sc) =>
      String(sc.ClassID) === String(classId) &&
      String(sc.SubjectID) === String(subjectId) &&
      String(sc.AcademicYearID) === String(academicYearId)
  );

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
    const yearScore100 = (sem1.total100 + sem2.total100) / 2;
    const gradePoint = scoreToGradePoint(yearScore100);

    return {
      studentId: st.studentId,
      studentNumber: st.studentNumber,
      fullName: st.fullName,
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
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));

  const allScores = getSheetData("StudentScores").filter(
    (sc) =>
      String(sc.ClassID) === String(classId) &&
      String(sc.SubjectID) === String(subjectId) &&
      String(sc.AcademicYearID) === String(academicYearId) &&
      String(sc.Semester) === "1"
  );

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

  const enrollmentCount = getCachedSheetData("StudentEnrollments", 60).filter(
    (e) => String(e.ClassID) === String(classId)
  ).length;
  if (enrollmentCount === 0) {
    return { status: "error", message: "ไม่พบนักเรียนในห้องเรียนนี้" };
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(20000);
  if (!gotLock) {
    return { status: "error", message: "ขณะนี้มีผู้ใช้งานบันทึกข้อมูลพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้ง" };
  }

  try {
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
    midtermValues = students.map((st) => (Number(st.semester1Raw70) + Number(st.semester2Raw70)) / 2);
    finalExamValues = students.map((st) => (Number(st.semester1Exam30) + Number(st.semester2Exam30)) / 2);
    yearTotalValues = students.map((st) => Number(st.yearScore100));

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
      "/export?format=pdf&size=A4&portrait=true&fitw=true&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false";
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