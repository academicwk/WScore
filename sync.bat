@echo off
cd /d "E:\00 W-Score\WScore"
echo กำลังดึงโค้ดล่าสุดจาก Apps Script...
clasp pull
echo.
echo กำลังส่งขึ้น GitHub...
git add .
git commit -m "sync from Apps Script Editor"
git push origin main
echo.
echo เสร็จแล้ว! อย่าลืมกลับไปกดปุ่ม "ซิงค์ GitHub" ในแชท Claude ด้วยนะครับ
pause