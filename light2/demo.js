const __AB=(document.currentScript&&document.currentScript.dataset.assets)||'assets/';
(async()=>{
'use strict';const AB=__AB;
const G=window.GLX;const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const cv=n=>$(`canvas[data-demo="${n}"]`);
if(!G||!G.ok){$$('.frame').forEach(f=>{f.innerHTML='<p style="color:#fff;padding:24px;font-size:14px">이 시연은 WebGL2와 부동소수점 렌더 타깃이 필요합니다. 최신 Chrome, Edge, Firefox, Safari에서 열어 주세요.</p>';});return;}
const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v;
const dec=v=>{v=clamp(v);return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
const to8=v=>Math.round(clamp(v)*255);
const norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l]};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const ctl=n=>$(`[data-ctl="${n}"]`),val=n=>parseFloat(ctl(n).value),setVal=(n,t)=>{const e=$(`[data-val="${n}"]`);if(e)e.textContent=t;};
const togs={};$$('[data-tog]').forEach(b=>{togs[b.dataset.tog]=b.getAttribute('aria-pressed')==='true';b.addEventListener('click',()=>{togs[b.dataset.tog]=!togs[b.dataset.tog];b.setAttribute('aria-pressed',String(togs[b.dataset.tog]));redrawAll();});});
function radio(attr,onPick){const bs=$$(`[data-${attr}]`);bs.forEach(b=>b.addEventListener('click',()=>{bs.forEach(o=>o.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');onPick(b.dataset[attr]);redrawAll();}));const on=bs.find(b=>b.getAttribute('aria-pressed')==='true');return on?on.dataset[attr]:(bs[0]?bs[0].dataset[attr]:undefined);}
function graphSetup(c){const ctx=c.getContext('2d');const cs=getComputedStyle(document.documentElement);const col={ink:cs.getPropertyValue('--ink').trim(),mut:cs.getPropertyValue('--muted').trim(),line:cs.getPropertyValue('--line').trim(),acc:cs.getPropertyValue('--accent').trim(),font:cs.getPropertyValue('--font')};ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.scale(2,2);ctx.font='12px '+col.font;return {ctx,col,w:c.width/2,h:c.height/2};}
const SX=16,SY=9;/* 장면 단위 */
const UV2=(c,e)=>{const r=c.getBoundingClientRect();return [clamp((e.clientX-r.left)/r.width)*SX,(1-clamp((e.clientY-r.top)/r.height))*SY];};
function pointerLight(c,state,redraw,win){if(!c)return;let down=false;c.classList.add('pt');const set=e=>{const [x,y]=UV2(c,e);state.x=win?win[0]+x/SX*win[2]:x;state.y=win?win[1]+y/SY*win[3]:y;redraw();};c.addEventListener('pointerdown',e=>{down=true;c.setPointerCapture(e.pointerId);set(e);});c.addEventListener('pointermove',e=>{if(down)set(e);});c.addEventListener('pointerup',()=>down=false);c.addEventListener('pointercancel',()=>down=false);}

/* ---------- 셰이더 ---------- */
const COMMON2=G.COMMON.replace('in vec2 uv;out vec4 o;','in vec2 uv;');
/* 재질 생성: o0 = 알베도 rgb + 러프니스, o1 = 높이, 가림체, 금속성 */
const MAT_FS=COMMON2+`
layout(location=0) out vec4 o0;layout(location=1) out vec4 o1;uniform sampler2D u_a,u_hh,u_ca;
void main(){vec3 a=decS3(texture(u_a,uv).rgb);vec4 c=texture(u_ca,uv);float occ=step(0.5,c.a);a=mix(a,decS3(c.rgb),occ);float h=texture(u_hh,uv).r*0.6;o0=vec4(a,0.85);o1=vec4(h,occ,0.,1.);}
`;
const NORMAL_FS=G.COMMON+`uniform sampler2D u_h,u_cn;uniform vec2 u_px;uniform float u_s;
void main(){vec4 cn=texture(u_cn,uv);if(cn.a>0.5){o=vec4(cn.rgb,1.);return;}float l=texture(u_h,uv-vec2(u_px.x,0.)).r,r=texture(u_h,uv+vec2(u_px.x,0.)).r,d=texture(u_h,uv-vec2(0.,u_px.y)).r,u=texture(u_h,uv+vec2(0.,u_px.y)).r;float dx=(r-l)/(2.*u_px.x*16.),dy=(u-d)/(2.*u_px.y*9.);vec3 n=normalize(vec3(-dx*u_s*0.35,-dy*u_s*0.35,1.));o=vec4(n*0.5+0.5,1.);}`;
const VIEW_FS=G.COMMON+`uniform sampler2D u_h,u_n;uniform int u_mode;uniform vec4 u_win;void main(){vec2 s=(u_win.xy+uv*u_win.zw)/vec2(16.,9.);if(u_mode==0){float h=texture(u_h,s).r/0.85;o=vec4(encS3(vec3(h)),1.);return;}vec3 e=texture(u_n,s).rgb;if(u_mode==1)o=vec4(e,1.);else{float v=u_mode==2?e.r:(u_mode==3?e.g:e.b);o=vec4(vec3(v),1.);}}`;
const LIGHT_FS=G.COMMON+`
uniform sampler2D u_alb,u_n,u_h,u_mask,u_cm;uniform vec4 u_lp[12];uniform vec4 u_lc[12];uniform int u_nl;uniform float u_radius;uniform int u_fall;
uniform vec4 u_win;uniform int u_decode,u_xform,u_fixN,u_shadow,u_steps,u_view,u_quant;uniform float u_pix,u_spec,u_amb,u_floors,u_rim,u_glow;uniform vec3 u_ambC;uniform vec2 u_cs[6];uniform int u_csn;uniform float u_ambFlat,u_sss,u_flat,u_gl,u_cflat,u_blend,u_back,u_lq;uniform int u_target;uniform vec2 u_box,u_spot;uniform vec2 u_beam;
float blob(vec2 q,vec2 f,float off){vec2 e=(q-vec2(f.x+off,f.y))/vec2(0.46+abs(off)*0.8,0.13);return 1.-smoothstep(0.55,1.,length(e));}
const vec2 SC=vec2(16.,9.);
vec2 xf(vec2 q){vec2 c=SC*0.5;vec2 p=q-c;if(u_xform==1)p.x=-p.x;else if(u_xform==2)p=vec2(p.y,-p.x);else if(u_xform==3)p=-p;return p+c;}
vec3 fixN(vec3 n){if(u_fixN==0)return n;if(u_xform==1)n.x=-n.x;else if(u_xform==2)n.xy=vec2(-n.y,n.x);else if(u_xform==3)n.xy=-n.xy;return n;}
vec3 decodeN(vec3 e){if(u_decode==4)return vec3(0.,0.,1.);e=floor(e*255.+0.5)/255.;if(u_decode==2)e.g=1.-e.g;if(u_decode==1)e=decS3(e);vec3 d=e*2.-1.;if(u_decode==3)d.z=sqrt(max(0.,1.-d.x*d.x-d.y*d.y));return normalize(d);}
float fall(float d){if(u_fall==0)return 1./(d*d+0.05);if(u_fall==1)return 1./(d*d+0.6);if(u_fall==2){float t=sat(1.-pow(d/u_radius,4.));return t*t/(d*d+0.05);}return sat(1.-d/u_radius)/2.5;}
float leak(float y,float ly,float b){return (y-b)*(ly-b)<0.?1.-smoothstep(0.,1.1,abs(y-b)):1.;}
float shadowMarch(vec2 q,vec2 lq,float own){if(own>0.5)return 1.;int n=u_steps;bool inside=texture(u_h,lq/SC).g>0.5;for(int i=1;i<=64;i++){if(i>n)break;vec2 s=lq+(q-lq)*(float(i)/float(n+1));float occ=texture(u_h,s/SC).g;if(inside){if(occ<0.5)inside=false;}else if(occ>0.5)return 0.;}return 1.;}
void main(){vec2 q0=u_win.xy+uv*u_win.zw;if(u_pix>0.){vec2 px=vec2(0.05);q0=(floor(q0/px)+0.5)*px;}vec2 q=xf(q0);vec2 suv=q/SC;
 bool inside=suv.x>=0.&&suv.x<=1.&&suv.y>=0.&&suv.y<=1.;if(!inside){o=vec4(0.02,0.02,0.025,1.);return;}
 vec4 a4=texture(u_alb,suv);vec4 h4=texture(u_h,suv);vec3 alb=a4.rgb;float rough=a4.a,own=h4.g,metal=h4.b;
 vec3 n=fixN(decodeN(texture(u_n,suv).rgb));vec3 nS=n;if(u_cflat>0.&&own>0.5)n=normalize(mix(n,vec3(0.,0.,1.),u_cflat));
 vec3 light=u_ambC*u_amb*(u_ambFlat>0.5?1.:(0.6+0.4*n.z)*(0.75+0.25*sat(h4.r/2.5)));if(own<0.5)for(int c=0;c<6;c++){if(c>=u_csn)break;light*=1.-0.55*blob(q0,u_cs[c],0.);}float edge=0.,edgeW=0.,backG=0.,backR=0.;if(own>0.5){vec2 tx=vec2(0.05)/SC;edge=1.-step(0.5,min(min(texture(u_h,suv+vec2(tx.x,0.)).g,texture(u_h,suv-vec2(tx.x,0.)).g),min(texture(u_h,suv+vec2(0.,tx.y)).g,texture(u_h,suv-vec2(0.,tx.y)).g)));float e2=1.-step(0.5,min(min(texture(u_h,suv+vec2(tx.x*2.,0.)).g,texture(u_h,suv-vec2(tx.x*2.,0.)).g),min(texture(u_h,suv+vec2(0.,tx.y*2.)).g,texture(u_h,suv-vec2(0.,tx.y*2.)).g)));edgeW=max(edge,e2*0.55);for(int i=0;i<12;i++){if(i>=u_nl)break;if(floor(u_lp[i].w/10.+0.01)==2.&&abs(u_lp[i].y-q0.y)<2.){float bg=1.-smoothstep(0.6,1.25,abs(u_lp[i].x-q0.x));if(bg>backG){backG=bg;vec2 fd=u_lp[i].xy-q0;backR=exp(-dot(fd,fd)*1.1)*(u_lp[i].w-20.);}}}}backG*=u_back;backR*=u_back;light*=1.-0.8*backG;vec3 lightB=light;vec3 specAcc=vec3(0.),rimAcc=vec3(0.),glowAcc=vec3(0.),glAcc=vec3(0.);vec4 cm=texture(u_cm,suv);float mtl=own*cm.a*cm.r,hairM=own*cm.a*cm.g;float nlView=0.;
 for(int i=0;i<12;i++){if(i>=u_nl)break;vec3 lp=u_lp[i].xyz;float kd=floor(u_lp[i].w/10.+0.01);float fkk=u_lp[i].w-kd*10.;vec3 lcB=u_lc[i].rgb*u_lc[i].a*2.6;vec3 lc=lcB*fkk;vec2 qL=u_lq>0.?(floor(q0/u_lq)+0.5)*u_lq:q0;vec2 dir=lp.xy-qL;float d=length(dir);vec3 L=normalize(vec3(dir,lp.z));float fl=1.;if(u_floors>0.5)fl=leak(q0.y,lp.y,2.2)*leak(q0.y,lp.y,6.65);float att=fall(d)*fl;float sh=1.;float moon=kd==1.?1.:0.;float beam=0.;
  if(moon>0.5){vec2 bd=normalize(u_beam);vec2 v=q0-lp.xy;float al=dot(v,bd);float pe=abs(v.x*bd.y-v.y*bd.x);float w=0.42+0.2*max(al,0.);beam=(1.-smoothstep(w*0.6,w,pe))*smoothstep(-0.35,0.15,al)*exp(-max(al,0.)*0.2);float fy=lp.y>6.65?6.7:2.65;float cut=smoothstep(fy-0.05,fy+0.2,q0.y);beam*=cut;att=(beam*0.6+exp(-d*d*2.2)*0.45*cut)*fl;L=normalize(vec3(-bd,0.9));dir=-bd;}
  if(kd==3.){float cc=dot(normalize(-dir+1e-5),normalize(u_beam));att*=smoothstep(u_spot.y,u_spot.x,cc);}
  if(kd==4.){vec2 bb=abs(qL-lp.xy)-u_box;float sd=length(max(bb,0.))+min(max(bb.x,bb.y),0.);att=(1.-smoothstep(0.,1.3,sd))*0.42*fl;L=normalize(vec3(dir*0.2,lp.z));}
  if((u_target==1&&own>0.5)||(u_target==2&&own<0.5))att=0.;
  float ndl=dot(n,L);float nl=max(ndl,0.);nlView=max(nlView,nl);
  if(u_shadow==1)sh=shadowMarch(q0,lp.xy,own);else if(u_shadow==2){sh=own>0.5?1.:1.-texture(u_mask,uv).r;}
  float cs=1.;if(own<0.5)for(int c=0;c<6;c++){if(c>=u_csn)break;float off=clamp((u_cs[c].x-lp.x)*0.2,-0.3,0.3)*(1.-moon);cs*=1.-0.8*blob(q0,u_cs[c],off);}
  float back=kd==2.?backG:0.;float dif=nl*att*sh*cs*(1.-0.86*backG)*(1.-back);
  light+=lc*dif;lightB+=lcB*dif;if(u_gl>0.&&(mtl+hairM)>0.5&&moon<0.5){vec3 hv=normalize(L+vec3(0.,0.,1.));float F0=mtl>0.5?0.85:0.3;float F=F0+(1.-F0)*pow(1.-hv.z,5.);glAcc+=lc*pow(max(dot(nS,hv),0.),mtl>0.5?26.:30.)*F*att*sh*(1.-0.98*backG)*(1.-back);}if(u_sss>0.&&own>0.5){float wr=sat((ndl+0.5)/1.5);vec3 ss=vec3(1.,0.3,0.2)*(wr-nl)*u_sss*(0.35+0.65*smoothstep(0.02,0.18,alb.r-alb.b))*att*sh*(1.-0.98*backG)*(1.-back);light+=lc*ss;lightB+=lcB*ss;}if(own>0.5){float rim=(0.45+0.55*(1.-nS.z))*max(dot(normalize(nS.xy+1e-4),normalize(dir+1e-4)),0.)*edgeW;rim*=1.-0.92*backG;rimAcc+=lc*rim*att*u_rim;}glowAcc+=(moon>0.5?normalize(lc+1e-5)*beam*0.09:pow(normalize(lc+1e-5),vec3(1.8))*exp(-d*d*24.)*0.7)*fl*u_glow*min(1.,length(lc))*((own>0.5&&u_csn>0)?0.:1.);
  if(u_spec>0.5){vec3 h=normalize(L+vec3(0.,0.,1.));float nh=max(dot(n,h),0.);float s=2./(rough*rough+1e-3)-2.;vec3 F0=mix(vec3(0.04),alb,metal);specAcc+=F0*(s+8.)/25.13*pow(nh,s)*nl*att*sh*lc;}}
 if(own<0.5)for(int c=0;c<6;c++){if(c>=u_csn)break;float g=1.-0.52*blob(q0,u_cs[c],0.);light*=g;lightB*=g;}
 if(u_flat>0.&&own>0.5){light=vec3(u_flat);rimAcc=vec3(0.);}
 if(u_view==1){o=vec4(vec3(nlView),1.);return;}
 if(u_view==2){o=vec4(light/3.14159*0.42,1.);return;}
 if(u_view==3){o=vec4(alb*mix(1.,0.25,metal),1.);return;}
 if(u_quant>0){float lum=dot(light,vec3(0.2126,0.7152,0.0722));float lmin=log2(0.06),lmax=log2(2.2);float t=sat((log2(max(lum,1e-4))-lmin)/(lmax-lmin));float qn=floor(t*float(u_quant-1)+0.5)/float(u_quant-1);float target=exp2(mix(lmin,lmax,qn));light*=target/max(lum,1e-4);specAcc=vec3(0.);}
 if(u_blend>0.&&own>0.5){float ll=dot(light,vec3(0.2126,0.7152,0.0722));vec3 tint=light/max(ll,1e-4);alb=mix(alb,vec3(dot(alb,vec3(0.2126,0.7152,0.0722))),0.12*u_blend);light*=mix(vec3(1.),tint,0.3*u_blend)*(1.-0.12*u_blend);}
 {float rl=dot(rimAcc,vec3(0.2126,0.7152,0.0722));rimAcc*=min(1.,1.1/max(rl,1e-4));}
 vec3 col=alb*mix(1.,0.25,metal)*light/3.14159+specAcc+alb*rimAcc*1.4+glowAcc*0.6+mix(alb,vec3(1.),0.12)*vec3(1.,0.52,0.2)*edge*backG*backR*smoothstep(2.62,2.9,q0.y)*2.4;if(u_gl>0.){float g=dot(glAcc,vec3(0.2126,0.7152,0.0722))*u_gl;float lv=mtl>0.5?floor(min(g,1.)*2.+0.5)/2.*1.5:step(0.5,g)*0.5;col+=normalize(glAcc+1e-5)*mix(vec3(1.),alb,0.3)*lv;}
 o=vec4(col,1.);}
`;
const COMP_FS=G.COMMON+`uniform sampler2D u_a,u_l;void main(){o=vec4(texture(u_a,uv).rgb*texture(u_l,uv).rgb/0.42,1.);}`;
const POST_FS=G.COMMON+`uniform sampler2D u_src;uniform float u_exposure;void main(){vec3 c=texture(u_src,uv).rgb*u_exposure;o=vec4(encS3(aces(c)),1.);}`;


/* ---------- 3D 버전: 레이마칭 던전. 같은 dot(N, L), 감쇠, 그림자를 3D 위치로 계산한다 ---------- */
const S3_FS=G.COMMON+`
uniform vec2 u_res;uniform vec3 u_lp,u_gp,u_lc,u_ambC;uniform float u_amb,u_radius,u_bump;
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
vec2 opU(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec2 map(vec3 p){vec2 r=vec2(p.y,1.);
 r=opU(r,vec2(min(p.z+3.2,min(p.x+4.8,4.8-p.x)),2.));
 r=opU(r,vec2(sdBox(p-vec3(-1.7,1.6,-2.7),vec3(0.36,1.6,0.36))-0.02,2.));
 r=opU(r,vec2(sdBox(p-vec3(2.0,1.6,-2.7),vec3(0.36,1.6,0.36))-0.02,2.));
 r=opU(r,vec2(sdBox(p-vec3(0.5,0.34,-0.5),vec3(0.36)),3.));
 r=opU(r,vec2(sdBox(p-vec3(3.0,0.26,0.4),vec3(0.55,0.27,0.34)),3.));
 r=opU(r,vec2(length(p-vec3(-0.7,0.3,0.7))-0.31,4.));
 return r;}
vec3 calcN(vec3 p){vec2 e=vec2(0.0015,0.);return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x,map(p+e.yxy).x-map(p-e.yxy).x,map(p+e.yyx).x-map(p-e.yyx).x));}
float stoneH(vec2 q,out vec2 id){vec2 s=q/vec2(0.9,0.6);vec2 g=floor(s),f=fract(s);float F1=8.,F2=8.;id=vec2(0.);for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 o=vec2(float(i),float(j));vec2 r=o+0.2+hash22(g+o)*0.6-f;float dd=dot(r,r);if(dd<F1){F2=F1;F1=dd;id=g+o;}else if(dd<F2)F2=dd;}float e=sqrt(F2)-sqrt(F1);return smoothstep(0.,0.3,e)*(0.6+0.2*hash12(id))+0.06*fbm(q*7.);}
float shadow(vec3 ro,vec3 rd,float maxd){float res=1.,t=0.04;for(int i=0;i<56;i++){float h=map(ro+rd*t).x;if(h<0.0006)return 0.;res=min(res,14.*h/t);t+=clamp(h,0.01,0.25);if(t>maxd)break;}return sat(res);}
void main(){vec2 fc=(gl_FragCoord.xy-0.5*u_res)/u_res.y;vec3 ro=vec3(0.,3.5,5.8),ta=vec3(0.,0.85,-0.8);vec3 f=normalize(ta-ro),r=normalize(cross(f,vec3(0.,1.,0.))),u=cross(r,f);vec3 rd=normalize(f*1.5+fc.x*r+fc.y*u);
 float t=0.02,id=0.;for(int i=0;i<120;i++){vec2 h=map(ro+rd*t);if(h.x<0.0008*t){id=h.y;break;}t+=h.x*0.9;if(t>30.)break;}
 vec3 col=vec3(0.);
 if(id>0.){vec3 p=ro+rd*t;vec3 n=calcN(p);vec3 alb;float rough=0.85;
  vec2 q;vec3 t1,t2;if(abs(n.y)>0.5){q=p.xz;t1=vec3(1,0,0);t2=vec3(0,0,1);}else if(abs(n.x)>0.5){q=p.zy;t1=vec3(0,0,1);t2=vec3(0,1,0);}else{q=p.xy;t1=vec3(1,0,0);t2=vec3(0,1,0);}
  if(id<2.5){vec2 c;float h=stoneH(q,c);vec2 e=vec2(0.004,0.);vec2 c2;float dx=(stoneH(q+e.xy,c2)-stoneH(q-e.xy,c2))/0.008,dy=(stoneH(q+e.yx,c2)-stoneH(q-e.yx,c2))/0.008;n=normalize(n-(t1*dx+t2*dy)*0.09*u_bump);
   vec3 tint=mix(vec3(0.42,0.43,0.47),vec3(0.5,0.47,0.42),hash12(c*1.7))*(0.75+0.5*fbm(q*3.));if(id<1.5)tint*=vec3(0.8,0.78,0.74);alb=mix(vec3(0.16,0.15,0.14),tint,smoothstep(0.1,0.45,h));}
  else if(id<3.5){float plank=floor(q.y/0.18);float gap=smoothstep(0.006,0.02,abs(fract(q.y/0.18)-0.5)*0.18-0.075);alb=mix(vec3(0.36,0.22,0.1),vec3(0.52,0.34,0.16),fbm(vec2(q.x*12.,q.y*2.+plank*7.)))*mix(0.35,1.,gap);rough=0.7;}
  else{alb=vec3(0.55,0.28,0.2)*(0.8+0.4*fbm(p.xy*8.));rough=0.35;}
  vec3 light=u_ambC*u_amb*(0.55+0.45*n.y);
  vec3 L=u_lp-p;float dl=length(L);L/=dl;float nl=max(dot(n,L),0.);
  if(nl>0.){float w=sat(1.-pow(dl/u_radius,4.));float att=w*w/(dl*dl+0.35);float sh=shadow(p+n*0.015,L,dl-0.05);light+=u_lc*nl*att*sh;
   vec3 hv=normalize(L-rd);float s=2./(rough*rough+1e-3)-2.;col+=u_lc*0.04*(s+8.)/25.13*pow(max(dot(n,hv),0.),s)*nl*att*sh;}
  col+=alb*light;}
 vec3 gp=u_gp-ro;float tg=dot(gp,rd);if(tg>0.&&(id==0.||tg<t)){float dd=length(gp-rd*tg);col+=normalize(u_lc+1e-4)*(exp(-dd*dd*500.)*6.+exp(-dd*dd*30.)*0.35);}
 o=vec4(col,1.);}
`;

/* ---------- 05용: 위에서 내려다보는 방. 기둥, 벽, 상자, 통이 가림체다 ---------- */
const OCC=[{t:'box',c:[5.0,6.3],h:[1.7,0.28],k:0},{t:'box',c:[11.4,3.0],h:[0.28,1.5],k:0},{t:'box',c:[3.2,2.6],h:[0.5,0.5],k:1},{t:'box',c:[8.2,4.4],h:[0.5,0.5],k:1},{t:'box',c:[13.2,6.6],h:[0.5,0.5],k:1},{t:'box',c:[9.3,7.3],h:[0.42,0.42],k:2},{t:'box',c:[6.8,1.7],h:[0.42,0.42],k:2},{t:'circ',c:[4.6,4.4],r:0.42,k:3},{t:'circ',c:[13.9,2.1],r:0.42,k:3}];
const f1=v=>v.toFixed(3);
const OCC_GLSL='vec2 occ(vec2 p){vec2 r=vec2(1e3,0.);'+OCC.map(o=>o.t==='box'?`r=oU(r,vec2(sdB(p-vec2(${f1(o.c[0])},${f1(o.c[1])}),vec2(${f1(o.h[0])},${f1(o.h[1])})),${o.k}.));`:`r=oU(r,vec2(length(p-vec2(${f1(o.c[0])},${f1(o.c[1])}))-${f1(o.r)},${o.k}.));`).join('')+'return r;}';
const TOP_FS=G.COMMON+`
uniform vec3 u_lp,u_lc;uniform float u_amb,u_radius,u_pixq;uniform int u_mode,u_steps;uniform sampler2D u_mask;uniform vec4 u_ml[12];uniform vec4 u_mc[12];uniform int u_mn,u_fallm;
float sdB(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}
vec2 oU(vec2 a,vec2 b){return a.x<b.x?a:b;}
`+OCC_GLSL+`
float stoneH(vec2 q,out vec2 id){vec2 s=q/vec2(0.9,0.6);vec2 g=floor(s),f=fract(s);float F1=8.,F2=8.;id=vec2(0.);for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 o=vec2(float(i),float(j));vec2 r=o+0.2+hash22(g+o)*0.6-f;float dd=dot(r,r);if(dd<F1){F2=F1;F1=dd;id=g+o;}else if(dd<F2)F2=dd;}float e=sqrt(F2)-sqrt(F1);return smoothstep(0.,0.3,e)*(0.6+0.2*hash12(id))+0.06*fbm(q*7.);}
float march(vec2 q,vec2 l){bool inside=occ(l).x<0.;for(int i=1;i<=64;i++){if(i>u_steps)break;vec2 s=l+(q-l)*(float(i)/float(u_steps+1));float dd=occ(s).x;if(inside){if(dd>0.)inside=false;}else if(dd<0.)return 0.;}return 1.;}
void main(){vec2 q=uv*vec2(16.,9.);if(u_pixq>0.)q=(floor(q/u_pixq)+0.5)*u_pixq;
 vec2 oc=u_mn>0?vec2(1e3,0.):occ(q);float dd=oc.x,k=oc.y;vec3 alb;vec3 n=vec3(0.,0.,1.);float sh=1.;
 if(dd<0.){vec2 e=vec2(0.02,0.);vec2 g=normalize(vec2(occ(q+e.xy).x-occ(q-e.xy).x,occ(q+e.yx).x-occ(q-e.yx).x)+1e-5);float bev=smoothstep(-0.16,0.,dd);n=normalize(vec3(g*bev*1.1,1.));
  if(k<1.5){alb=vec3(0.4,0.39,0.42)*(0.75+0.5*fbm(q*5.));if(k<0.5){vec2 b=q*vec2(2.2,3.6);b.x+=step(1.,mod(floor(b.y),2.))*0.5;float m=min(abs(fract(b.x)-0.5),abs(fract(b.y)-0.5));alb*=mix(1.,0.55,smoothstep(0.44,0.48,0.5-m));}}
  else{alb=mix(vec3(0.36,0.22,0.1),vec3(0.56,0.37,0.18),fbm(vec2(q.x*9.,q.y*2.)));alb*=mix(0.5,1.,smoothstep(0.03,0.08,abs(fract(q.x*3.6)-0.5)));if(k>2.5)alb=mix(vec3(0.2,0.19,0.2),alb,smoothstep(0.02,0.05,abs(dd+0.1)));}
  alb*=mix(0.45,1.,smoothstep(0.,-0.06,dd));}
 else{vec2 c;float h=stoneH(q,c);vec2 e=vec2(0.004,0.);vec2 c2;float dx=(stoneH(q+e.xy,c2)-stoneH(q-e.xy,c2))/0.008,dy=(stoneH(q+e.yx,c2)-stoneH(q-e.yx,c2))/0.008;n=normalize(vec3(-dx*0.1,-dy*0.1,1.));
  vec3 tint=mix(vec3(0.42,0.43,0.47),vec3(0.5,0.47,0.42),hash12(c*1.7))*(0.75+0.5*fbm(q*3.))*vec3(0.8,0.78,0.74);alb=mix(vec3(0.15,0.14,0.13),tint,smoothstep(0.1,0.45,h));alb*=mix(0.5,1.,smoothstep(0.,0.28,dd));
  sh=u_mn>0?1.:(u_mode==0?march(q,u_lp.xy):1.-texture(u_mask,uv).r);}
 vec3 Lv=vec3(u_lp.xy-q,u_lp.z);float dl=length(Lv.xy);float nl=max(dot(n,normalize(Lv)),0.);float w=sat(1.-pow(dl/u_radius,4.));float att=w*w/(dl*dl+0.6);
 vec3 light=vec3(0.5,0.6,1.)*u_amb+u_lc*nl*att*sh;vec3 col=alb*light/3.14159+normalize(u_lc+1e-5)*exp(-dl*dl*9.)*0.5;
 if(u_mn>0){light=vec3(0.5,0.6,1.)*u_amb;for(int i=0;i<12;i++){if(i>=u_mn)break;vec3 V=vec3(u_ml[i].xy-q,u_ml[i].z);float d=length(V.xy);float a;if(u_fallm==0)a=1./(d*d+0.05);else if(u_fallm==1)a=1./(d*d+0.6);else if(u_fallm==2){float t=sat(1.-pow(d/u_radius,4.));a=t*t/(d*d+0.05);}else a=sat(1.-d/u_radius)/2.5;light+=u_mc[i].rgb*max(dot(n,normalize(V)),0.)*a;}col=alb*light/3.14159;}
 o=vec4(col,1.);}
`;
/* ---------- 프로그램과 버퍼 ---------- */
const P={mat:G.prog(MAT_FS),normal:G.prog(NORMAL_FS),view:G.prog(VIEW_FS),light:G.prog(LIGHT_FS),s3:G.prog(S3_FS),top:G.prog(TOP_FS),post:G.prog(POST_FS),comp:G.prog(COMP_FS)};
const TW=320,TH=180;const albTex=G.tex(TW,TH,{nearest:true}),hTex=G.tex(TW,TH,{nearest:true}),nTex=G.tex(TW,TH,{nearest:true});const matFbo=G.fbo(albTex,hTex),nFbo=G.fbo(nTex);
const OW=1280,OH=720;const litTex=G.tex(OW,OH),litFbo=G.fbo(litTex);const maskTex=G.tex(OW,OH),maskFbo=G.fbo(maskTex);
const loadTex=src=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.translate(0,im.height);x.scale(1,-1);x.drawImage(im,0,0);res(G.texData(im.width,im.height,new Uint8Array(x.getImageData(0,0,im.width,im.height).data.buffer),{nearest:true}));};im.onerror=rej;im.src=src;});
const loadImg=src=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src;});
const [aT,hT]=await Promise.all([AB+'hall_albedo.png',AB+'hall_height.png'].map(loadTex));
const CM=await (await fetch(AB+'chars.json')).json();const CIDS=Object.keys(CM);const CIMG={};for(const id of CIDS)CIMG[id]=await loadImg(`${AB}char_${id}.png`);
/* 시트의 반투명 후광과 연기는 장면 위에서 뿌옇게 보여서 뺀다. 불투명한 불꽃, 자루, 받침만 남긴다 */
const CMSK={};for(const id of ['20','33','03','09'])CMSK[id]=await loadImg(`${AB}char_${id}_m.png`);/* 반사 마스크: R 금속, G 머리카락 */
const TORCH=await loadImg(AB+'torch_s.png').then(im=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height);for(let i=3;i<d.data.length;i+=4)d.data[i]=d.data[i]>=200?255:0;x.putImageData(d,0,0);return c;});
const CAMP=await loadImg(AB+'campfire_s.png');/* pixelfx fire/campfire를 절반 크기, 15fps 45프레임(32×30)으로 내보낸 시트 */
const mk=()=>{const c=document.createElement('canvas');c.width=TW;c.height=TH;const x=c.getContext('2d',{willReadFrequently:false});x.imageSmoothingEnabled=false;return [c,x];};
const [cvM,cxM]=mk();const cTexM=G.texData(TW,TH,new Uint8Array(TW*TH*4),{nearest:true});
const [cvA,cxA]=mk(),[cvN,cxN]=mk(),[cvN2,cxN2]=mk();const cTexN2=G.texData(TW,TH,new Uint8Array(TW*TH*4),{nearest:true});const nTex2=G.tex(TW,TH,{nearest:true}),nFbo2=G.fbo(nTex2);const cTexA=G.texData(TW,TH,new Uint8Array(TW*TH*4),{nearest:true}),cTexN=G.texData(TW,TH,new Uint8Array(TW*TH*4),{nearest:true});
const gl=G.gl;const upload=(tex,cv)=>{gl.bindTexture(gl.TEXTURE_2D,tex.t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);};
const FLOOR=128;/* 1층 바닥의 y (위에서부터, 텍셀) */
const CHARS=[{id:CIDS[1],x:60,dir:-1,walk:true,sp:6.5,ph:2,go:17,k:1},{id:CIDS[2],x:112,dir:1,walk:false,sp:0,ph:1},{id:CIDS[4],x:230,dir:1,walk:true,sp:14,ph:3,go:11,k:5},{id:CIDS[5],x:290,dir:-1,walk:false,sp:0,ph:5}];
const rnd=k=>{const v=Math.sin(k*127.1)*43758.5453;return v-Math.floor(v);};
function stepChars(dt){for(const c of CHARS){if(!c.walk)continue;if(c.rest>0){c.rest-=dt;if(c.rest<=0){c.k++;c.go=12+rnd(c.k)*16;}continue;}c.go-=dt;if(c.go<=0){c.k++;c.rest=0.8+rnd(c.k)*1.2;continue;}c.x+=c.dir*c.sp*dt;c.ph+=dt*c.sp*0.7;if(c.x>300){c.x=300;c.dir=-1;}if(c.x<20){c.x=20;c.dir=1;}}}
function drawChar(ctx,row,c,time,im){const P=CM[c.id],img=im||CIMG[c.id];const mv=c.walk&&!(c.rest>0);const st=mv?Math.sin(c.ph):0;const bob=mv?-Math.round(Math.abs(st)*1.4):Math.round(Math.sin(time*1.6+c.ph)*0.6);
 ctx.save();ctx.translate(Math.round(c.x),FLOOR);ctx.scale(c.dir,1);
 const part=(name,rot,dy)=>{const q=P.parts[name];ctx.save();ctx.translate(q.px,q.py+dy);ctx.rotate(rot);ctx.translate(-q.px,-q.py);ctx.drawImage(img,q.sx,row*P.rowH,q.w,q.h,q.ox,q.oy,q.w,q.h);ctx.restore();};
 if(P.parts.tail)part('tail',0,0);part('legL',0,c.walk?-Math.round(Math.max(0,-st)*2):0);part('legR',0,c.walk?-Math.round(Math.max(0,st)*2):0);if(bob<0)part('body',0,0);part('body',0,bob);part('head',0,bob+(c.walk?0:Math.round(Math.sin(time*1.6+c.ph+0.8)*0.5)));ctx.restore();}
