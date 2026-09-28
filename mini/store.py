"""Descriptor-relative pack objects. Production root is fixed in server.py."""
import contextlib
import hashlib
import os
import stat
import threading
import time
import uuid

MAX_BYTES = 16 * 1024 * 1024

class StoreError(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code


def parts(path, allow_empty=False):
    if not isinstance(path, str) or len(path) > 1024 or '\\' in path or '\x00' in path:
        raise StoreError(400, 'invalid_path')
    if allow_empty and path == '':
        return []
    result = path.split('/')
    if any(not p or p in ('.', '..') or p.startswith('.') or len(p.encode()) > 255 for p in result):
        raise StoreError(400, 'invalid_path')
    return result


class Store:
    def __init__(self, root, volume=None):
        self.root = root
        self.volume = volume
        self.lock = threading.RLock()
        self.last_ack = None

    @contextlib.contextmanager
    def directory(self, path='', create=False):
        names = parts(path, allow_empty=True)
        if self.volume and not os.path.ismount(self.volume):
            raise StoreError(503, 'volume_unmounted')
        # Open each absolute root component without following symlinks, too.
        fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
        try:
            root_dev = None
            for name in self.root.strip('/').split('/'):
                nxt = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                os.close(fd)
                fd = nxt
            root_dev = os.fstat(fd).st_dev
            if self.volume and (root_dev != os.stat(self.volume).st_dev or root_dev == os.stat(os.path.dirname(self.volume)).st_dev):
                raise StoreError(503, 'volume_changed')
            for name in names:
                if create:
                    try:
                        os.mkdir(name, 0o700, dir_fd=fd)
                    except FileExistsError:
                        pass
                nxt = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                if os.fstat(nxt).st_dev != root_dev:
                    os.close(nxt)
                    raise StoreError(403, 'cross_volume')
                os.close(fd)
                fd = nxt
            yield fd
        finally:
            os.close(fd)

    def health(self):
        with self.directory() as fd:
            os.listdir(fd)  # mount existence alone is insufficient (macOS TCC).
            usage = os.fstatvfs(fd)
            return dict(mounted=True, readable=True, free_bytes=usage.f_bavail * usage.f_frsize,
                        last_king_ack=self.last_ack)

    def listing(self, path, offset=0):
        if not isinstance(offset, int) or offset < 0:
            raise StoreError(400, 'invalid_offset')
        with self.directory(path) as fd:
            names = sorted(n for n in os.listdir(fd) if not n.startswith('.'))
            entries = []
            for name in names[offset:offset + 128]:
                s = os.stat(name, dir_fd=fd, follow_symlinks=False)
                if stat.S_ISLNK(s.st_mode) or s.st_dev != os.fstat(fd).st_dev:
                    continue
                if stat.S_ISDIR(s.st_mode) or stat.S_ISREG(s.st_mode):
                    entries.append(dict(name=name, kind='directory' if stat.S_ISDIR(s.st_mode) else 'file', size=s.st_size))
            return dict(entries=entries, next_offset=offset + 128 if len(names) > offset + 128 else None)

    def read_at(self, fd, name):
        f = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
        try:
            s = os.fstat(f)
            if not stat.S_ISREG(s.st_mode) or s.st_nlink != 1 or s.st_dev != os.fstat(fd).st_dev:
                raise StoreError(403, 'unsafe_object')
            if s.st_size > MAX_BYTES:
                raise StoreError(413, 'object_too_large')
            data = bytearray()
            while True:
                chunk = os.read(f, min(65536, MAX_BYTES + 1 - len(data)))
                if not chunk:
                    break
                data.extend(chunk)
                if len(data) > MAX_BYTES:
                    raise StoreError(413, 'object_too_large')
            content = bytes(data)
            return content, '"' + hashlib.sha256(content).hexdigest() + '"'
        finally:
            os.close(f)

    def get(self, path):
        names = parts(path)
        with self.directory('/'.join(names[:-1])) as fd:
            return self.read_at(fd, names[-1])

    def mutate(self, path, data, match=None, create=False):
        names = parts(path)
        if len(names) < 2:
            raise StoreError(400, 'profile_and_object_required')
        if data is not None and len(data) > MAX_BYTES:
            raise StoreError(413, 'object_too_large')
        if not create and not match:
            raise StoreError(428, 'precondition_required')
        with self.lock, self.directory('/'.join(names[:-1]), create=data is not None and create) as fd:
            name = names[-1]
            try:
                _, current = self.read_at(fd, name)
            except FileNotFoundError:
                current = None
            if (create and current is not None) or (not create and current != match):
                raise StoreError(412, 'precondition_failed')
            if data is None:
                if current is None:
                    raise StoreError(404, 'not_found')
                os.unlink(name, dir_fd=fd)
                etag = None
            else:
                temp = '.upload-' + uuid.uuid4().hex
                out = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=fd)
                try:
                    with os.fdopen(out, 'wb') as f:
                        f.write(data)
                        f.flush()
                        os.fsync(f.fileno())
                    if create:
                        os.link(temp, name, src_dir_fd=fd, dst_dir_fd=fd, follow_symlinks=False)
                        os.unlink(temp, dir_fd=fd)
                    else:
                        os.replace(temp, name, src_dir_fd=fd, dst_dir_fd=fd)
                finally:
                    try:
                        os.unlink(temp, dir_fd=fd)
                    except FileNotFoundError:
                        pass
                _, etag = self.read_at(fd, name)
            os.fsync(fd)
            self.last_ack = dict(path=path, time=time.time(), operation='delete' if data is None else 'put')
            return dict(king_ack=True, etag=etag)
