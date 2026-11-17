# Build the recolourable detail texture: lighting divided out of the TRELLIS
# texture per part class. Run in the work dir:  python3 ../tex.py <trellis.glb>
import json, struct, io, os, sys, numpy as np
from PIL import Image, ImageDraw
b=open(sys.argv[1],'rb').read()
n=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+n]); bin0=20+n+8
bv=j['bufferViews'][j['images'][0]['bufferView']]
img=Image.open(io.BytesIO(b[bin0+bv.get('byteOffset',0):bin0+bv.get('byteOffset',0)+bv['byteLength']])).convert('RGB')
W,H=img.size
d=np.load('cls2.npz'); cls,uvt=d['cls'].copy(),d['uvt']; cls[cls==5]=3
cm=Image.new('L',(W,H),255); dr=ImageDraw.Draw(cm)
pts=np.stack([uvt[...,0]*W,(1-uvt[...,1])*H],-1)
for order in (3,4,1,0,2):
    for t in pts[cls==order]:
        dr.polygon([tuple(q) for q in t],fill=int(order),outline=int(order))
cm=np.array(cm); a=np.asarray(img).astype('f')/255
lum=a@np.array([.2126,.7152,.0722])
det=np.full((H,W),1.0,'f')
for k,(mode,pct) in {0:('dark',70),1:('light',92),2:('dark',70),3:('light',96),4:('dark',70)}.items():
    m=cm==k
    ref=np.percentile(lum[m],pct); print(k,mode,'ref',round(float(ref),3))
    v=lum[m]/max(ref,1e-3)
    det[m]=np.clip(v,0,1) if mode=='light' else np.clip(0.78+0.22*np.clip(v,0,1.5)/1.5,0,1)
import json
free=np.asarray(Image.fromarray(((cm==255)*255).astype('u1')).resize((W//32,H//32),Image.BOX))==255
iy,ix=np.argwhere(free)[len(np.argwhere(free))//2]; json.dump({'u':(ix*32+16)/W,'v':1-(iy*32+16)/H},open('white.json','w')); print('white',ix,iy)
Image.fromarray((det*255).astype('u1'),'L').convert('RGB').save('detail.jpg',quality=88); print('saved',os.path.getsize('detail.jpg'))