let sceneTime=0;
function buildScene(){const tc=CHARS[1];tc.dir=togs['tan-hold']?-1:(Math.floor(sceneTime/2.6)%2?-1:1);cxA.clearRect(0,0,TW,TH);cxN.clearRect(0,0,TW,TH);cxN2.clearRect(0,0,TW,TH);cxM.clearRect(0,0,TW,TH);for(const c of CHARS){if(CMSK[c.id])drawChar(cxM,0,c,sceneTime,CMSK[c.id]);drawChar(cxA,0,c,sceneTime);drawChar(cxN,c.dir>0?1:2,c,sceneTime);drawChar(cxN2,1,c,sceneTime);}upload(cTexA,cvA);upload(cTexN,cvN);upload(cTexN2,cvN2);upload(cTexM,cvM);G.draw(P.mat,{u_a:aT,u_hh:hT,u_ca:cTexA},matFbo);buildNormals();}
const charRects=()=>CHARS.map(c=>({type:'rect',c:[c.x/20,(TH-(FLOOR-18))/20],h:[0.45,0.95]}));
let strength=1.2;
function buildNormals(){G.draw(P.normal,{u_h:hTex,u_cn:cTexN,u_px:[1/TW,1/TH],u_s:strength},nFbo);G.draw(P.normal,{u_h:hTex,u_cn:cTexN2,u_px:[1/TW,1/TH],u_s:strength},nFbo2);}
buildScene();
const WARM=[1,0.78,0.52];
const L=(x,y,z,c,I)=>({x,y,z,c,I});
let noFlick=false;
function packLights(ls){const lp=[],lc=[];for(let i=0;i<12;i++){const l=ls[i]||{x:0,y:0,z:1,c:[0,0,0],I:0};const fa=l.sun||l.kind==='moon'||l.kind==='orb'||l.kind==='lamp'||l.kind==='spot'||l.kind==='box'?0:l.kind==='lantern'?0.025:l.kind==='fire'?0.16:0.08;const sl=(a1,w1,a2,w2)=>1+a1*Math.sin(T*w1+i*2.3)+a2*Math.sin(T*w2+i*5.1);const fk=l.kind==='lantern'?sl(0.13,0.8,0.05,1.9):l.kind==='wtorch'?sl(0.18,1.3,0.08,2.9):l.kind==='fire'?sl(0.15,1.1,0.06,2.5):1+fa*Math.sin(T*11+i*2.3)*Math.sin(T*4.7+i);lp.push(l.x,l.y,l.z,(l.kind==='moon'?10:l.kind==='fire'?20:l.kind==='spot'?30:l.kind==='box'?40:0)+(noFlick?1:fk));lc.push(l.c[0],l.c[1],l.c[2],l.I);}return {u_lp:lp,u_lc:lc,u_nl:ls.length};}
const FULL=[0,0,16,9],ZW=[3.4,2.35,4.4,2.475];/* ZW: 서 있는 캐릭터 둘레를 확대한 창 */
const baseU=()=>({u_cm:cTexM,u_win:FULL,u_alb:albTex,u_n:nTex,u_h:hTex,u_mask:maskTex,u_radius:9,u_fall:1,u_decode:0,u_xform:0,u_fixN:1,u_shadow:0,u_steps:48,u_view:0,u_quant:0,u_pix:4,u_spec:0,u_amb:0.14,u_ambFlat:0,u_floors:1,u_rim:1,u_glow:1,u_ambC:[1,1,1],u_cs:new Array(12).fill(0),u_csn:0,u_sss:0,u_flat:0,u_gl:0,u_cflat:0,u_blend:0,u_back:1,u_lq:0,u_target:0,u_box:[1,1],u_spot:[0.92,0.7],u_beam:[-0.62,-1]});
function light(c,lights,over,exposure=1){const u=Object.assign(baseU(),packLights(lights),over);if(!over||!over.castShadow)u.u_shadow=0;G.draw(P.light,u,litFbo);G.present(P.post,{u_src:litTex,u_exposure:exposure},c);}
/* 벽 횃불: pixelfx의 fire/torch를 스프라이트 시트(72×120, 60프레임, 30fps)로 내보내 재생한다. 자루와 받침은 고정, 불꽃만 움직인다 */
const [cvF,cxF]=mk();
/* 바닥이나 통 위에 놓는 랜턴. 7×10텍셀, 아래 변이 놓인 면이다 */
const LAN=['..ooo..','.o...o.','.ohhho.','ommmmmo','oGGgGGo','oGgYgGo','oGYYYGo','oGgYgGo','ohmmmdo','ooooooo'];const LANP={o:'#1c1513',h:'#8a6a48',m:'#5a4130',d:'#3a2a20',G:'#e8872e',g:'#ffc45e',Y:'#ffe9a8'};
function markLights(c,lights,win=FULL,behind=false){if(behind){cxF.globalCompositeOperation='source-over';cxF.clearRect(0,0,TW,TH);markOn(cxF,1,lights,FULL);cxF.globalCompositeOperation='destination-out';cxF.drawImage(cvA,0,0);const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(cvF,0,0,c.width,c.height);return;}markOn(c.getContext('2d'),c.width/TW*16/win[2],lights,win);}
function markOn(ctx,s,lights,win){ctx.imageSmoothingEnabled=false;
 lights.forEach((l,k)=>{if(l.sun||l.kind==='moon')return;const f=Math.floor(T*30+k*17)%60;const lx=Math.round((l.x-win[0])*20),ly=Math.round((win[1]+win[3]-l.y)*20);const R=(x,y,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect((lx+x)*s,(ly+y)*s,w*s,h*s);};
  if(l.kind==='lamp'){R(-3,-3,7,7,'#1c1513');R(-2,-2,5,5,l.I>4?'#ff5a4a':'#8a1616');R(-1,-1,3,3,l.I>4?'#ffd0c0':'#c02a22');return;}
  if(l.kind==='box')return;
  if(l.kind==='ring'){const cx=(lx+0.5)*s,cy=(ly+0.5)*s;ctx.beginPath();ctx.arc(cx,cy,Math.min(4.5*s,24),0,Math.PI*2);ctx.lineWidth=6;ctx.strokeStyle='rgba(20,14,10,0.7)';ctx.stroke();ctx.setLineDash([7,5]);ctx.lineWidth=3.5;ctx.strokeStyle='rgba(255,236,196,1)';ctx.stroke();ctx.setLineDash([]);return;}
  if(l.kind==='orb'||l.kind==='spot'){const cx=(lx+0.5)*s,cy=(ly+0.5)*s;ctx.beginPath();ctx.arc(cx,cy,Math.min(4.5*s,24),0,Math.PI*2);ctx.fillStyle='rgba(255,236,196,0.95)';ctx.fill();ctx.lineWidth=Math.min(Math.max(1.5,0.6*s),4);ctx.strokeStyle='rgba(40,26,14,0.85)';ctx.stroke();return;}
  if(l.kind==='lantern'){const g=Math.sin(T*3+k*1.7)>0;LAN.forEach((row,j)=>{for(let i=0;i<7;i++){const ch=row[i];if(ch==='.')continue;R(i-3,j-5,1,1,ch==='Y'&&g?'#fff6d0':LANP[ch]);}});return;}
  if(l.kind==='fire'){const g=Math.floor(T*15)%45;ctx.drawImage(CAMP,(g%9)*32,Math.floor(g/9)*30+9,32,21,(lx-16)*s,(ly-10)*s,32*s,21*s);return;}
  if(l.kind==='wtorch'){const sx=(f%10)*36,sy=Math.floor(f/10)*60;const X0=lx-18,Y0=ly+13-47;ctx.drawImage(TORCH,sx,sy+40,36,20,X0*s,(Y0+40)*s,36*s,20*s);ctx.drawImage(TORCH,sx,sy+14,36,26,(X0+5)*s,(Y0+21)*s,26*s,19*s);return;}
  const tx=Math.round((l.x-win[0])*20)-18,ty=Math.round((win[1]+win[3]-l.y)*20)+13-47;ctx.drawImage(TORCH,(f%10)*36,Math.floor(f/10)*60,36,60,tx*s,ty*s,36*s,60*s);});}

