Noto Sans KR: SIL Open Font License 1.1 (see NotoSansKR-OFL.txt).
Source: @fontsource/noto-sans-kr 5.3.1; https://github.com/notofonts/noto-cjk
P0: noto-kr-p0.woff — preserved original subset (143 Korean syllables).
P1.1: noto-kr-p1.woff — 199 Korean syllables present in src/*.ts,tsx,css; generated with fontTools subset + merge from 400-normal .woff chunks. Other characters use system fonts; no web-font requests.
Coverage is verified by tests/font.test.ts. Adding Korean UI strings requires refreshing the font subset.

P1.2: noto-kr-p12.woff — 214 Korean source syllables; same fontTools subset/merge and license. P0/P1.1 assets preserved.

P1.3: noto-kr-p13.woff — 229 Korean source syllables; current UI coverage checked by tests/font.test.ts. Previous assets preserved; same fontTools subset/merge and SIL OFL license.

P2.1: noto-kr-p21.woff — 239 Korean source syllables, including nested src/surface/*.tsx; SHA/coverage checked recursively. Previous assets and SIL OFL license preserved.
