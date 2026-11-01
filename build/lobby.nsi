; Lobby installer: a borderless dark window in the app's style instead of the stock wizard.
; Silent mode (/S) is used by in-app updates; /relaunch starts Lobby afterwards.
Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

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
!define ACCENT 0x3FD1A9
!define ACCENT_BGR 0xA9D13F
!define W 720
!define H 460

!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WinMessages.nsh"

Name "Lobby"
Caption "Установка Lobby"
OutFile "${OUTDIR}\Lobby-Setup-${VERSION}.exe"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\Lobby"
InstallDirRegKey HKCU "Software\Lobby" "InstallDir"
Icon "icon.ico"
UninstallIcon "icon.ico"
BrandingText " "
ShowInstDetails nevershow
ShowUninstDetails nevershow
AutoCloseWindow true
LoadLanguageFile "${NSISDIR}\Contrib\Language files\Russian.nlf"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1049 "ProductName" "Lobby"
VIAddVersionKey /LANG=1049 "FileDescription" "Установщик Lobby"
VIAddVersionKey /LANG=1049 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1049 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1049 "LegalCopyright" ""

Var DPI
Var WantDesk
Var hFolder
Var hDesk
Var hBox
Var hStatus
Var fTitle
Var fText
Var fBtn
Var fSmall

; scale a design pixel value to the screen's DPI
!macro PX out val
  IntOp ${out} ${val} * $DPI
  IntOp ${out} ${out} / 96
!macroend
!define PX "!insertmacro PX"

!macro FONT out size weight
  ${PX} $9 ${size}
  IntOp $9 0 - $9
  System::Call 'gdi32::CreateFontW(i $9, i 0, i 0, i 0, i ${weight}, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, w "Segoe UI")p.s'
  Pop ${out}
!macroend

Page custom WelcomeShow
Page instfiles "" InstShow
UninstPage uninstConfirm
UninstPage instfiles

; ---------- window chrome ----------
Function .onInit
  InitPluginsDir
  File "/oname=$PLUGINSDIR\header-100.bmp" "header-100.bmp"
  File "/oname=$PLUGINSDIR\header-150.bmp" "header-150.bmp"
  File "/oname=$PLUGINSDIR\header-200.bmp" "header-200.bmp"
  StrCpy $WantDesk 1
  System::Call 'user32::GetDpiForSystem()i.r0'
  ${If} $0 < 96
    StrCpy $0 96
  ${EndIf}
  StrCpy $DPI $0
FunctionEnd

Function .onGUIInit
  !insertmacro FONT $fTitle 22 700
  !insertmacro FONT $fText 15 400
  !insertmacro FONT $fBtn 16 600
  !insertmacro FONT $fSmall 13 400

  ; borderless window, sized and centred
  System::Call 'user32::SetWindowLongW(p $HWNDPARENT, i -16, i 0x96000000)'  ; WS_POPUP|WS_VISIBLE|WS_CLIPSIBLINGS|WS_CLIPCHILDREN
  ${PX} $1 ${W}
  ${PX} $2 ${H}
  System::Call 'user32::GetSystemMetrics(i 0)i.r3'
  System::Call 'user32::GetSystemMetrics(i 1)i.r4'
  IntOp $3 $3 - $1
  IntOp $3 $3 / 2
  IntOp $4 $4 - $2
  IntOp $4 $4 / 2
  System::Call 'user32::SetWindowPos(p $HWNDPARENT, p 0, i r3, i r4, i r1, i r2, i 0x0024)'  ; NOZORDER|FRAMECHANGED
  ; Windows 11: rounded corners
  System::Call '*(i 2)p.r5'
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 33, p r5, i 4)'
  System::Free $5
  SetCtlColors $HWNDPARENT 0xFFFFFF 0x000000
  System::Call 'user32::GetClassLongPtrW(p $HWNDPARENT, i -26)p.r5'
  IntOp $5 $5 | 0x20000                      ; CS_DROPSHADOW
  System::Call 'user32::SetClassLongPtrW(p $HWNDPARENT, i -26, p r5)'

  ; hide every stock control of the frame
  ${ForEach} $0 1 3 + 1
    GetDlgItem $1 $HWNDPARENT $0
    ShowWindow $1 ${SW_HIDE}
  ${Next}
  ${ForEach} $0 1028 1039 + 1
    GetDlgItem $1 $HWNDPARENT $0
    ShowWindow $1 ${SW_HIDE}
  ${Next}
  GetDlgItem $1 $HWNDPARENT 1256
  ShowWindow $1 ${SW_HIDE}

  ; black backdrop over the whole window, kept at the bottom
  System::Call 'user32::CreateWindowExW(i 0, w "STATIC", w "", i 0x50000000, i 0, i 0, i 4000, i 4000, p $HWNDPARENT, p 0, p 0, p 0)p.r6'
  SetCtlColors $6 0xFFFFFF 0x000000
  System::Call 'user32::SetWindowPos(p r6, p 1, i 0, i 0, i 0, i 0, i 0x0013)'

  ; header picture: logo, name, tagline
  StrCpy $7 "$PLUGINSDIR\header-100.bmp"
  ${If} $DPI >= 132
    StrCpy $7 "$PLUGINSDIR\header-150.bmp"
  ${EndIf}
  ${If} $DPI >= 168
    StrCpy $7 "$PLUGINSDIR\header-200.bmp"
  ${EndIf}
  ${PX} $1 48
  ${PX} $2 40
  ${PX} $3 640
  ${PX} $4 150
  System::Call 'user32::CreateWindowExW(i 0, w "STATIC", w "", i 0x5000020E, i r1, i r2, i r3, i r4, p $HWNDPARENT, p 0, p 0, p 0)p.r8'
  System::Call 'user32::LoadImageW(p 0, w r7, i 0, i r3, i r4, i 0x10)p.r9'
  SendMessage $8 0x172 0 $9

  ; page area under the header
  GetDlgItem $1 $HWNDPARENT 1018
  ${PX} $2 210
  ${PX} $3 ${W}
  ${PX} $4 250
  System::Call 'user32::SetWindowPos(p r1, p 0, i 0, i r2, i r3, i r4, i 0x0004)'