const S3W=960,S3H=540;const s3Tex=G.tex(S3W,S3H),s3Fbo=G.fbo(s3Tex);
const to3=l=>[(l.x/SX-0.5)*8.4,1.25,1.9-(l.y/SY)*3.8];
function light3(c,l,o={}){G.draw(P.s3,{u_res:[S3W,S3H],u_lp:to3(l),u_gp:to3(o.glow||l),u_lc:l.c.map(v=>v*l.I*0.38),u_amb:o.amb===undefined?0.05:o.amb,u_ambC:o.ambC||[0.6,0.7,1],u_radius:o.radius||9,u_bump:o.bump===undefined?1:o.bump},s3Fbo);G.present(P.post,{u_src:s3Tex,u_exposure:1},c);}
let dim='2d';$$('[data-dim]').forEach(b=>b.addEventListener('click',()=>{dim=b.dataset.dim;$$('[data-dim]').forEach(o=>o.setAttribute('aria-pressed',String(o.dataset.dim===dim)));redrawAll();}));

/* ---------- 히어로 ---------- */
const heroL=L(9.5,5.4,2.2,WARM,9);heroL.kind='orb';let heroAuto=true,T=0;
/* 층마다 다른 광원: 지하는 랜턴, 홀은 기둥 횃불과 벽난로 불, 3층은 약한 횃불. 홀과 3층의 창으로 달빛이 든다 */
const K=(x,y,z,c,I,kind)=>({x:x/20,y:(TH-y)/20,z,c,I,kind:kind||'wtorch'});
const TORCHC=[1,0.64,0.32],LANC=[1,0.8,0.46],MOONC=[0.55,0.72,1];
const HOUSE=[K(106,84,1.2,TORCHC,4.2),K(205,84,1.2,TORCHC,4.2),K(263,84,1.2,TORCHC,3.6),K(167,108,1.0,[1,0.55,0.26],7.5,'fire'),
 K(97,18,1.0,TORCHC,2.0),K(196,18,1.0,TORCHC,2.0),
 K(40,158,0.9,LANC,4.5,'lantern'),K(294,158,0.9,LANC,4.5,'lantern'),
 K(287,88,1,MOONC,3.2,'moon'),K(232,10,1,MOONC,3.2,'moon')];
