@echo off
setlocal enabledelayedexpansion
cd /d "E:\00 W-Score\WScore"

echo ======================================
echo กำลังดึงโค้ดล่าสุดจาก Apps Script...
echo ======================================
call clasp pull
if errorlevel 1 (
    echo.
    echo [ผิดพลาด] clasp pull ล้มเหลว กรุณาตรวจสอบการเชื่อมต่อ/การล็อกอิน clasp แล้วลองใหม่
    pause
    exit /b 1
)

echo.
echo กำลังเตรียมส่งขึ้น GitHub...
git add .

git diff --cached --quiet
if errorlevel 1 (
    git commit -m "sync from Apps Script Editor"
    if errorlevel 1 (
        echo.
        echo [ผิดพลาด] git commit ล้มเหลว กรุณาตรวจสอบข้อความด้านบน
        pause
        exit /b 1
    )
) else (
    echo ไม่มีการเปลี่ยนแปลงใหม่จาก Apps Script ข้ามขั้นตอน commit
)

echo.
echo กำลังดึงความเปลี่ยนแปลงล่าสุดจาก GitHub มารวม (ป้องกัน push ชนกัน)...
git pull origin main --no-edit
if errorlevel 1 (
    echo.
    echo [ผิดพลาด] ดึงข้อมูลจาก GitHub มารวมไม่สำเร็จ อาจมีการแก้ไขชนกัน ^(conflict^)
    echo กรุณาเปิดโฟลเดอร์นี้ด้วยโปรแกรมที่ถนัด ^(เช่น VS Code^) เพื่อตรวจสอบและแก้ไขด้วยตนเอง
    echo อย่าเพิ่งรันสคริปต์นี้ซ้ำจนกว่าจะแก้ปัญหานี้เสร็จ
    pause
    exit /b 1
)

echo.
echo กำลังส่งขึ้น GitHub...
git push origin main
if errorlevel 1 (
    echo.
    echo [ผิดพลาด] push ขึ้น GitHub ไม่สำเร็จ! โค้ดของคุณยังไม่ถูกอัพเดทบน GitHub
    echo กรุณาคัดลอกข้อความ error ด้านบนแจ้งผู้ดูแลระบบ/Claude เพื่อตรวจสอบ
    pause
    exit /b 1
)

echo.
echo ======================================
echo เสร็จแล้ว! ซิงค์ขึ้น GitHub สำเร็จจริง
echo อย่าลืมกลับไปกดปุ่ม "ซิงค์ GitHub" ในแชท Claude ด้วยนะครับ
echo ======================================
pause