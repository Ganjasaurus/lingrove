import gzip,re,json,pathlib,sys,urllib.request
if len(sys.argv)>1:
 raw=gzip.open(sys.argv[1],'rt').read()
else:
 raw=gzip.decompress(urllib.request.urlopen('https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz',timeout=60).read()).decode('utf-8')
def tone(s):
 def one(m):
  word,num=m.group(1).replace('u:','ü').replace('v','ü'),int(m.group(2))
  if num in (0,5): return word
  lower=word.lower(); target=next((v for v in ['a','e','ou'] if v in lower),None)
  if target: idx=lower.index(target)
  else:
   ids=[i for i,c in enumerate(lower) if c in 'aeiouü']; idx=ids[-1] if ids else -1
  if idx<0:return word
  table={'a':'āáǎà','e':'ēéěè','i':'īíǐì','o':'ōóǒò','u':'ūúǔù','ü':'ǖǘǚǜ'}
  c=table[lower[idx]][num-1]; c=c.upper() if word[idx].isupper() else c
  return word[:idx]+c+word[idx+1:]
 return re.sub(r'([A-Za-zü:]+)([0-5])',one,s)
zh={};en={}
for line in raw.splitlines():
 if line.startswith('#'):continue
 m=re.match(r'(\S+) (\S+) \[(.*?)\] /(.*)/',line)
 if not m:continue
 trad,simp,py,defs=m.groups(); meanings=defs.split('/')
 # Keep compact definitions while retaining useful alternate meanings.
 meaning='; '.join(meanings[:3]); py=tone(py)
 for key in dict.fromkeys([simp,trad]):
  if key not in zh or zh[key][0].startswith(('surname ','variant of ','old variant')):zh[key]=[meaning,py]
 if any(x in meaning for x in ['surname ','variant of ','abbr.','transliteration']):continue
 for d in meanings:
  d=re.sub(r'^to ','',d).lower().strip()
  if re.fullmatch(r'[a-z][a-z -]{1,35}',d) and len(d.split())<=4:
   if d not in en or len(simp)<len(en[d][0]):en[d]=[simp,py]
pathlib.Path('dist/dictionary.json').write_text(json.dumps({'zh':zh,'en':en},ensure_ascii=False,separators=(',',':')))
print(f'Bundled {len(zh)} Chinese entries and {len(en)} English lookup terms.')
