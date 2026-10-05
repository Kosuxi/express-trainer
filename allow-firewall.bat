@echo off
REM Right-click this file and "Run as administrator" once.
netsh advfirewall firewall delete rule name="ExpressionTrainer8347" >nul 2>&1
netsh advfirewall firewall add rule name="ExpressionTrainer8347" dir=in action=allow protocol=TCP localport=8347
if %errorlevel%==0 (
  echo Port 8347 allowed. You can close this window.
) else (
  echo Failed. Please right-click this file and choose "Run as administrator".
)
pause
