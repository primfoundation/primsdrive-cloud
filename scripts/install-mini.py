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

state = pathlib.Path(sys.argv[1]).resolve()
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
agents = pathlib.Path.home() / 'Library/LaunchAgents'
agents.mkdir(parents=True, exist_ok=True)
jobs = {
    'sh.prims.drive.hello': ([node, str(state / 'hello.ts')], {'PRIMSDRIVE_PROBE_SECRET_FILE': str(state / 'probe-secret')}),
    'sh.prims.drive.tunnel': ([cloudflared, 'tunnel', '--no-autoupdate', 'run', '--token-file', str(state / 'tunnel-token')], {}),
}
for label, (args, env) in jobs.items():
    path = agents / f'{label}.plist'
    doc = dict(Label=label, ProgramArguments=args, EnvironmentVariables=env,
               RunAtLoad=True, KeepAlive=True, ThrottleInterval=10,
               StandardOutPath=str(state / f'{label}.log'),
               StandardErrorPath=str(state / f'{label}.error.log'), WorkingDirectory=str(state))
    path.write_bytes(plistlib.dumps(doc))
    path.chmod(0o600)
    domain = f'gui/{os.getuid()}'
    subprocess.run(['launchctl', 'bootout', f'{domain}/{label}'], capture_output=True)
    subprocess.run(['launchctl', 'bootstrap', domain, str(path)], check=True)
    print(f'Installed {label}; starts on login and restarts on failure')
