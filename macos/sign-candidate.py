#!/usr/bin/env python3
"""Sign the exact Mini-built archive on the key-holding Mac; never export keys."""
import argparse, hashlib, json, pathlib, subprocess, sys
IDENTITY = 'Developer ID Application: Eidos AGI LLC (Y6CQ4SWPWM)'

def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True)

def main():
    p = argparse.ArgumentParser()
    p.add_argument('archive', type=pathlib.Path)
    p.add_argument('--sha256', required=True)
    p.add_argument('--output', required=True, type=pathlib.Path)
    a = p.parse_args()
    if sys.platform != 'darwin': p.error('Requires macOS')
    if hashlib.sha256(a.archive.read_bytes()).hexdigest() != a.sha256:
        p.error('Source archive checksum mismatch')
    if a.output.exists(): p.error('Use a new output directory; never overwrite a signing attempt')
    identities = run('security','find-identity','-v','-p','codesigning').stdout
    if '"'+IDENTITY+'"' not in identities: p.error('Required company identity unavailable')
    a.output.mkdir(parents=True)
    run('ditto','-x','-k',str(a.archive.resolve()),str(a.output.resolve()))
    app = a.output.resolve()/'PrimsDrive Server.app'
    if not app.is_dir(): p.error('Expected server app missing')
    magic = {bytes.fromhex(x) for x in ('feedface','cefaedfe','feedfacf','cffaedfe','cafebabe','bebafeca','cafebabf','bfbafeca')}
    binaries = []
    for path in app.rglob('*'):
        if path.is_file() and not path.is_symlink():
            with path.open('rb') as f:
                if f.read(4) in magic: binaries.append(path)
    for path in sorted(binaries, key=lambda p:len(p.parts), reverse=True):
        run('codesign','--force','--sign',IDENTITY,'--options','runtime','--timestamp',str(path))
    for path in sorted(app.rglob('*.framework'), key=lambda p:len(p.parts), reverse=True):
        if not path.is_symlink(): run('codesign','--force','--sign',IDENTITY,'--options','runtime','--timestamp',str(path))
    run('codesign','--force','--sign',IDENTITY,'--options','runtime','--timestamp',str(app))
    run('codesign','--verify','--deep','--strict',str(app))
    sig = run('codesign','-dv','--verbose=4',str(app)).stderr
    for expected in ('Identifier=sh.prims.drive.server','Authority='+IDENTITY,'TeamIdentifier=Y6CQ4SWPWM','runtime','Timestamp='):
        if expected not in sig: raise RuntimeError('Missing signature property '+expected)
    (a.output/'signature.txt').write_text(sig+run('codesign','-d','-r-',str(app)).stderr)
    result = run(str(app/'Contents/MacOS/PrimsDriveServer'),'--self-test').stdout
    if json.loads(result).get('ok') is not True: raise RuntimeError('Signed self-test failed')
    (a.output/'self-test.json').write_text(result)
    run('ditto','-c','-k','--sequesterRsrc','--keepParent',str(app),str(a.output.resolve()/'submission.zip'))
    print(json.dumps({'signed':True,'notarized':False,'app':str(app),'source_archive_sha256':a.sha256}))
if __name__ == '__main__': main()
