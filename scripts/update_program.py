"""Refresh the published conference program; Python standard library only."""
import json, re, urllib.request
from pathlib import Path
from datetime import datetime, timezone
URL = 'https://us-rse.org/usrse26/program/llms-full.txt'
text = urllib.request.urlopen(URL).read().decode()
sessions = []
for block in re.split(r'^### ', text, flags=re.M)[1:]:
    heading, body = block.split('\n', 1)
    timing = re.search(r'^- Time: (\S+) to (\S+)', body, re.M)
    if not timing: continue
    title = heading.split(' — ', 1)[1]
    field = lambda key: (re.search(r'^- '+key+r': (.+)$', body, re.M).group(1) if re.search(r'^- '+key+r': (.+)$', body, re.M) else '')
    intro, *talkblocks = re.split(r'^#### ', body, flags=re.M)
    talks = []
    for tb in talkblocks:
        name, rest = tb.split('\n', 1)
        get = lambda key: (re.search(r'^- '+key+r': (.+)$',rest,re.M).group(1) if re.search(r'^- '+key+r': (.+)$',rest,re.M) else '')
        abstract = rest.split('Abstract:',1)[1].strip() if 'Abstract:' in rest else ''
        abstract = re.split(r'^## ',abstract,flags=re.M)[0]
        talks.append(dict(title=name,presenters=get('Presenters'),url=get('Abstract page'),abstract=re.sub(r'^> ?', '', abstract, flags=re.M)))
    sessions.append(dict(id=timing[1][:10]+'-'+re.sub('[^a-z0-9]+','-',title.lower()).strip('-'),title=title,start=timing[1],end=timing[2],room=field('Room'),type=field('Type'),chair=field('Chair'),talks=talks,notes=intro.split('About this session:',1)[1].strip() if 'About this session:' in intro else ''))
assert len(sessions)==51, f'Program has {len(sessions)} sessions; review changed schedule'
assert len({s['id'] for s in sessions})==len(sessions)
Path(__file__).resolve().parents[1].joinpath('docs/program.json').write_text(json.dumps(dict(source=URL,updated=datetime.now(timezone.utc).isoformat(),sessions=sessions),ensure_ascii=False,indent=2))
print(f'Parsed {len(sessions)} sessions and {sum(len(s["talks"]) for s in sessions)} talks')
