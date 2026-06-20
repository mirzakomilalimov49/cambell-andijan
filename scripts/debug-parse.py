import urllib.request, re, json
from html import unescape
url='https://www.lzgtnet.com/news/shownews.php?id=252&lang=en'
req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
html=urllib.request.urlopen(req,timeout=30).read().decode('utf-8','ignore')
out={}
m=re.search(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})', html)
out['datetime']=m.group(1) if m else None
m=re.search(r'<h1[^>]*>(.*?)</h1>', html, re.S)
out['h1']=unescape(re.sub('<.*?>','',m.group(1))).strip() if m else None
start=html.find('class="met-editor')
if start>=0:
    sub=html[start:start+15000]
    end_m=re.search(r'<div class="(met-page|tag|sidebar|recommend|news_bar)', sub)
    end=end_m.start() if end_m else 10000
    block=sub[:end]
    paras=re.findall(r'<p[^>]*>(.*?)</p>', block, re.S)
    out['paras']=[]
    for p in paras:
        t=re.sub(r'<[^>]+>','',p)
        t=unescape(re.sub(r'\s+',' ',t)).strip()
        if len(t)>30: out['paras'].append(t[:300])
m=re.search(r'兰州广通新能源\s*(\d+)', html)
out['views']=m.group(1) if m else None
open(r'c:\Users\user\OneDrive\Desktop\cambell\scripts\debug-out.json','w',encoding='utf-8').write(json.dumps(out,ensure_ascii=False,indent=2))
