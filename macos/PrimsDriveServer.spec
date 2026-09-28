# Product code stays in primsdrive-cloud; shipping practice is eidos-desktop-app-builder.
import os
from pathlib import Path
root = Path(SPECPATH).parent
identity = os.environ.get('PRIMSDRIVE_SIGNING_IDENTITY') or None
a = Analysis([str(root / 'mini/server.py')], pathex=[str(root / 'mini')],
             binaries=[], datas=[], hiddenimports=['selftest'], hookspath=[],
             hooksconfig={}, runtime_hooks=[], excludes=[], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='PrimsDriveServer',
          debug=False, bootloader_ignore_signals=False, strip=False, upx=False,
          console=True, target_arch='arm64', codesign_identity=identity,
          entitlements_file=None)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='PrimsDriveServer')
app = BUNDLE(coll, name='PrimsDrive Server.app', bundle_identifier='sh.prims.drive.server',
             info_plist={'CFBundleName':'PrimsDrive Server',
                         'CFBundleShortVersionString':'0.1.0', 'CFBundleVersion':'1',
                         'LSUIElement':True,
                         'NSRemovableVolumesUsageDescription':'Serve your Prim library from the attached Sandisk drive to your authorized clients.'})
