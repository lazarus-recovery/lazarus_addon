pushd %~dp0
del ..\dist\lazarus-recovery-dev.xpi
pushd ..\src
7z a -tzip -mx9 -mm=Deflate -mfb=258 -mmt=8 -mpass=15 -mtc=on ^
   ..\dist\lazarus-recovery-dev.xpi * -r
popd
popd
goto :eof

:: Notes
::
:: Adapted from 
::  http://stackoverflow.com/questions/19240653/how-to-create-xpi-file-with-7zip
::  http://stackoverflow.com/a/37222393/14420