const HERO_ON={light:1,normal:1,floors:1,rim:1,moon:1,quant:1,flick:1,shadow:1,back:1,gloss:1,sss:1,blend:1};
function heroScene(c,on){if(!on.light){light(c,[],{u_decode:4,u_amb:3.14159,u_glow:0});return;}
 const ls=on.moon?HOUSE:HOUSE.filter(l=>l.kind!=='moon');noFlick=!on.flick;
 light(c,ls,{u_amb:0.16,u_ambC:[0.62,0.74,1],u_decode:on.normal?0:4,u_floors:on.floors?1:0,u_quant:on.quant?6:0,u_rim:on.rim?2.4:0,u_sss:on.sss?0.45:0,u_gl:on.gloss?3.6:0,u_cflat:0.6,u_blend:on.blend?1:0,u_back:on.back?1:0,u_cs:CHARS.flatMap(ch=>[ch.x/20,(TH-FLOOR)/20-0.03]),u_csn:on.shadow?CHARS.length:0});
 noFlick=false;markLights(c,ls,FULL,true);}
function drawHero(){if(!cv('hero')){return;}if(dim==='3d'){cv('hero').classList.add('pt');light3(cv('hero'),heroL,{amb:0.035});return;}cv('hero').classList.remove('pt');heroScene(cv('hero'),HERO_ON);}
/* ---------- 맺음: 첫 장면을 켜고 끄며 다시 조립한다 ---------- */

