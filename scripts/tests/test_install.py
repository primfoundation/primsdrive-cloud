import pathlib
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'install-mini.py'
SIGNATURE = '\n'.join(('Identifier=sh.prims.drive.server',
    'Authority=Developer ID Application: Eidos AGI LLC (Y6CQ4SWPWM)',
    'TeamIdentifier=Y6CQ4SWPWM', 'runtime', 'Timestamp=today'))


class InstallTests(unittest.TestCase):
    def exercise(self, failures):
        with tempfile.TemporaryDirectory() as directory:
            home = pathlib.Path(directory)
            app = home / 'Applications/PrimsDrive Server.app'
            binary = app / 'Contents/MacOS/PrimsDriveServer'
            binary.parent.mkdir(parents=True)
            binary.touch()
            state = home / 'state'
            state.mkdir()
            for name in ('probe-secret', 'tunnel-token'):
                (state / name).write_text('fixture')
            plist = home / 'Library/LaunchAgents/sh.prims.drive.hello.plist'
            plist.parent.mkdir(parents=True)
            plist.write_bytes(b'previous launch configuration')
            calls = []

            def run(args, **kwargs):
                calls.append(args)
                code = 0
                if args[:2] == ['launchctl', 'bootstrap']:
                    count = sum(c[:2] == ['launchctl', 'bootstrap'] for c in calls)
                    code = 5 if count <= failures else 0
                return subprocess.CompletedProcess(args, code, '',
                    SIGNATURE if args[:2] == ['codesign', '-dv'] else 'fixture error')

            with patch.object(pathlib.Path, 'home', return_value=home), \
                 patch.object(sys, 'argv', [str(SCRIPT), str(state), '--server-app', str(app)]), \
                 patch('subprocess.run', side_effect=run), patch('time.sleep'):
                if failures >= 6:
                    with self.assertRaises(SystemExit):
                        runpy.run_path(str(SCRIPT), run_name='__main__')
                    self.assertEqual(plist.read_bytes(), b'previous launch configuration')
                else:
                    runpy.run_path(str(SCRIPT), run_name='__main__')
                    self.assertIn(b'PrimsDriveServer', plist.read_bytes())
            self.assertEqual(plist.with_suffix('.plist.before-server').read_bytes(),
                             b'previous launch configuration')
            self.assertFalse(any('sh.prims.drive.tunnel' in str(c) for c in calls))
            return sum(c[:2] == ['launchctl', 'bootstrap'] for c in calls)

    def test_bootout_race_recovers(self):
        self.assertEqual(self.exercise(1), 2)

    def test_permanent_failure_restores_previous_job(self):
        self.assertEqual(self.exercise(6), 7)


if __name__ == '__main__':
    unittest.main()
