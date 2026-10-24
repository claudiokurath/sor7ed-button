from pathlib import Path
from urllib.parse import urlparse
import argparse,json,zipfile
parser=argparse.ArgumentParser()
parser.add_argument('--dev-origin',help='Explicit loopback origin for a development-only ZIP')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
source=(root/'extension'/'background.js').read_text()
name='send-to-sorted-extension.zip'
if args.dev_origin:
    u=urlparse(args.dev_origin)
    if u.hostname not in {'localhost','127.0.0.1'} or u.scheme not in {'http','https'} or u.path not in {'','/'} or u.query or u.fragment or u.username:
        raise SystemExit('Development origin must be a loopback HTTP(S) origin')
    source=source.replace('"https://www.sor7ed.com"',json.dumps(args.dev_origin.rstrip('/')))
    name='send-to-sorted-extension-DEVELOPMENT.zip'
out=root/'dist'/name
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    z.write(root/'extension'/'manifest.json','manifest.json')
    z.writestr('background.js',source)
print(out)