FunctionEnd

; a flat "button": a clickable label
!macro BUTTON out x y w h text fg bg handler
  ${PX} $1 ${x}
  ${PX} $2 ${y}
  ${PX} $3 ${w}
  ${PX} $4 ${h}
  nsDialogs::CreateControl STATIC ${WS_VISIBLE}|${WS_CHILD}|${SS_CENTER}|${SS_CENTERIMAGE}|${SS_NOTIFY} 0 $1 $2 $3 $4 "${text}"
  Pop ${out}
  SetCtlColors ${out} ${fg} ${bg}
  SendMessage ${out} ${WM_SETFONT} $fBtn 1
  ${NSD_OnClick} ${out} ${handler}
!macroend

!macro LABEL out x y w h text fg font
  ${PX} $1 ${x}
  ${PX} $2 ${y}
  ${PX} $3 ${w}
  ${PX} $4 ${h}
  nsDialogs::CreateControl STATIC ${WS_VISIBLE}|${WS_CHILD}|${SS_NOTIFY}|0x4000 0 $1 $2 $3 $4 "${text}"
  Pop ${out}
  SetCtlColors ${out} ${fg} 0x000000
  SendMessage ${out} ${WM_SETFONT} ${font} 1
!macroend

; ---------- welcome ----------
Function WelcomeShow
  nsDialogs::Create 1018
  Pop $0
  SetCtlColors $0 0xFFFFFF 0x000000

  !insertmacro LABEL $1 48 0 620 30 "Версия ${VERSION}  ·  Steam, Epic Games и свои игры в одном интерфейсе" 0xBBBBBB $fText
  !insertmacro LABEL $hFolder 48 50 560 26 "Папка: $INSTDIR" 0x8A8A8A $fSmall
  !insertmacro LABEL $5 612 50 80 26 "Изменить" ${ACCENT} $fSmall
  ${NSD_OnClick} $5 PickFolder
  ; toggle: a small square that fills with the accent colour, plus its caption
  ${PX} $1 48
  ${PX} $2 82
  ${PX} $3 16
  nsDialogs::CreateControl STATIC ${WS_VISIBLE}|${WS_CHILD}|${SS_NOTIFY} 0 $1 $2 $3 $3 ""
  Pop $hBox
  ${NSD_OnClick} $hBox ToggleDesktop
  !insertmacro LABEL $hDesk 76 76 400 28 "Ярлык на рабочем столе" 0xEDEDED $fText
  ${NSD_OnClick} $hDesk ToggleDesktop
  Call PaintDesktop

  !insertmacro BUTTON $6 48 150 300 54 "Установить" 0x000000 ${ACCENT} DoInstall
  !insertmacro BUTTON $7 364 150 150 54 "Отмена" 0xEDEDED 0x1C1C1C DoCancel
  nsDialogs::Show
FunctionEnd

Function PaintDesktop
  ${If} $WantDesk == 1
    SetCtlColors $hBox 0x000000 ${ACCENT}
    SetCtlColors $hDesk 0xEDEDED 0x000000
  ${Else}
    SetCtlColors $hBox 0x000000 0x3A3A3A
    SetCtlColors $hDesk 0x8A8A8A 0x000000
  ${EndIf}
  System::Call 'user32::InvalidateRect(p $hBox, p 0, i 1)'
  System::Call 'user32::InvalidateRect(p $hDesk, p 0, i 1)'
FunctionEnd
Function ToggleDesktop
  Pop $0
  IntOp $WantDesk $WantDesk ^ 1
  Call PaintDesktop