const asmOn=Object.assign({},HERO_ON);
$$('[data-asm]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.asm;asmOn[k]=asmOn[k]?0:1;b.setAttribute('aria-pressed',String(!!asmOn[k]));redrawAll();}));
function drawAsm(){if(!cv('asm'))return;heroScene(cv('asm'),asmOn);}
cv('hero')?.addEventListener('pointerdown',()=>heroAuto=false);pointerLight(cv('hero'),heroL,drawHero);

/* ---------- 01 칠한 빛과 계산하는 빛 ---------- */
const BAKED=L(4.5,5,2,WARM,10);const bakeL=L(4.5,5,2,WARM,10);bakeL.kind='orb';let bakeAuto=true;
function drawBake(){if(!cv('bake-a')){return;}if(dim==='3d'){light3(cv('bake-a'),BAKED,{glow:bakeL});light3(cv('bake-b'),bakeL);return;}light(cv('bake-a'),[BAKED],{u_shadow:1,u_flat:0.5});markLights(cv('bake-a'),[Object.assign({},bakeL,{kind:'ring'})]);light(cv('bake-b'),[bakeL],{u_shadow:1});markLights(cv('bake-b'),[bakeL]);}
['bake-a','bake-b'].forEach(n=>{cv(n)?.addEventListener('pointerdown',()=>bakeAuto=false);pointerLight(cv(n),bakeL,drawBake);});

/* ---------- 02 노멀 맵: 캐릭터 둘레를 확대해 텍셀마다 방향을 본다 ---------- */
let ch='arrow';ch=radio('ch',v=>ch=v)||ch;
function readN(win){const x0=Math.round(win[0]*20),y0=Math.round(win[1]*20),w=Math.round(win[2]*20),h=Math.round(win[3]*20);const out=new Float32Array(w*h*4);gl.bindFramebuffer(gl.FRAMEBUFFER,nFbo.f);gl.readPixels(x0,y0,w,h,gl.RGBA,gl.FLOAT,out);gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {out,w,h};}
function drawNm(){if(ctl('nm-s')){const s=val('nm-s');setVal('nm-s',s.toFixed(1));if(s!==strength){strength=s;buildNormals();}}drawMk();if(!cv('nm-map'))return;
 light(cv('nm-art'),[],{u_decode:4,u_amb:3.14159,u_win:ZW,u_glow:0});
 const mode={rgb:1,arrow:1,r:2,g:3,b:4}[ch];const c=cv('nm-map');if(ch==='arrow')light(c,[],{u_decode:4,u_amb:3.14159*0.22,u_win:ZW,u_glow:0});else G.present(P.view,{u_h:hTex,u_n:nTex,u_mode:mode,u_win:ZW},c);
 if(ch==='arrow'){const ctx=c.getContext('2d');const {out,w,h}=readN(ZW);const st=c.width/w;ctx.lineCap='round';
  for(const [col,lw] of [['rgba(10,12,30,0.8)',5],['rgba(255,255,255,0.98)',2.2]]){ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=lw;ctx.beginPath();
   for(let jj=0;jj<h;jj+=2)for(let i=0;i<w;i+=2){const k=(jj*w+i)*4;const nx=out[k]*2-1,ny=out[k+1]*2-1;const cx=(i+0.5)*st,cy=c.height-(jj+0.5)*st;const len=st*1.9;ctx.moveTo(cx,cy);ctx.lineTo(cx+nx*len,cy-ny*len);}
   ctx.stroke();}}}
cv('nm-map')?.addEventListener('mousemove',e=>{const c=e.currentTarget,r=c.getBoundingClientRect();const fx=(e.clientX-r.left)/r.width,fy=1-(e.clientY-r.top)/r.height;if(fx<0||fy<0||fx>1||fy>1)return;const v=G.read(nFbo,Math.floor((ZW[0]+fx*ZW[2])*20),Math.floor((ZW[1]+fy*ZW[3])*20));const n=[v[0]*2-1,v[1]*2-1,v[2]*2-1];
 $('[data-out="nm"]').innerHTML=`노멀 (<b>${n[0].toFixed(2)}, ${n[1].toFixed(2)}, ${n[2].toFixed(2)}</b>), 저장값 (${to8(v[0])}, ${to8(v[1])}, ${to8(v[2])})`;});

/* ---------- 02 노멀: 단면 위의 화살표 ---------- */
function drawNv(){const c=cv('nv');if(!c)return;const k=val('nv-h');setVal('nv-h',k.toFixed(1));const {ctx,col}=graphSetup(c);const X=x=>DG.x0+x*DG.U,Z=z=>DG.base-z*DG.U;const H=x=>{const t=(x-8)/3.4;return Math.abs(t)<1?k*Math.pow(Math.cos(t*Math.PI/2),2):0;};
 ctx.beginPath();ctx.moveTo(X(0),Z(0));for(let x=0;x<=16.001;x+=0.08)ctx.lineTo(X(x),Z(H(x)));ctx.lineTo(X(16),DG.base+16);ctx.lineTo(X(0),DG.base+16);ctx.closePath();ctx.fillStyle=col.line;ctx.fill();
 ctx.beginPath();for(let x=0;x<=16.001;x+=0.08){x?ctx.lineTo(X(x),Z(H(x))):ctx.moveTo(X(x),Z(H(x)));}ctx.strokeStyle=col.ink;ctx.lineWidth=2;ctx.stroke();
 const arrow=(x,y,dx,dy,len,color,lw)=>{const ex=x+dx*len,ey=y-dy*len;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();const a=Math.atan2(-dy,dx);ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-8*Math.cos(a-0.42),ey-8*Math.sin(a-0.42));ctx.lineTo(ex-8*Math.cos(a+0.42),ey-8*Math.sin(a+0.42));ctx.closePath();ctx.fill();};
 ctx.textAlign='center';let si=0;for(const x of [1.6,3.6,5.7,6.9,8,9.1,10.3,12.4,14.4]){const lo=(si++%2)*40;const z=H(x);const dh=(H(x+0.01)-H(x-0.01))/0.02;const l=Math.hypot(dh,1);const n=[-dh/l,1/l];arrow(X(x),Z(z),n[0],n[1],46,col.acc,2.5);ctx.beginPath();ctx.arc(X(x),Z(z),3,0,Math.PI*2);ctx.fillStyle=col.ink;ctx.fill();
  const f=v=>(Math.abs(v)<0.005?0:v).toFixed(2);ctx.fillStyle=col.ink;ctx.font='600 13px '+col.font;ctx.fillText('x '+f(n[0]),X(x),DG.base+40+lo);ctx.fillText('z '+f(n[1]),X(x),DG.base+56+lo);ctx.strokeStyle=col.line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(X(x),DG.base+8);ctx.lineTo(X(x),DG.base+26+lo);ctx.stroke();}
 ctx.textAlign='left';ctx.font='12px '+col.font;arrow(DG.x0,22,1,0,26,col.acc,2.5);ctx.fillStyle=col.acc;ctx.fillText('노멀: 표면에 수직, 길이 1',DG.x0+36,26);}

/* ---------- 04 노멀 맵 만들기: 높이 맵과 거기서 뽑은 노멀 맵 ---------- */
function drawMk(){if(!cv('mk-h'))return;G.present(P.view,{u_h:hTex,u_n:nTex,u_mode:0,u_win:FULL},cv('mk-h'));G.present(P.view,{u_h:hTex,u_n:nTex,u_mode:1,u_win:FULL},cv('mk-n'));}

/* ---------- 05 dot(N, L): A는 단면 도해, B는 같은 계산을 장면에 적용 ---------- */
const nlL=L(6.4,3.5,2.0,WARM,10);nlL.kind='orb';
const DG={w:640,h:360,x0:28,base:232};DG.U=(DG.w-2*DG.x0)/16;
const bumpH=x=>{const t=(x-8)/3.4;return Math.abs(t)<1?1.25*Math.pow(Math.cos(t*Math.PI/2),2):0;};
function drawNlDiagram(){const c=cv('nl-a');const {ctx,col}=graphSetup(c);const X=x=>DG.x0+x*DG.U,Z=z=>DG.base-z*DG.U;
 ctx.beginPath();ctx.moveTo(X(0),Z(0));for(let x=0;x<=16.001;x+=0.08)ctx.lineTo(X(x),Z(bumpH(x)));ctx.lineTo(X(16),DG.base+16);ctx.lineTo(X(0),DG.base+16);ctx.closePath();ctx.fillStyle=col.line;ctx.fill();
 ctx.beginPath();for(let x=0;x<=16.001;x+=0.08){x?ctx.lineTo(X(x),Z(bumpH(x))):ctx.moveTo(X(x),Z(bumpH(x)));}ctx.strokeStyle=col.ink;ctx.lineWidth=2;ctx.stroke();
 const lx=X(nlL.x),lz=Z(nlL.z);
 const arrow=(x,y,dx,dy,len,color,lw)=>{const ex=x+dx*len,ey=y-dy*len;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();const a=Math.atan2(-dy,dx);ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-7*Math.cos(a-0.42),ey-7*Math.sin(a-0.42));ctx.lineTo(ex-7*Math.cos(a+0.42),ey-7*Math.sin(a+0.42));ctx.closePath();ctx.fill();};
 const xs=[1.6,3.6,5.7,6.9,8,9.1,10.3,12.4,14.4];ctx.textAlign='center';
 for(const x of xs){const z=bumpH(x);const dh=(bumpH(x+0.01)-bumpH(x-0.01))/0.02;const nl0=Math.hypot(dh,1);const n=[-dh/nl0,1/nl0];let lv=[nlL.x-x,nlL.z-z];const ll=Math.hypot(lv[0],lv[1])||1;lv=[lv[0]/ll,lv[1]/ll];const dp=n[0]*lv[0]+n[1]*lv[1];const v=Math.max(0,dp);
  ctx.setLineDash([2,4]);ctx.strokeStyle=col.acc;ctx.globalAlpha=0.35;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(X(x),Z(z));ctx.lineTo(lx,lz);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  arrow(X(x),Z(z),lv[0],lv[1],34,col.acc,2);arrow(X(x),Z(z),n[0],n[1],34,col.ink,2.5);
  ctx.beginPath();ctx.arc(X(x),Z(z),3,0,Math.PI*2);ctx.fillStyle=col.ink;ctx.fill();
  const g=Math.round(255*Math.pow(v,1/2.2));ctx.fillStyle=`rgb(${g},${g},${g})`;ctx.fillRect(X(x)-18,DG.base+34,36,30);ctx.strokeStyle=col.line;ctx.lineWidth=1;ctx.strokeRect(X(x)-18,DG.base+34,36,30);
  ctx.fillStyle=col.ink;ctx.font='600 13px '+col.font;ctx.fillText(v.toFixed(2),X(x),DG.base+82);ctx.font='11px '+col.font;ctx.fillStyle=col.mut;ctx.fillText(dp<0?'등짐':Math.round(Math.acos(clamp(dp,-1,1))*180/Math.PI)+'°',X(x),DG.base+98);}
 ctx.beginPath();ctx.arc(lx,lz,9,0,Math.PI*2);ctx.fillStyle=col.acc;ctx.fill();ctx.beginPath();ctx.arc(lx,lz,15,0,Math.PI*2);ctx.strokeStyle=col.acc;ctx.globalAlpha=0.4;ctx.lineWidth=2;ctx.stroke();ctx.globalAlpha=1;
 ctx.font='600 12px '+col.font;ctx.fillStyle=col.acc;ctx.textAlign='center';ctx.fillText('광원, 높이 z = '+nlL.z.toFixed(1),clamp(lx,70,DG.w-70),lz-22);
 ctx.textAlign='left';ctx.font='12px '+col.font;arrow(DG.x0,22,1,0,26,col.ink,2.5);ctx.fillStyle=col.ink;ctx.fillText('N 표면이 보는 방향',DG.x0+36,26);arrow(DG.x0+170,22,1,0,26,col.acc,2);ctx.fillStyle=col.acc;ctx.fillText('L 광원을 향한 방향',DG.x0+206,26);
 ctx.fillStyle=col.mut;ctx.fillText('dot(N, L) (밝기 비율)과 두 화살표 사이 각도',DG.x0,DG.base+26);}
