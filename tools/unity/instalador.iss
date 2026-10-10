; Instalador Windows da versão Unity de Criaturas Imaginárias (Inno Setup 6).
; Gere antes a versão Windows na Unity (CriaturasUnity/Build/Windows) e rode:
;   ISCC.exe tools\unity\instalador.iss
#define Nome "Criaturas Imaginárias"
#define Versao "2.0.0"
#define Exe "CriaturasImaginarias.exe"
#define Raiz "..\.."

[Setup]
AppId={{6E1B7C52-3A49-4C1E-9D6F-4B2A8E7C1D05}
AppName={#Nome}
AppVersion={#Versao}
AppPublisher=Arthur Guzzo · EduCrescer
DefaultDirName={autopf}\Criaturas Imaginárias
DefaultGroupName={#Nome}
UninstallDisplayIcon={app}\{#Exe}
OutputDir={#Raiz}\CriaturasUnity\Build\Instalador
OutputBaseFilename=Criaturas-Imaginarias-Unity-Setup-{#Versao}
SetupIconFile={#Raiz}\desktop\icon.ico
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
WizardStyle=modern

[Languages]
Name: "pt"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos:"

[Files]
Source: "{#Raiz}\CriaturasUnity\Build\Windows\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*_BurstDebugInformation_DoNotShip\*,*_BackUpThisFolder_ButDontShipItWithYourGame\*"

[Icons]
Name: "{group}\{#Nome}"; Filename: "{app}\{#Exe}"
Name: "{group}\Desinstalar {#Nome}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#Nome}"; Filename: "{app}\{#Exe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#Exe}"; Description: "Jogar agora"; Flags: nowait postinstall skipifsilent
