import os
import pathlib
import sys
import tempfile
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from store import Store, StoreError

class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name).resolve()
        self.store = Store(str(self.root))
    def tearDown(self):
        self.temp.cleanup()
    def test_round_trip_and_preconditions(self):
        r = self.store.mutate('canary/a.prim', b'one', create=True)
        self.assertTrue(r['king_ack'])
        self.assertEqual(self.store.get('canary/a.prim')[0], b'one')
        self.assertEqual(self.store.listing('canary')['entries'][0]['name'], 'a.prim')
        with self.assertRaises(StoreError): self.store.mutate('canary/a.prim', b'bad', create=True)
        with self.assertRaises(StoreError): self.store.mutate('canary/a.prim', b'bad', match='stale')
        r = self.store.mutate('canary/a.prim', b'two', match=r['etag'])
        self.store.mutate('canary/a.prim', None, match=r['etag'])
        self.assertEqual(self.store.listing('canary')['entries'], [])
    def test_paths_symlinks_hardlinks_and_special_files(self):
        for path in ('../secret', '/etc/passwd', 'canary/../outside', 'canary//x', 'canary/./x', 'canary/.secret', 'canary/a\\b'):
            with self.assertRaises((StoreError, OSError)): self.store.mutate(path, b'bad', create=True)
        (self.root/'canary').mkdir()
        (self.root/'canary'/'link').symlink_to('/tmp', target_is_directory=True)
        with self.assertRaises(OSError): self.store.mutate('canary/link/escaped', b'bad', create=True)
        (self.root/'outside').write_bytes(b'original')
        (self.root/'canary'/'filelink').symlink_to(self.root/'outside')
        with self.assertRaises(OSError): self.store.get('canary/filelink')
        os.link(self.root/'outside', self.root/'canary'/'hardlink')
        with self.assertRaises(StoreError): self.store.get('canary/hardlink')
        os.mkfifo(self.root/'canary'/'fifo')
        with self.assertRaises(StoreError): self.store.get('canary/fifo')
        self.assertEqual((self.root/'outside').read_bytes(), b'original')
    def test_missing_mount_never_creates_fallback(self):
        root = self.root/'missing'/'Prims'
        store = Store(str(root), str(self.root/'missing'))
        with self.assertRaises(StoreError): store.mutate('canary/a', b'bad', create=True)
        self.assertFalse(root.exists())
    def test_root_symlink_denied(self):
        (self.root/'alias').symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(OSError): Store(str(self.root/'alias')).health()
    def test_directory_swapped_after_open_stays_in_original_directory(self):
        (self.root/'profile').mkdir()
        with self.store.directory('profile') as fd:
            os.rename(self.root/'profile', self.root/'original')
            (self.root/'profile').symlink_to('/tmp')
            out=os.open('safe',os.O_CREAT|os.O_WRONLY,0o600,dir_fd=fd);os.close(out)
        self.assertTrue((self.root/'original'/'safe').exists())

if __name__ == '__main__': unittest.main()