function drawNl(){if(!cv('nl-a')){return;}nlL.z=val('nl-z');nlL.I=val('nl-i');setVal('nl-z',nlL.z.toFixed(1));setVal('nl-i',String(nlL.I));drawNlDiagram();
 light(cv('nl-b'),[nlL],{u_fall:1});markLights(cv('nl-b'),[nlL]);}
if(cv('nl-a')){const c=cv('nl-a');let down=false;c.classList.add('pt');const set=e=>{const r=c.getBoundingClientRect();const px=(e.clientX-r.left)/r.width*DG.w,py=(e.clientY-r.top)/r.height*DG.h;nlL.x=clamp((px-DG.x0)/DG.U,0,16);const z=clamp((DG.base-py)/DG.U,0.3,6);ctl('nl-z').value=String(Math.round(z*10)/10);drawNl();};c.addEventListener('pointerdown',e=>{down=true;c.setPointerCapture(e.pointerId);set(e);});c.addEventListener('pointermove',e=>{if(down)set(e);});c.addEventListener('pointerup',()=>down=false);c.addEventListener('pointercancel',()=>down=false);}
pointerLight(cv('nl-b'),nlL,drawNl);
cv('nl-b')?.addEventListener('mousemove',e=>{const c=e.currentTarget;const [qx,qy]=UV2(c,e);const v=G.read(nFbo,Math.floor(qx/SX*TW),Math.floor(qy/SY*TH));const n=[v[0]*2-1,v[1]*2-1,v[2]*2-1];const Lv=norm([nlL.x-qx,nlL.y-qy,nlL.z]);const dp=dot(n,Lv);
 $('[data-out="nl"]').innerHTML=`N (${n.map(v=>v.toFixed(2)).join(', ')}), L (${Lv.map(v=>v.toFixed(2)).join(', ')}), dot(N, L) = <b>${dp.toFixed(2)}</b>, 밝기 비율 <b>${Math.max(0,dp).toFixed(2)}</b>, 각도 ${(Math.acos(clamp(dp,-1,1))*180/Math.PI).toFixed(0)}°`;});

/* ---------- 04 광원 설정 ---------- */
let fo='window';fo=radio('fo',v=>fo=v)||fo;const FOI={inv2:0,soft:1,window:2,linear:3};
const FALLJ={inv2:(d,r)=>1/(d*d+0.05),soft:(d,r)=>1/(d*d+0.6),window:(d,r)=>{const t=clamp(1-Math.pow(d/r,4));return t*t/(d*d+0.05);},linear:(d,r)=>clamp(1-d/r)/2.5};
function drawFo(){if(!cv('fo-scene')){return;}const n=val('fo-n'),r=val('fo-r');setVal('fo-n',String(n));setVal('fo-r',r.toFixed(1));
 const c=cv('fo-graph');const {ctx,col,w:cw,h:chh}=graphSetup(c);const Pd=72,w=cw-Pd-16,h=chh-48-16;
 const X=d=>Pd+w*d/12,Y=v=>16+h-h*clamp(v);ctx.strokeStyle=col.line;for(let k=0;k<=4;k++){const gx=X(k*3),gy=Y(k/4);ctx.beginPath();ctx.moveTo(gx,16);ctx.lineTo(gx,16+h);ctx.stroke();ctx.beginPath();ctx.moveTo(Pd,gy);ctx.lineTo(Pd+w,gy);ctx.stroke();ctx.fillStyle=col.mut;ctx.fillText(String(k*3),gx-6,16+h+16);ctx.fillText((k/4).toFixed(2),34,gy+4);}
 ctx.fillStyle=col.mut;ctx.fillText('거리 d (화면 가로 = 16)',Pd+w-130,16+h+32);ctx.save();ctx.translate(16,16+h/2+48);ctx.rotate(-Math.PI/2);ctx.fillText('밝기 배율 (세기 1)',0,0);ctx.restore();
 ctx.strokeStyle=col.acc;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(X(r),16);ctx.lineTo(X(r),16+h);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=col.acc;ctx.fillText('범위 r',X(r)+5,16+h*0.42);
 const names={inv2:'1/d² (물리)',soft:'1/(d²+k)',window:'1/d² × 범위 창',linear:'선형 (1−d/r) × 0.4'};let ly=34;
 for(const k in FALLJ){const on=k===fo;ctx.strokeStyle=on?col.ink:col.mut;ctx.globalAlpha=on?1:0.55;ctx.lineWidth=on?2.5:1.5;ctx.beginPath();for(let s=0;s<=240;s++){const d=12*s/240;const gy=Y(FALLJ[k](d,r));s?ctx.lineTo(X(d),gy):ctx.moveTo(X(d),gy);}ctx.stroke();
  ctx.beginPath();ctx.moveTo(Pd+w-170,ly-4);ctx.lineTo(Pd+w-146,ly-4);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=on?col.ink:col.mut;ctx.fillText(names[k],Pd+w-138,ly);ly+=18;}
 const ls=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2+0.5;ls.push(L(8+(n===1?0:4.6)*Math.cos(a),4.5+(n===1?0:2.3)*Math.sin(a),1.5,[0.6+0.4*Math.abs(Math.cos(a)),0.6+0.3*Math.abs(Math.sin(a*1.7)),0.5+0.5*Math.abs(Math.sin(a))],5));}
 {const ml=[],mc=[];for(let i=0;i<12;i++){const l=ls[i];ml.push(l?l.x:0,l?l.y:0,l?l.z:1,0);mc.push(...(l?l.c.map(v=>v*l.I*2.6):[0,0,0]),0);}
  const sc=cv('fo-scene');G.draw(P.top,{u_lp:[0,0,1],u_lc:[0,0,0],u_amb:0.14,u_radius:r,u_pixq:0.05,u_mode:0,u_steps:1,u_mask:maskTex,u_mn:n,u_fallm:FOI[fo],u_ml:ml,u_mc:mc},litFbo);G.present(P.post,{u_src:litTex,u_exposure:1},sc);
  const x=sc.getContext('2d');const cut=fo==='window'||fo==='linear';for(const l of ls){const px=l.x/SX*sc.width,py=(1-l.y/SY)*sc.height;const col=`rgb(${l.c.map(v=>Math.round(120+135*v)).join(',')})`;x.beginPath();x.arc(px,py,r/SX*sc.width,0,Math.PI*2);x.setLineDash(cut?[]:[8,8]);x.lineWidth=2.5;x.globalAlpha=cut?0.85:0.45;x.strokeStyle=col;x.stroke();x.setLineDash([]);x.globalAlpha=1;x.beginPath();x.arc(px,py,11,0,Math.PI*2);x.fillStyle=col;x.fill();x.lineWidth=3;x.strokeStyle='rgba(20,14,10,0.85)';x.stroke();}}
 const inRange=fo==='window'||fo==='linear';const px=OW*OH;let touched=0;if(inRange){const area=Math.min(Math.PI*r*r,SX*SY);touched=Math.round(px*area/(SX*SY))*n;}
 $('[data-out="fo"]').innerHTML=`픽셀 ${px.toLocaleString()} × 광원 ${n} = 최대 <b>${(px*n).toLocaleString()}</b>번${inRange?`, 범위 안만 세면 약 <b>${touched.toLocaleString()}</b>번`:''}`;}

/* ---------- 05 그림자: 위에서 내려다보는 방 ---------- */
const SHT=[[2.0,7.7],[12.4,8.0],[14.8,4.6],[10.3,1.1],[1.6,1.3],[6.3,5.2]];/* A에서 걸음을 보여 줄 표본 픽셀 */
const shL=L(7,3.2,1.4,WARM,13);shL.kind='orb';let shAuto=true;
const occPoly=o=>{if(o.t==='box'){const [cx,cy]=o.c,[hx,hy]=o.h;return [[cx-hx,cy-hy],[cx+hx,cy-hy],[cx+hx,cy+hy],[cx-hx,cy+hy]];}const p=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;p.push([o.c[0]+o.r*Math.cos(a),o.c[1]+o.r*Math.sin(a)]);}return p;};
const occHas=(o,lp)=>o.t==='box'?Math.abs(lp.x-o.c[0])<=o.h[0]&&Math.abs(lp.y-o.c[1])<=o.h[1]:Math.hypot(lp.x-o.c[0],lp.y-o.c[1])<=o.r;
function occPolys(lp){return OCC.filter(o=>!occHas(o,lp)).map(occPoly);}
const extFrom=(pt,lp)=>{const dx=pt[0]-lp.x,dy=pt[1]-lp.y,l=Math.hypot(dx,dy)||1;return [pt[0]+dx/l*60,pt[1]+dy/l*60];};
function buildShadowMask(lp){const verts=[];let edges=0;for(const poly of occPolys(lp)){for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];const ep=extFrom(p,lp),eq=extFrom(q,lp);verts.push(p[0],p[1],q[0],q[1],eq[0],eq[1],p[0],p[1],eq[0],eq[1],ep[0],ep[1]);edges++;}}G.drawTris(verts,maskFbo,[SX,SY]);return edges;}
function topDraw(c,mode,steps){const fk=1+0.07*Math.sin(T*11)*Math.sin(T*4.7);G.draw(P.top,{u_lp:[shL.x,shL.y,shL.z],u_lc:shL.c.map(v=>v*shL.I*2.6*fk),u_amb:0.14,u_radius:11,u_pixq:0.05,u_mode:mode,u_steps:steps,u_mask:maskTex,u_mn:0,u_fallm:0,u_ml:new Array(48).fill(0),u_mc:new Array(48).fill(0)},litFbo);G.present(P.post,{u_src:litTex,u_exposure:1},c);}
function drawSh(){if(!cv('sh-a')){return;}const steps=48;const edges=buildShadowMask(shL);topDraw(cv('sh-a'),0,steps);topDraw(cv('sh-b'),1,steps);markLights(cv('sh-a'),[shL]);markLights(cv('sh-b'),[shL]);
 if(togs['sh-edges']){{const c=cv('sh-a'),x=c.getContext('2d');const Tp=p=>[p[0]/SX*c.width,(1-p[1]/SY)*c.height];const oc=OCC.filter(o=>!occHas(o,shL));const N=16;
  for(const tg of SHT){let hit=-1;for(let i=1;i<=N;i++){const px=tg[0]+(shL.x-tg[0])*i/(N+1),py=tg[1]+(shL.y-tg[1])*i/(N+1);if(oc.some(o=>occHas(o,{x:px,y:py}))){hit=i;break;}}
   for(let i=1;i<=(hit<0?N:hit);i++){const a=Tp([tg[0]+(shL.x-tg[0])*i/(N+1),tg[1]+(shL.y-tg[1])*i/(N+1)]);x.beginPath();x.arc(a[0],a[1],i===hit?7:4,0,Math.PI*2);x.fillStyle=i===hit?'rgba(255,70,110,0.95)':'rgba(255,236,196,0.9)';x.fill();}
   const a=Tp(tg);x.beginPath();x.arc(a[0],a[1],9,0,Math.PI*2);x.lineWidth=3;x.strokeStyle=hit<0?'rgba(255,236,196,0.95)':'rgba(255,70,110,0.95)';x.stroke();}}
  const c=cv('sh-b'),ctx=c.getContext('2d');ctx.strokeStyle='rgba(255,80,120,0.9)';ctx.lineWidth=2;const Tp=p=>[p[0]/SX*c.width,(1-p[1]/SY)*c.height];for(const poly of occPolys(shL)){for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];const a=Tp(p),b=Tp(q),ea=Tp(extFrom(p,shL)),eb=Tp(extFrom(q,shL));ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(eb[0],eb[1]);ctx.lineTo(ea[0],ea[1]);ctx.closePath();ctx.stroke();}}}
 $('[data-out="sh"]').innerHTML=`A: 픽셀 ${(OW*OH).toLocaleString()} × ${steps}걸음 = 검사 최대 <b>${(OW*OH*steps).toLocaleString()}</b>번. B: 모서리 ${edges} × 2 = 삼각형 <b>${edges*2}</b>개`;}
