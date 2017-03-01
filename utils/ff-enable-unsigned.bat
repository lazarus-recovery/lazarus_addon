@echo off
@call :copy_config C:\Program Files\Mozilla Firefox
@call :copy_config C:\Program Files (X86)\Mozilla Firefox
@goto :eof

:copy_config
  echo -- %* --
  if exist "%*\firefox.exe" (
    echo.   Found firefox.exe
    copy config.js "%*\config.js"
    copy config-prefs.js "%*\default\prefs\config-prefs.js"
    ) else (
      echo.   Firefox.exe not found, skipping...
      )
  goto :eof
