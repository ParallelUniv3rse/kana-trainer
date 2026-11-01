import urllib.request, concurrent.futures, os, sys
cps = list(range(0x3041, 0x3094)) + list(range(0x30A1, 0x30F5)) + [0x30FC]
def get(cp):
    fn = f"build/kvg/{cp:05x}.svg"
    if os.path.exists(fn): return cp, True
    url = f"https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{cp:05x}.svg"
    try:
        data = urllib.request.urlopen(url, timeout=30).read()
        open(fn, "wb").write(data); return cp, True
    except Exception as e:
        return cp, str(e)
with concurrent.futures.ThreadPoolExecutor(16) as ex:
    res = list(ex.map(get, cps))
bad = [(hex(c), r) for c, r in res if r is not True]
print(len(cps), "requested;", len(bad), "missing:", bad[:20])
