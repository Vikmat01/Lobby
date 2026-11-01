Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define APP "Lobby"
!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef SRC
  !define SRC "..\dist\Lobby"
!endif
!ifndef OUTDIR
  !define OUTDIR "..\dist"
!endif
!define EXE "Lobby.exe"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lobby"

Name "${APP}"
Caption "Установка ${APP}"
OutFile "${OUTDIR}\Lobby-Setup-${VERSION}.exe"
; per-user install: no admin prompt, like most modern launchers
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\Lobby"
InstallDirRegKey HKCU "Software\Lobby" "InstallDir"
BrandingText "Lobby ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "Lobby"
VIAddVersionKey "FileDescription" "Установщик Lobby"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" ""

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ICON "lobby.ico"
!define MUI_UNICON "lobby.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "welcome.bmp"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "Lobby ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "Консольный лаунчер игр: Steam, Epic Games и свои игры в одном интерфейсе с управлением геймпадом.$\r$\n$\r$\nЕсли Lobby сейчас запущен, установщик сам его закроет. Библиотека, обложки и настройки сохранятся.$\r$\n$\r$\nНажми «Далее», чтобы продолжить."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Запустить Lobby"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Ярлык на рабочем столе"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION DesktopShortcut

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Russian"

Function DesktopShortcut
  CreateShortcut "$DESKTOP\Lobby.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
FunctionEnd

Section "Lobby" SecMain
  ; close a running copy so its files can be replaced
  nsExec::Exec 'taskkill /IM ${EXE} /F'
  Sleep 800

  SetOutPath "$INSTDIR"
  ; an update replaces the app folder whole, so no stale files are left behind
  RMDir /r "$INSTDIR\resources\app"
  File /r "${SRC}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall Lobby.exe"
  CreateShortcut "$SMPROGRAMS\Lobby.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0

  WriteRegStr HKCU "Software\Lobby" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "Lobby"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "Lobby"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall Lobby.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall Lobby.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM ${EXE} /F'
  Sleep 800
  Delete "$SMPROGRAMS\Lobby.lnk"
  Delete "$DESKTOP\Lobby.lnk"
  ; only the program is removed; the library and settings in %APPDATA%\Lobby stay for a reinstall
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\Lobby"
  ; autostart entry, if it was turned on
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Lobby"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Lobby"
SectionEnd
