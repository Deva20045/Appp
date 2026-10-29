import requests,json,re,concurrent.futures,pathlib,collections
root=pathlib.Path(__file__).parent
urls={'medv2':'Med-V2/pulse-medicine.html','medv3':'Medicine/pulse-medicine.html','peds':'Peds/pulse-peds-complete.html','obg':'OBG/pulse-obg.html','pharm':'Pharm/pulse-pharm-complete.html','surg':'Surgery/pulse-surgery-complete.html','derma':'Stratum/','ortho':'ORTHO/pulse-ortho-complete.html','oph':'OPHTHAL/pulse-ophthalmology.html'}
def fetch(it):
 sid,path=it;r=requests.get('https://deva20045.github.io/'+path,timeout=60);r.raise_for_status();return sid,r.text
bank=json.load(open(root/'bank.json'));dec=json.JSONDecoder();report={}
for sid,text in concurrent.futures.ThreadPoolExecutor(9).map(fetch,urls.items()):
 objs=[]
 # Original question objects have id first; decoding whole nested structures not required.
 for m in re.finditer(r'\{(?=[^{}]{0,400}"(?:q|id)"\s*:)',text):
  try:
   o,_=dec.raw_decode(text[m.start():])
   if isinstance(o,dict) and isinstance(o.get('q'),str) and isinstance(o.get('opts'),list):objs.append(o)
  except Exception:pass
 def sig(q,opts,ans):return json.dumps([q,opts,ans],ensure_ascii=False,sort_keys=True)
 lookup=collections.defaultdict(list)
 for o in objs:lookup[sig(o['q'],o['opts'],o.get('ans'))].append(o)
 count=0;stems=0;pairs=0;ambiguous=0
 for q in bank[sid]['q']:
  candidates=lookup.get(sig(q[0],q[1],q[2]),[])
  if not candidates:continue
  exact=[o for o in candidates if str(o.get('page',''))==str(q[5]) and o.get('exp')==q[3]]
  if exact:candidates=exact
  extras={json.dumps({k:o[k] for k in ['stem','pairs'] if k in o},ensure_ascii=False,sort_keys=True) for o in candidates}
  if len(extras)!=1:ambiguous+=1;continue
  o=candidates[0];chunks=[]
  if isinstance(o.get('stem'),str) and o['stem'].strip() and o['stem'].strip() not in q[0]:chunks.append(o['stem'].strip());stems+=1
  chunks.append(q[0])
  pp=o.get('pairs')
  if isinstance(pp,list) and pp and all(isinstance(x,list) and len(x)==2 for x in pp):
   chunks.append('List I\n'+'\n'.join(chr(65+i)+'. '+str(x[0]) for i,x in enumerate(pp)))
   chunks.append('List II\n'+'\n'.join(str(i+1)+'. '+str(x[1]) for i,x in enumerate(pp)));pairs+=1
  new='\n\n'.join(chunks)
  if new!=q[0]:q[0]=new;count+=1
 report[sid]={'original_questions_found':len(objs),'context_restored':count,'case_stems':stems,'matching_lists':pairs,'ambiguous_skipped':ambiguous}
 print(sid,report[sid],flush=True)
json.dump(bank,open(root/'bank.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(report,open(root/'context-recovery-report.json','w'),indent=2)
