"""Rebuild U1 offline font from the licensed @fontsource Noto Sans KR Korean 400 WOFF."""
import argparse
import hashlib
import json
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
parser=argparse.ArgumentParser()
parser.add_argument('source_woff',help='@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff')
args=parser.parse_args()
font=TTFont(args.source_woff)
chars=set(range(32,127))
for path in Path('src').rglob('*'):
    if path.suffix in ['.ts','.tsx','.css']:
        chars.update(map(ord,path.read_text()))
missing=[c for c in chars if 0xac00<=c<=0xd7a3 and c not in font.getBestCmap()]
if missing:
    raise ValueError(f'Source font is missing required Korean syllables: {missing}')
opts=subset.Options()
opts.flavor='woff'
subsetter=subset.Subsetter(options=opts)
subsetter.populate(unicodes=chars)
subsetter.subset(font)
font.flavor='woff'
font.save('src/assets/noto-kr-u1.woff')
binary=Path('src/assets/noto-kr-u1.woff').read_bytes()
Path('src/assets/noto-kr-u1-coverage.json').write_text(json.dumps({'sha256':hashlib.sha256(binary).hexdigest(),'codepoints':sorted(font.getBestCmap())},indent=2)+'\n')
