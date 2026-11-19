"""Build GitHub Pages and the matching minimal offline download. Python standard library only."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
import hashlib, re, shutil, zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"
files = [ROOT / "index.html", ROOT / "credits.html", ROOT / "THIRD_PARTY_NOTICES.txt"]
for name in ("assets", "css", "data", "js", "missy"):
    files.extend(p for p in (ROOT / name).rglob("*") if p.is_file())
files = sorted(files)
assert all(p.suffix != ".md" for p in files)
version = re.search(r'R2.VERSION = "([^"]+)"', (ROOT / "data/presets.js").read_text(encoding="utf-8"))[1]

class Dependencies(HTMLParser):
    def __init__(self, entry):
        super().__init__(); self.entry = entry
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ("src", "href"):
            ref = attrs.get(key, "")
            parsed = urlparse(ref)
            if not ref or parsed.scheme or ref.startswith("#"):
                continue
            target = (self.entry.parent / unquote(parsed.path)).resolve()
            assert target.is_relative_to(ROOT), (self.entry, ref)
            assert target.is_file(), (self.entry, ref)

for entry in (ROOT / "index.html", ROOT / "credits.html", ROOT / "missy/index.html"):
    parser = Dependencies(entry); parser.feed(entry.read_text(encoding="utf-8"))

class BootComponents(HTMLParser):
    def __init__(self):
        super().__init__()
        self.components = []
        self.expected = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag != "script":
            return
        if "data-module-count" in attrs:
            self.expected = int(attrs["data-module-count"])
        if "R2Boot.step" in attrs.get("onload", ""):
            self.components.append(attrs)

boot = BootComponents()
boot.feed((ROOT / "index.html").read_text(encoding="utf-8"))
assert boot.expected == len(boot.components), "Startup component count is stale"
for key in ("src", "data-boot-label", "data-boot-label-zh"):
    values = [item.get(key, "").strip() for item in boot.components]
    assert all(values), "Missing startup component metadata: " + key
    assert len(values) == len(set(values)), "Repeated startup component metadata: " + key
# Do not remove any path outside the generated output folder.
if OUT.exists():
    assert OUT.resolve() == ROOT.resolve() / "_site"
    assert OUT.resolve().is_relative_to(ROOT.resolve())
    shutil.rmtree(OUT)
OUT.mkdir()
for source in files:
    target = OUT / source.relative_to(ROOT)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
(OUT / ".nojekyll").write_text("", encoding="utf-8")
download = OUT / "downloads" / ("MISSY_R2_workbench_site_" + version + ".zip")
download.parent.mkdir()
with zipfile.ZipFile(download, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for source in files:
        info = zipfile.ZipInfo("pcr-workbench/" + source.relative_to(ROOT).as_posix(), (1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, source.read_bytes(), compresslevel=6)
with zipfile.ZipFile(download) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(files)
    for source in files:
        assert archive.read("pcr-workbench/" + source.relative_to(ROOT).as_posix()) == source.read_bytes()
print("Built", version, "with", len(files), "runtime files.")
print("Offline ZIP:", download.name, download.stat().st_size, "bytes")
print("SHA-256:", hashlib.sha256(download.read_bytes()).hexdigest())
