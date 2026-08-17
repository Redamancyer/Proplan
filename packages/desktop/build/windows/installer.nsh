; installer.nsh - included by electron-builder via nsis.include

!macro customUnInstall
  MessageBox MB_YESNO "Do you want to delete Proplan user data and settings?" /SD IDNO IDNO SkipRemoval
    SetShellVarContext current
    RMDir /r "$APPDATA\Proplan"
  SkipRemoval:
!macroend