['sh-a','sh-b'].forEach(n=>{cv(n)?.addEventListener('pointerdown',()=>shAuto=false);pointerLight(cv(n),shL,drawSh);});

/* ---------- 06 임포트 규칙과 반전: 같은 확대 창에서 캐릭터로 본다 ---------- */
const encL=L(5.75,4.7,0.2,WARM,5);encL.kind='orb';
let enc='srgb';enc=radio('enc',v=>enc=v)||enc;
function drawEnc(){if(!cv('enc-a')){return;}const srgb=enc==='srgb',flip=enc==='flip',bc5=enc==='bc5';const mode=srgb?1:flip?2:bc5?3:0;
 light(cv('enc-a'),[encL],{u_decode:mode,u_win:ZW});light(cv('enc-b'),[encL],{u_win:ZW});markLights(cv('enc-a'),[encL],ZW);markLights(cv('enc-b'),[encL],ZW);
 let e=[128/255,128/255,1];if(flip)e[1]=1-e[1];if(srgb)e=e.map(dec);let d=e.map(v=>v*2-1);if(bc5)d[2]=Math.sqrt(Math.max(0,1-d[0]*d[0]-d[1]*d[1]));d=norm(d);const deg=Math.acos(clamp(d[2],-1,1))*180/Math.PI;
 const applied=srgb?'sRGB 디코딩':flip?'초록 반전':bc5?'BC5 재구성':'없음';
 $('[data-out="enc"]').innerHTML=`저장값 (128, 128, 255)를 A는 (${d.map(v=>(Math.abs(v)<0.005?0:v).toFixed(2)).join(', ')})로 읽음, 정면에서 <b>${deg.toFixed(1)}°</b>`;}
pointerLight(cv('enc-a'),encL,drawEnc,ZW);pointerLight(cv('enc-b'),encL,drawEnc,ZW);
const tanL=L(6.75,3.85,0.9,WARM,5);tanL.kind='orb';
function drawTan(){if(!cv('tan-a')){return;}light(cv('tan-a'),[tanL],{u_win:ZW,u_n:nTex2});light(cv('tan-b'),[tanL],{u_win:ZW});markLights(cv('tan-a'),[tanL],ZW);markLights(cv('tan-b'),[tanL],ZW);}
pointerLight(cv('tan-a'),tanL,drawTan,ZW);pointerLight(cv('tan-b'),tanL,drawTan,ZW);

/* ---------- 07 비용 계산기 ---------- */
function drawCost(){if(!ctl('c-res')){return;}const [rw,rh]=ctl('c-res').value.split('x').map(Number);const n=val('c-n');setVal('c-n',String(n));const sc=parseFloat(ctl('c-scale').value);const nm=ctl('c-nm').checked,sh=ctl('c-sh').checked;
 const px=rw*rh;const rows=[['스프라이트 그리기 (알베도)',px],['라이트 텍스처: 픽셀 × 광원',px*sc*sc*n],['노멀 패스 (원본 해상도)',nm?px:0],['그림자: 광원 × 캐스터',sh?n*8*px*sc*sc*0.15:0],['합성 (라이트 × 스프라이트)',px]];
 const total=rows.reduce((s,r)=>s+r[1],0);const mx=Math.max(...rows.map(r=>r[1]));
 $('[data-out="cost"]').innerHTML=rows.map(r=>`<div><b>${r[0]}</b><i style="width:${(r[1]/mx*100).toFixed(1)}%"></i><span>${(r[1]/1e6).toFixed(1)} M</span></div>`).join('');
 $('[data-out="cost-text"]').innerHTML=`픽셀 연산 합계 약 <b>${(total/1e6).toFixed(0)}M</b>/프레임 (${rw}×${rh} = ${(px/1e6).toFixed(2)}M 픽셀). 60fps면 초당 ${(total*60/1e9).toFixed(1)}G`;}
['c-res','c-scale','c-nm','c-sh'].forEach(k=>ctl(k)?.addEventListener('change',drawCost));

/* ---------- 08 분위기와 시간대 ---------- */
let mood='evening';mood=radio('mood',v=>mood=v)||mood;
const WIN=[[287,88],[232,10]];/* 창 두 곳: 홀, 3층 */
const FIX=HOUSE.filter(l=>l.kind!=='moon');
const MOODS={
 day:{amb:1.7,ambC:[1,0.98,0.93],beam:{c:[1,0.95,0.8],I:5,dir:[-0.5,-1]},fix:'none'},
 evening:{amb:0.5,ambC:[1,0.7,0.58],beam:{c:[1,0.52,0.22],I:7,dir:[-1,-0.42]},fix:'fire'},
 night:{amb:0.22,ambC:[0.5,0.62,1],beam:{c:MOONC,I:3.4,dir:[-0.62,-1]},fix:'all'},
 torch:{amb:0.05,ambC:[0.5,0.6,1],beam:null,fix:'all'},
 alarm:{amb:0.13,ambC:[1,0.3,0.25],beam:null,fix:'alarm'},
};
function moodLights(m){const ls=[];if(m.fix==='all')ls.push(...FIX);else if(m.fix==='fire')ls.push(...FIX.filter(l=>l.kind==='fire'));else if(m.fix==='alarm'){const pu=0.3+0.7*Math.pow(0.5+0.5*Math.sin(T*4),2);FIX.filter(l=>l.kind==='wtorch').forEach(l=>ls.push({x:l.x,y:l.y,z:1.4,c:[1,0.12,0.08],I:9*pu,kind:'lamp'}));}
 if(m.beam)WIN.forEach(w=>ls.push(K(w[0],w[1],1,m.beam.c,m.beam.I,'moon')));return ls;}
function drawMood(){if(!cv('mood-b')){return;}const m=MOODS[mood];light(cv('mood-a'),[],{u_decode:4,u_amb:3.14159,u_spec:0,u_glow:0});const ls=moodLights(m);
 light(cv('mood-b'),ls,{u_decode:4,u_amb:m.amb,u_ambC:m.ambC,u_fall:1,u_floors:1,u_rim:0,u_beam:m.beam?m.beam.dir:[-0.62,-1]});markLights(cv('mood-b'),ls,FULL,true);}

/* ---------- 09 보이는 것이 규칙이 된다 ---------- */
const ruleL=L(5.2,5.2,1.6,[1,0.62,0.3],9);ruleL.kind='orb';
function visible(c){const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0,t=0;for(let i=0;i<d.length;i+=64){t++;if(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]>12)n++;}return n/t;}
function drawRule(){if(!cv('rule-a')){return;}if(dim==='3d'){light3(cv('rule-a'),ruleL,{amb:0.7,ambC:[0.8,0.85,1],radius:5});const a3=visible(cv('rule-a'));light3(cv('rule-b'),ruleL,{amb:0.01,radius:5});const b3=visible(cv('rule-b'));$('[data-out="rule"]').innerHTML=`보이는 면적: A <b>${(a3*100).toFixed(0)}%</b>, B <b>${(b3*100).toFixed(0)}%</b>`;return;}light(cv('rule-a'),[ruleL],{u_amb:2.2,u_ambC:[0.8,0.85,1],u_fall:2,u_radius:5,u_shadow:1});const va=visible(cv('rule-a'));markLights(cv('rule-a'),[ruleL]);
 light(cv('rule-b'),[ruleL],{u_amb:0.012,u_ambC:[0.5,0.6,1],u_fall:2,u_radius:5,u_shadow:1});const vb=visible(cv('rule-b'));markLights(cv('rule-b'),[ruleL]);
 $('[data-out="rule"]').innerHTML=`보이는 면적: A <b>${(va*100).toFixed(0)}%</b>, B <b>${(vb*100).toFixed(0)}%</b>`;}
pointerLight(cv('rule-a'),ruleL,drawRule);pointerLight(cv('rule-b'),ruleL,drawRule);

/* ---------- 10 그림체와의 긴장 ---------- */
const pxL=L(10,5,2.0,WARM,10);pxL.kind='orb';
function countColors(c){const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const s=new Set();for(let i=0;i<d.length;i+=16)s.add(d[i]<<16|d[i+1]<<8|d[i+2]);return s.size;}
function drawPx(){if(!cv('px-a')){return;}const steps=val('px-steps');setVal('px-steps',String(steps));const pix=4;const nmOn=togs['px-nm'];
 const over={u_pix:pix,u_shadow:1,u_spec:0};if(!nmOn)over.u_decode=4;
 light(cv('px-a'),[pxL],over);const ca=countColors(cv('px-a'));light(cv('px-b'),[pxL],Object.assign({},over,{u_quant:steps}));const cb=countColors(cv('px-b'));markLights(cv('px-a'),[pxL]);markLights(cv('px-b'),[pxL]);
 $('[data-out="px"]').innerHTML=`화면 색 수(표본): A <b>${ca.toLocaleString()}</b>, B <b>${cb.toLocaleString()}</b>`;}
pointerLight(cv('px-a'),pxL,drawPx);pointerLight(cv('px-b'),pxL,drawPx);


/* ================= 새 구성의 시연 ================= */
/* 빛을 넣는 세 가지 방법: 칠한 빛, 거리만 보는 빛, 표면 방향까지 보는 빛 */
function drawWay(){if(!cv('way-a'))return;light(cv('way-a'),[BAKED],{u_flat:0.5});markLights(cv('way-a'),[Object.assign({},bakeL,{kind:'ring'})]);
 light(cv('way-b'),[bakeL],{u_decode:4,u_rim:0});markLights(cv('way-b'),[bakeL]);light(cv('way-c'),[bakeL],{});markLights(cv('way-c'),[bakeL]);}
['way-a','way-b','way-c'].forEach(n=>{cv(n)?.addEventListener('pointerdown',()=>bakeAuto=false);pointerLight(cv(n),bakeL,drawWay);});

/* 엔진이 빛을 그리는 방식: 스프라이트, 라이트 텍스처, 합성 */
const ltL=L(6.2,4.6,1.4,WARM,9);ltL.kind='orb';const ltL2=L(12.2,4.3,1.4,[0.5,0.7,1],7);ltL2.kind='orb';
/* 라이트 텍스처는 고른 배율의 크기로 따로 그리고, 원본 크기의 색과 곱한다 */
const ltBuf={};const ltTarget=sc=>{const w=Math.max(1,Math.round(OW*sc)),h=Math.max(1,Math.round(OH*sc));const k=w+'x'+h;if(!ltBuf[k]){const t=G.tex(w,h);ltBuf[k]={t,f:G.fbo(t)};}return ltBuf[k];};
const albTex2=G.tex(OW,OH),albFbo=G.fbo(albTex2),compTex=G.tex(OW,OH),compFbo=G.fbo(compTex);
function drawLt(){if(!cv('lt-a'))return;const sc=parseFloat(ctl('lt-s').value);const ls=[ltL,ltL2];const lt=ltTarget(sc);
 light(cv('lt-a'),[],{u_decode:4,u_amb:3.14159,u_glow:0});
 G.draw(P.light,Object.assign(baseU(),packLights(ls),{u_view:2,u_amb:0,u_glow:0,u_rim:0,u_decode:4}),lt.f);G.present(P.post,{u_src:lt.t,u_exposure:1},cv('lt-b'));
 G.draw(P.light,Object.assign(baseU(),packLights([]),{u_view:3,u_decode:4}),albFbo);G.draw(P.comp,{u_a:albTex2,u_l:lt.t},compFbo);G.present(P.post,{u_src:compTex,u_exposure:1},cv('lt-c'));markLights(cv('lt-c'),ls);
 const o=$('[data-out="lt"]');if(o)o.textContent=`라이트 텍스처 ${lt.f.w}×${lt.f.h}, 스프라이트 ${OW}×${OH}`;}
