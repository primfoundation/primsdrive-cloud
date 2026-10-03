#!/usr/bin/env python3
"""Side-build only. Release refuses missing/wrong company Developer ID."""
import argparse
import json
import os
from pathlib import Path
import platform
import subprocess
import sys

IDENTITY = 'Developer ID Application: Eidos AGI LLC (Y6CQ4SWPWM)'
ROOT = Path(__file__).resolve().parents[1]


def run(args, **kw):
    return subprocess.run(args, check=True, text=True, **kw)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--mode', choices=['candidate', 'release'], required=True)
    p.add_argument('--output', required=True, type=Path)
    a = p.parse_args()
    if sys.platform != 'darwin' or platform.machine() != 'arm64':
        p.error('Build on the arm64 Mac mini')
    out = a.output.resolve()
    if out.exists():
        p.error('Output must be a new directory, never an installed app')
    env = dict(os.environ)
    env.pop('PRIMSDRIVE_SIGNING_IDENTITY', None)
    if a.mode == 'release':
        identities = run(['security','find-identity','-v','-p','codesigning'], capture_output=True).stdout
        if '"'+IDENTITY+'"' not in identities:
            raise SystemExit('BLOCKED: required company Developer ID Application private-key identity is unavailable')
        if run(['git','status','--porcelain'], cwd=ROOT, capture_output=True).stdout.strip():
            raise SystemExit('BLOCKED: release requires a clean committed source tree')
        env['PRIMSDRIVE_SIGNING_IDENTITY'] = IDENTITY
    out.mkdir(parents=True)
    inventory = run([sys.executable, '-m', 'PyInstaller', '--version'], capture_output=True).stdout.strip()
    (out/'tool-versions.json').write_text(json.dumps({'pyinstaller':inventory,'python':sys.version})+'\n')
    sha = run(['git','rev-parse','HEAD'],cwd=ROOT,capture_output=True).stdout.strip()
    run([sys.executable,'-m','PyInstaller','--noconfirm','--clean',
         '--distpath',str(out/'dist'),'--workpath',str(out/'work'),
         str(ROOT/'macos/PrimsDriveServer.spec')],cwd=ROOT,env=env)
    app = out/'dist/PrimsDrive Server.app'
    binary = app/'Contents/MacOS/PrimsDriveServer'
    result = run([str(binary),'--self-test'],capture_output=True)
    (out/'self-test.json').write_text(result.stdout)
    checks = json.loads(result.stdout)
    if checks.get('ok') is not True:
        raise SystemExit('Packaged self-test failed')
    run(['codesign','--verify','--deep','--strict',str(app)])
    signature = run(['codesign','-dv','--verbose=4',str(app)],capture_output=True).stderr
    requirement_result = run(['codesign','-d','-r-',str(app)],capture_output=True)
    requirement = requirement_result.stdout + requirement_result.stderr
    (out/'signature.txt').write_text(signature+'\n'+requirement)
    if a.mode == 'release':
        for expected in ('Authority='+IDENTITY, 'TeamIdentifier=Y6CQ4SWPWM', 'runtime', 'Timestamp='):
            if expected not in signature:
                raise SystemExit('BLOCKED: missing release signature property '+expected)
    (out/'build-record.json').write_text(json.dumps(dict(source=sha, mode=a.mode,
        python=sys.version, machine=platform.machine(), macos=platform.mac_ver()[0],
        app=str(app), packaged_self_test=True, sandisk_verified=False,
        notarized=False, installed=False),indent=2)+'\n')
    print(json.dumps({'built':str(app),'packaged_self_test':True,'release_ready':False}))

if __name__ == '__main__':
    main()
