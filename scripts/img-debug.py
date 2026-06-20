import urllib.request, re, json
from html import unescape
url='https://www.lzgtnet.com/news/shownews.php?id=252&lang=en'
html=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read().decode('utf-8','ignore')
start=html.find('class="met-editor')
sub=html[start:start+20000]
imgs=re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', sub, re.I)
# list page thumb
list_html=urllib.request.urlopen(urllib.request.Request('https://www.lzgtnet.com/news/news.php?class1=48&lang=en',headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read().decode('utf-8','ignore')
block=re.search(r'shownews\.php\?id=252.*?</a>', list_html, re.S)
list_img=re.findall(r'src=["\']([^"\']+)["\']', block.group(0) if block else '', re.I)
open(r'c:\Users\user\OneDrive\Desktop\cambell\scripts\img-debug.json','w',encoding='utf-8').write(json.dumps({'detail':imgs,'list':list_img},indent=2))
