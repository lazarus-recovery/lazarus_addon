@echo off
@call :copy_config C:\Program Files\Mozilla Firefox
@call :copy_config C:\Program Files (X86)\Mozilla Firefox
@goto :eof

:copy_config
  echo -- %* --
  if exist "%*\firefox.exe" (
    echo.   Found firefox.exe
    copy "%~dp0\config.js" "%*\config.js"
    copy "%~dp0\config-prefs.js" "%*\defaults\pref\config-prefs.js"
    ) else (
      echo.   Firefox.exe not found, skipping...
      )
  goto :eof

:: Notes
::
:: Adapted from 
::   https://github.com/5digits/dactyl/wiki/Disable-extension-signing-requirement-in-Firefox-49-or-later
