; Hooked into Tauri's NSIS installer (tauri.conf.json > bundle > windows > nsis > installerHooks).
; Both hooks exist because TarTrak runs elevated (see windows-app-manifest.xml), which the stock
; in-app update flow does not expect. $UpdateMode, $PassiveMode and ${MAINBINARYNAME} are the
; template's own.

!macro NSIS_HOOK_PREINSTALL
  ; The in-app updater starts this installer and exits the app in the same instant, and the two
  ; race. The installer's running-app check counts a process that is already exiting as killed
  ; and moves on after half a second, but the old TarTrak.exe stays locked until its teardown
  ; (WebView2, the log tail, the key poller) is done. On a slower PC the copy of the new exe then
  ; hits NSIS's "file in use" Abort/Retry/Ignore box, which sits behind the game: the update never
  ; lands and the installer lingers as a "TarTrak" process. Wait for the old process to be gone
  ; before anything is copied, up to 15 s.
  ${If} $UpdateMode = 1
    StrCpy $R9 0
    ${Do}
      nsis_tauri_utils::FindProcessCurrentUser "${MAINBINARYNAME}.exe"
      Pop $R0
      ${If} $R0 <> 0
        ${ExitDo}
      ${EndIf}
      IntOp $R9 $R9 + 1
      Sleep 250
    ${LoopUntil} $R9 >= 60
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; The stock relaunch after an update (RunAsUser in .onInstSuccess) starts the app with the
  ; desktop's unelevated token, which CreateProcess refuses for an exe whose manifest requires
  ; administrator, so the app never came back after an update. This installer is elevated when
  ; the updater started it, so a plain Exec relaunches at the level the app asks for, with no
  ; prompt. The stock call still runs afterwards and fails harmlessly; should it ever succeed,
  ; the single-instance guard folds the second copy into the first.
  ${If} $PassiveMode = 1
  ${OrIf} ${Silent}
    ${GetOptions} $CMDLINE "/R" $R0
    ${IfNot} ${Errors}
      ${GetOptions} $CMDLINE "/ARGS" $R0
      Exec '"$INSTDIR\${MAINBINARYNAME}.exe" $R0'
    ${EndIf}
  ${EndIf}
!macroend
