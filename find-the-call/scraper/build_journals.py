import openpyxl, json, re, sys
src, out = sys.argv[1], sys.argv[2]
ws = openpyxl.load_workbook(src, read_only=True)['2025 JQL']
cl = lambda v: re.sub(r'\s+', ' ', str(v or '')).strip()
journals = []
for r in list(ws.iter_rows(values_only=True))[8:]:
    t = cl(r[1])
    if not t: continue
    journals.append({"id": len(journals)+1, "title": t, "publisher": cl(r[2]),
        "issn": cl(r[3]), "eissn": cl(r[4]), "for": int(cl(r[6]) or 0), "rating": cl(r[7])})
open(out, 'w', encoding='utf-8').write('window.JOURNALS=' + json.dumps(journals, ensure_ascii=False, separators=(',', ':')) + ';')
print(len(journals), 'journals')