FunctionEnd
Function PickFolder
  Pop $0
  nsDialogs::SelectFolderDialog "Куда установить Lobby" "$INSTDIR"
  Pop $0
  ${If} $0 != error
  ${AndIf} $0 != ""
    StrCpy $INSTDIR "$0\Lobby"
    SendMessage $hFolder ${WM_SETTEXT} 0 "STR:Папка: $INSTDIR"
  ${EndIf}
FunctionEnd
Function DoInstall
  Pop $0
  SendMessage $HWNDPARENT 0x408 1 0   ; go to the next page
FunctionEnd
Function DoCancel
  Pop $0
  Quit
FunctionEnd

; ---------- progress ----------
Function InstShow
  FindWindow $0 "#32770" "" $HWNDPARENT
  SetCtlColors $0 0xFFFFFF 0x000000
  ; hide everything on the stock page except the progress bar
  ${ForEach} $1 1000 1100 + 1
    ${If} $1 != 1004
      GetDlgItem $2 $0 $1
      ShowWindow $2 ${SW_HIDE}
    ${EndIf}
  ${Next}
  ; our own status line
  ${PX} $3 48
  ${PX} $4 10
  ${PX} $5 620
  ${PX} $6 40
  System::Call 'user32::CreateWindowExW(i 0, w "STATIC", w "Устанавливаю Lobby…", i 0x50000000, i r3, i r4, i r5, i r6, p r0, p 0, p 0, p 0)p.r2'
  StrCpy $hStatus $2
  SetCtlColors $2 0xEDEDED 0x000000
  SendMessage $2 ${WM_SETFONT} $fTitle 1
  ; thin progress bar in the accent colour
  GetDlgItem $2 $0 1004
  System::Call 'uxtheme::SetWindowTheme(p r2, w "", w "")'
  System::Call 'user32::GetWindowLongW(p r2, i -16)i.r7'
  IntOp $7 $7 & 0xFF7FFFFF                 ; no border
  System::Call 'user32::SetWindowLongW(p r2, i -16, i r7)'
  System::Call 'user32::GetWindowLongW(p r2, i -20)i.r7'
  IntOp $7 $7 & 0xFFFDFDFF                 ; no client/static edge
  System::Call 'user32::SetWindowLongW(p r2, i -20, i r7)'
  SendMessage $2 0x409 0 ${ACCENT_BGR}     ; PBM_SETBARCOLOR
  SendMessage $2 0x2001 0 0x262626         ; PBM_SETBKCOLOR
  ${PX} $4 74
  ${PX} $6 8
  System::Call 'user32::SetWindowPos(p r2, p 0, i r3, i r4, i r5, i r6, i 0x0024)'
  ShowWindow $2 ${SW_SHOW}
FunctionEnd

!macro STATUS text
  ${IfNot} ${Silent}
    SendMessage $hStatus ${WM_SETTEXT} 0 "STR:${text}"
  ${EndIf}
!macroend

; ---------- install ----------
Section "Lobby"
  SetDetailsPrint none
  !insertmacro STATUS "Закрываю старую версию…"
  nsExec::Exec 'taskkill /IM ${EXE} /F'
  Sleep 600

  !insertmacro STATUS "Копирую файлы…"
  SetOutPath "$INSTDIR"
  ; an update replaces the app folder whole, so no stale files are left behind
  RMDir /r "$INSTDIR\resources\app"
  File /r "${SRC}\*.*"

  !insertmacro STATUS "Почти готово…"
  WriteUninstaller "$INSTDIR\Uninstall Lobby.exe"
  CreateShortcut "$SMPROGRAMS\Lobby.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  ${IfNot} ${Silent}
    ${If} $WantDesk == 1
      CreateShortcut "$DESKTOP\Lobby.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
    ${EndIf}
  ${EndIf}

  WriteRegStr HKCU "Software\Lobby" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "Lobby"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "Lobby"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall Lobby.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall Lobby.exe" /S'
  WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "https://github.com/Vikmat01/Lobby"
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
  !insertmacro STATUS "Готово! Запускаю Lobby…"
  Sleep 700
SectionEnd

; start Lobby after a normal install, or after an update when asked to
Function .onInstSuccess
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/relaunch" $1
  ${IfNot} ${Silent}
  ${OrIfNot} ${Errors}
    Exec '"$INSTDIR\${EXE}"'
  ${EndIf}
FunctionEnd

; ---------- uninstall ----------
Section "Uninstall"
  nsExec::Exec 'taskkill /IM ${EXE} /F'
  Sleep 800
  Delete "$SMPROGRAMS\Lobby.lnk"
  Delete "$DESKTOP\Lobby.lnk"
  ; only the program is removed; the library and settings in %APPDATA%\Lobby stay for a reinstall
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\Lobby"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Lobby"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Lobby"
SectionEnd
