#!/usr/bin/env python3
"""Install hello + outbound tunnel as login agents; credentials must exist first.

Usage: python3 scripts/install-mini.py /absolute/private/state/directory
State directory must contain probe-secret (64 hex chars) and tunnel-token.
Never pass secrets as CLI arguments. No sudo, DNS or Sandisk access.
"""
import os
import pathlib
import plistlib
import shutil
import subprocess
import sys
import argparse
import time

parser = argparse.ArgumentParser()
parser.add_argument('state')
parser.add_argument('--pack-service', action='store_true', help='Retired: use --server-app with a verified company-signed bundle')
parser.add_argument('--server-app', type=pathlib.Path, help='Installed, signed and notarized PrimsDrive Server.app')
args = parser.parse_args()
if args.pack_service:
    parser.error('Raw Python production launch is retired; use --server-app')
server_binary = None
if args.server_app:
    app = args.server_app.resolve()
    expected = pathlib.Path.home() / 'Applications/PrimsDrive Server.app'
    if app != expected:
        parser.error(f'Install the validated release at {expected} first')
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    info = subprocess.run(['codesign', '-dv', '--verbose=4', str(app)],
                          capture_output=True, text=True, check=True).stderr
    for value in ('Identifier=sh.prims.drive.server',
                  'Authority=Developer ID Application: Eidos AGI LLC (Y6CQ4SWPWM)',
                  'TeamIdentifier=Y6CQ4SWPWM', 'runtime', 'Timestamp='):
        if value not in info:
            parser.error('Release signature requirement missing: ' + value)
    subprocess.run(['xcrun', 'stapler', 'validate', str(app)], check=True)
    subprocess.run(['spctl', '--assess', '--type', 'execute', str(app)], check=True)
    server_binary = app / 'Contents/MacOS/PrimsDriveServer'
    if not server_binary.is_file():
        parser.error('Missing packaged server executable')
state = pathlib.Path(args.state).resolve()
state.mkdir(mode=0o700, parents=True, exist_ok=True)
state.chmod(0o700)
for name in ('probe-secret', 'tunnel-token'):
    p = state / name
    if not p.is_file() or not p.read_text().strip():
        raise SystemExit(f'Missing {name}')
    p.chmod(0o600)
node = shutil.which('node') or '/opt/homebrew/bin/node'
cloudflared = shutil.which('cloudflared') or '/opt/homebrew/bin/cloudflared'
shutil.copyfile(pathlib.Path(__file__).resolve().parent.parent / 'mini/hello.ts', state / 'hello.ts')
hello_args = [str(server_binary)] if server_binary else [node, str(state / 'hello.ts')]
agents = pathlib.Path.home() / 'Library/LaunchAgents'
agents.mkdir(parents=True, exist_ok=True)
jobs = {
    'sh.prims.drive.hello': (hello_args, {'PRIMSDRIVE_PROBE_SECRET_FILE': str(state / 'probe-secret')}),
    'sh.prims.drive.tunnel': ([cloudflared, 'tunnel', '--no-autoupdate', 'run', '--token-file', str(state / 'tunnel-token')], {}),
}
if server_binary:
    del jobs['sh.prims.drive.tunnel']  # Retain the existing tunnel process and configuration.
for label, (args, env) in jobs.items():
    path = agents / f'{label}.plist'
    doc = dict(Label=label, ProgramArguments=args, EnvironmentVariables=env,
               RunAtLoad=True, KeepAlive=True, ThrottleInterval=10,
               StandardOutPath=str(state / f'{label}.log'),
               StandardErrorPath=str(state / f'{label}.error.log'), WorkingDirectory=str(state))
    if path.exists():
        backup = path.with_suffix('.plist.before-server')
        if backup.exists():
            raise SystemExit(f'Preserve existing rollback backup before continuing: {backup}')
        shutil.copy2(path, backup)
    path.write_bytes(plistlib.dumps(doc))
    path.chmod(0o600)
    domain = f'gui/{os.getuid()}'
    subprocess.run(['launchctl', 'bootout', f'{domain}/{label}'], capture_output=True)
    # bootout may return before launchd has finished removing the old job.
    # A confirmed retry recovered this race on the Mini; bound retries and
    # restore the previous job if the replacement still cannot bootstrap.
    result = None
    for attempt in range(6):
        result = subprocess.run(['launchctl', 'bootstrap', domain, str(path)],
                                capture_output=True, text=True)
        if result.returncode == 0:
            break
        if attempt < 5:
            time.sleep(1)
    if result.returncode:
        backup = path.with_suffix('.plist.before-server')
        if backup.exists():
            shutil.copy2(backup, path)
            restored = subprocess.run(['launchctl', 'bootstrap', domain, str(path)],
                                      capture_output=True, text=True)
            print('Rollback bootstrap exit code:', restored.returncode, file=sys.stderr)
        raise SystemExit('Server bootstrap failed: ' + result.stderr.strip())
    print(f'Installed {label}; starts on login and restarts on failure')