ctl('lt-s')?.addEventListener('change',()=>redrawAll());pointerLight(cv('lt-c'),ltL,drawLt);pointerLight(cv('lt-b'),ltL,drawLt);

/* 광원의 종류 */
let ty='spot';ty=radio('ty',v=>ty=v)||ty;const tyL=L(13.5,6.5,1.3,WARM,9);const tyBox={x:8,y:4.1};
const tyPtr={set x(v){(ty==='free'?tyBox:tyL).x=v;},set y(v){(ty==='free'?tyBox:tyL).y=v;}};
function drawTy(){if(!cv('ty'))return;const c=cv('ty');const night={u_amb:0.1,u_ambC:[0.6,0.7,1]};
 if(ty==='global'){light(c,[],{u_amb:1.25,u_ambFlat:1,u_ambC:[0.62,0.74,1],u_glow:0});return;}
 const l=Object.assign({},tyL,{kind:ty==='point'?'orb':ty==='spot'?'spot':'box'});
 if(ty==='free'){l.x=tyBox.x;l.y=tyBox.y;l.I=7;light(c,[l],Object.assign({u_box:[5.2,0.9],u_glow:0},night));return;}
 light(c,[l],Object.assign({u_beam:[0.25,-1],u_spot:[0.9,0.62]},night));markLights(c,[l]);}
pointerLight(cv('ty'),tyPtr,drawTy);

/* 무엇을 비출지 정하기 */
let tg='both';tg=radio('tg',v=>tg=v)||tg;const tgL=L(7.2,4.2,1.3,WARM,9);tgL.kind='orb';
function drawTg(){if(!cv('tg'))return;light(cv('tg'),[tgL],{u_target:tg==='bg'?1:tg==='char'?2:0,u_amb:0.3,u_ambC:[0.62,0.74,1]});markLights(cv('tg'),[tgL]);}
pointerLight(cv('tg'),tgL,drawTg);

/* 횃불 하나를 넣는 순서 */
let st='1';st=radio('st',v=>st=v)||st;const stT=K(106,84,2.2,TORCHC,6);
function drawSt(){if(!cv('st'))return;const n=parseInt(st,10);const c=cv('st');const base={u_amb:0.42,u_ambC:[0.5,0.62,1],u_glow:0,u_rim:0};
 if(n===1){light(c,[],base);return;}
 const t=Object.assign({},stT,{z:n>=4?1.1:2.2});noFlick=n<5;
 light(c,[t],Object.assign({},base,{u_decode:n>=3?0:4,u_fall:n>=4?2:1,u_radius:n>=4?5.5:9,u_glow:n>=5?1:0,u_rim:n>=5?1:0}));noFlick=false;markLights(c,[t],FULL,true);}

/* 노멀 맵 글 첫 화면: 왼쪽 반은 노멀 맵 없이, 오른쪽 반은 켜고 */
const [cvH,cxH]=(()=>{const c=document.createElement('canvas');c.width=OW;c.height=OH;return [c,c.getContext('2d')];})();
function drawNHero(){const c=cv('nhero');if(!c)return;heroScene(c,Object.assign({},HERO_ON,{normal:0,quant:0}));cxH.drawImage(c,0,0);heroScene(c,Object.assign({},HERO_ON,{quant:0}));const x=c.getContext('2d');x.drawImage(cvH,0,0,OW/2,OH,0,0,OW/2,OH);x.fillStyle='rgba(244,244,244,0.9)';x.fillRect(OW/2-1,0,2,OH);
 x.font='700 24px Pretendard, sans-serif';for(const [t,X] of [['노멀 맵 없이',24],['노멀 맵을 켜고',OW/2+24]]){const w=x.measureText(t).width+28;x.fillStyle='rgba(20,22,36,0.85)';x.fillRect(X,22,w,44);x.fillStyle='#f4f4f4';x.fillText(t,X+14,53);}}
/* 노멀 맵 글: 요철이 있는 벽과 없는 벽 (3D) */
const whyL=L(8,4.6,1.4,WARM,10);let whyAuto=true;
function drawWhy(){if(!cv('why-a'))return;light3(cv('why-a'),whyL,{bump:0});light3(cv('why-b'),whyL,{bump:1});}
['why-a','why-b'].forEach(n=>{cv(n)?.addEventListener('pointerdown',()=>whyAuto=false);pointerLight(cv(n),whyL,drawWhy);});

/* 노멀 맵 글: 굽기. 촘촘한 표면의 방향을 평평한 표면이 받아 적는다 */
function drawBk(){const c=cv('bk');if(!c)return;const {ctx,col}=graphSetup(c);const X=x=>DG.x0+x*DG.U;const H=x=>{let h=0;for(const [cx,w,a] of [[3.2,1.3,0.7],[6.4,1.0,1.0],[8.6,1.5,0.55],[11.6,1.2,0.9],[13.6,0.8,0.5]]){const t=(x-cx)/w;if(Math.abs(t)<1)h+=a*Math.pow(Math.cos(t*Math.PI/2),2);}return h;};
 const arrow=(x,y,dx,dy,len,color,lw)=>{const ex=x+dx*len,ey=y-dy*len;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();const a=Math.atan2(-dy,dx);ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-7*Math.cos(a-0.42),ey-7*Math.sin(a-0.42));ctx.lineTo(ex-7*Math.cos(a+0.42),ey-7*Math.sin(a+0.42));ctx.closePath();ctx.fill();};
 const rows=[[150,true,'촘촘한 표면: 요철이 실제 형태로 있음'],[300,false,'단순한 표면: 형태는 평평하고, 방향만 받아 적음']];
 for(const [base,real,label] of rows){const Z=z=>base-z*DG.U;ctx.beginPath();ctx.moveTo(X(0),Z(0));for(let x=0;x<=16.001;x+=0.08)ctx.lineTo(X(x),Z(real?H(x):0));ctx.lineTo(X(16),base+12);ctx.lineTo(X(0),base+12);ctx.closePath();ctx.fillStyle=col.line;ctx.fill();
  ctx.beginPath();for(let x=0;x<=16.001;x+=0.08){x?ctx.lineTo(X(x),Z(real?H(x):0)):ctx.moveTo(X(x),Z(real?H(x):0));}ctx.strokeStyle=col.ink;ctx.lineWidth=2;ctx.stroke();
  for(let x=0.8;x<=15.3;x+=0.9){const dh=(H(x+0.01)-H(x-0.01))/0.02;const l=Math.hypot(dh,1);arrow(X(x),Z(real?H(x):0),-dh/l,1/l,26,col.acc,2);}
  ctx.fillStyle=col.ink;ctx.font='600 13px '+col.font;ctx.textAlign='left';ctx.fillText(label,DG.x0,base+34);}}

/* 노멀 맵 글: 광원 하나로 끈 것과 켠 것 */
const apL=L(9.6,4.4,1.2,WARM,9);apL.kind='orb';let apAuto=true;
function drawAp(){if(!cv('ap-a'))return;apL.z=val('ap-z');setVal('ap-z',apL.z.toFixed(1));light(cv('ap-a'),[apL],{u_decode:4,u_rim:0});light(cv('ap-b'),[apL],{u_rim:0});markLights(cv('ap-a'),[apL]);markLights(cv('ap-b'),[apL]);}
['ap-a','ap-b'].forEach(n=>{cv(n)?.addEventListener('pointerdown',()=>apAuto=false);pointerLight(cv(n),apL,drawAp);});

/* 노멀 맵 글: 같은 시간대를 노멀 맵 없이, 있이 */
function drawMoodN(){if(!cv('mn-a'))return;const m=MOODS[mood];const ls=moodLights(m);const u={u_amb:m.amb,u_ambC:m.ambC,u_fall:1,u_floors:1,u_rim:0,u_beam:m.beam?m.beam.dir:[-0.62,-1]};
 light(cv('mn-a'),ls,Object.assign({u_decode:4},u));markLights(cv('mn-a'),ls,FULL,true);light(cv('mn-b'),ls,Object.assign({u_decode:0},u));markLights(cv('mn-b'),ls,FULL,true);}

/* ---------- 재생 루프: 화면에 보이는 시연만 움직인다 ---------- */
const vis={};const io=new IntersectionObserver(es=>es.forEach(e=>{vis[e.target.dataset.demo]=e.isIntersecting;}),{rootMargin:'100px'});
const LIVE={hero:()=>drawHero(),'bake-b':()=>drawBake(),'mood-b':()=>drawMood(),'nl-b':()=>drawNl(),'sh-a':()=>drawSh(),'rule-b':()=>drawRule(),'px-a':()=>drawPx(),'tan-a':()=>drawTan(),'enc-a':()=>drawEnc(),'fo-scene':()=>drawFo(),'nm-map':()=>drawNm(),'mk-n':()=>drawNm(),asm:()=>drawAsm(),'way-a':drawWay,'way-b':drawWay,'way-c':drawWay,'lt-c':()=>drawLt(),ty:()=>drawTy(),tg:()=>drawTg(),st:()=>drawSt(),'why-b':()=>drawWhy(),'ap-b':()=>drawAp(),'mn-b':()=>drawMoodN(),nhero:()=>drawNHero()};
Object.keys(LIVE).forEach(n=>{const c=cv(n);if(c)io.observe(c);});
let last=0;
(function loop(ts){if(!reduced){if(ts-last>50){const dt=Math.min(0.1,(ts-last)/1000);T+=dt;sceneTime+=dt;last=ts;
  if(Object.keys(LIVE).some(n=>vis[n])){stepChars(dt);buildScene();
   if(heroAuto&&dim==='3d'){heroL.x=8+5.5*Math.cos(T*0.45);heroL.y=4.6+1.6*Math.sin(T*0.6);}
   if(shAuto){shL.x=8+5.2*Math.cos(T*0.35+1.0);shL.y=4.5+2.6*Math.sin(T*0.5+0.4);}
   if(bakeAuto){bakeL.x=8+5.2*Math.cos(T*0.5+2.2);bakeL.y=4.6+1.6*Math.sin(T*0.7+1.2);}
   if(whyAuto){whyL.x=8+5.5*Math.cos(T*0.45);whyL.y=4.6+1.6*Math.sin(T*0.6);}
   if(apAuto){apL.x=8+3.4*Math.cos(T*0.5+0.6);apL.y=4.3+1.0*Math.sin(T*0.8);}
   const ran=new Set();for(const n in LIVE)if(vis[n]&&!ran.has(LIVE[n])){ran.add(LIVE[n]);LIVE[n]();}}}
 requestAnimationFrame(loop);}})(0);

function redrawAll(){buildScene();drawBake();drawNv();drawNm();drawNl();drawFo();drawSh();drawEnc();drawTan();drawCost();drawMood();drawRule();drawPx();drawHero();drawAsm();drawWay();drawLt();drawTy();drawTg();drawSt();drawWhy();drawBk();drawAp();drawMoodN();drawNHero();}
$$('input[type=range]').forEach(r=>r.addEventListener('input',redrawAll));
redrawAll();
})();
