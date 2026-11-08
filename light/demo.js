(()=>{
'use strict';
const G=window.GLX;const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const cv=n=>$(`canvas[data-demo="${n}"]`);
if(!G||!G.ok){$$('.frame').forEach(f=>{f.innerHTML='<p style="color:#fff;padding:24px;font-size:14px">이 시연은 WebGL2와 부동소수점 렌더 타깃이 필요합니다. 최신 Chrome, Edge, Firefox, Safari에서 열어 주세요.</p>';});return;}
const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v;
const enc=x=>{x=clamp(x);return x<=0.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-0.055};
const dec=v=>{v=clamp(v);return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
const to8=v=>Math.round(clamp(v)*255);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const ctl=n=>$(`[data-ctl="${n}"]`),val=n=>parseFloat(ctl(n).value),setVal=(n,t)=>{const e=$(`[data-val="${n}"]`);if(e)e.textContent=t;};
const togs={};$$('[data-tog]').forEach(b=>{togs[b.dataset.tog]=b.getAttribute('aria-pressed')==='true';b.addEventListener('click',()=>{togs[b.dataset.tog]=!togs[b.dataset.tog];b.setAttribute('aria-pressed',String(togs[b.dataset.tog]));redrawAll();});});
function radio(attr,onPick){const bs=$$(`[data-${attr}]`);bs.forEach(b=>b.addEventListener('click',()=>{bs.forEach(o=>o.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');onPick(b.dataset[attr]);redrawAll();}));const on=bs.find(b=>b.getAttribute('aria-pressed')==='true');return on?on.dataset[attr]:bs[0].dataset[attr];}
function graphSetup(c){const ctx=c.getContext('2d');const cs=getComputedStyle(document.documentElement);const hexA=(hx,a)=>{const h=hx.replace('#','');const n=parseInt(h.length===3?h.split('').map(x=>x+x).join(''):h,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;};const col={ink:cs.getPropertyValue('--ink').trim(),mut:cs.getPropertyValue('--muted').trim(),line:cs.getPropertyValue('--line').trim(),acc:cs.getPropertyValue('--accent').trim(),good:cs.getPropertyValue('--good').trim()||'#2f7d5a',surfaceA:hexA(cs.getPropertyValue('--surface').trim()||'#ffffff',0.88),font:cs.getPropertyValue('--font')};ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.scale(2,2);ctx.font='12px '+col.font;const placed=[];const put=(text,x,y,opt={})=>{const tw=ctx.measureText(text).width,th=14;let px=x,py=y;if(py<16)py=16;const maxX=c.width/2-8;if(px+tw>maxX)px=opt.anchor!==undefined?opt.anchor-8-tw:maxX-tw;if(px<8)px=8;for(let k=0;k<12;k++){const hit=placed.some(r=>px<r.x+r.w+6&&px+tw+6>r.x&&py-th<r.y+r.h+2&&py+2>r.y-th);if(!hit)break;py+=th+2;}placed.push({x:px,y:py,w:tw,h:th});const prev=ctx.fillStyle;if(opt.bg){ctx.fillStyle=opt.bg;ctx.fillRect(px-3,py-th+1,tw+6,th+3);}ctx.fillStyle=opt.color||prev;ctx.fillText(text,px,py);ctx.fillStyle=prev;};return {ctx,col,w:c.width/2,h:c.height/2,put};}

/* ---------- 셰이더: 레이마칭 밤거리 장면 (선형 HDR 출력) ---------- */
const SCENE_FS=G.COMMON+`
uniform vec2 u_res;uniform vec2 u_cam;uniform float u_sunI,u_skyI;
const vec3 SUN_D=normalize(vec3(0.72,0.62,-0.32));const vec3 SUN_C=vec3(1.,0.93,0.82);const vec3 SKY_C=vec3(0.55,0.72,1.);const vec3 WIN_C=vec3(3.1,1.75,-1.9);
float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
vec2 opU(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec2 map(vec3 p,bool forShadow){
 vec2 r=vec2(p.y,1.);
 r=opU(r,vec2(3.0-p.y,2.));
 r=opU(r,vec2(p.z+4.0,3.));
 r=opU(r,vec2(p.x+3.0,3.));
 float rw=sdBox(p-vec3(3.15,1.5,-0.5),vec3(0.15,1.5,4.0));rw=max(rw,-sdBox(p-vec3(3.15,1.75,-1.9),vec3(0.3,0.75,0.8)));
 r=opU(r,vec2(rw,3.));
 vec3 w=p-vec3(3.08,1.75,-1.9);
 float frame=max(sdBox(w,vec3(0.05,0.83,0.88)),-sdBox(w,vec3(0.2,0.73,0.78)));
 frame=min(frame,min(sdBox(w,vec3(0.035,0.76,0.03)),sdBox(w,vec3(0.035,0.03,0.81))));
 frame=min(frame,sdBox(p-vec3(3.0,0.97,-1.9),vec3(0.2,0.03,0.95)));
 r=opU(r,vec2(frame,4.));
 float top=sdBox(p-vec3(0.6,0.72,-1.6),vec3(0.9,0.03,0.5));vec3 lq=p-vec3(0.6,0.35,-1.6);lq.xz=abs(lq.xz)-vec2(0.8,0.4);float legs=sdBox(lq,vec3(0.04,0.36,0.04));
 r=opU(r,vec2(min(top,legs),5.));
 r=opU(r,vec2(length(p-vec3(0.25,0.98,-1.7))-0.23,6.));
 r=opU(r,vec2(sdBox(p-vec3(1.0,0.79,-1.45),vec3(0.19,0.04,0.14)),7.));
 r=opU(r,vec2(sdBox(p-vec3(1.03,0.86,-1.48),vec3(0.16,0.03,0.12)),8.));
 r=opU(r,vec2(sdBox(p-vec3(-1.7,0.285,-2.5),vec3(0.3)),9.));
 r=opU(r,vec2(sdBox(p-vec3(0.3,0.008,-0.4),vec3(1.5,0.008,1.1)),10.));
 r=opU(r,vec2(sdBox(p-vec3(-0.9,1.8,-3.96),vec3(0.5,0.38,0.035)),11.));
 vec3 cq=p-vec3(-2.2,0.45,-0.2);float chair=min(sdBox(cq,vec3(0.25,0.03,0.25)),sdBox(cq-vec3(-0.22,0.3,0.),vec3(0.03,0.33,0.25)));vec3 clq=cq-vec3(0.,-0.24,0.);clq.xz=abs(clq.xz)-0.2;chair=min(chair,sdBox(clq,vec3(0.025,0.22,0.025)));
 r=opU(r,vec2(chair,5.));
 return r;
}
vec3 calcN(vec3 p){vec2 e=vec2(0.0012,0.);return normalize(vec3(map(p+e.xyy,false).x-map(p-e.xyy,false).x,map(p+e.yxy,false).x-map(p-e.yxy,false).x,map(p+e.yyx,false).x-map(p-e.yyx,false).x));}
vec2 march(vec3 ro,vec3 rd){float t=0.02,id=0.;for(int i=0;i<160;i++){vec3 p=ro+rd*t;if(p.x>3.31){id=0.;break;}vec2 h=map(p,false);if(h.x<0.0006*t){id=h.y;break;}t+=h.x*0.9;if(t>40.){id=0.;break;}}return vec2(t,id);}
float shadow(vec3 ro,vec3 rd,float maxd,float k){float res=1.,t=0.03,ph=1e10;for(int i=0;i<80;i++){vec3 p=ro+rd*t;if(p.x>3.31)break;float h=map(p,true).x;if(h<0.0005)return 0.;float y=h*h/(2.*ph);float d=sqrt(max(h*h-y*y,0.));res=min(res,k*d/max(t-y,1e-4));ph=h;if(res<0.002||t>maxd)break;t+=clamp(h,0.008,0.25);}return sat(res);}
float shadowFast(vec3 ro,vec3 rd){float t=0.05;for(int i=0;i<28;i++){vec3 p=ro+rd*t;if(p.x>3.31)return 1.;float h=map(p,true).x;if(h<0.004)return 0.;t+=max(h,0.03);if(t>12.)break;}return 1.;}
float ao(vec3 p,vec3 n){float occ=0.,sca=1.;for(int i=0;i<5;i++){float h=0.02+0.12*float(i);float d=map(p+n*h,false).x;occ+=(h-d)*sca;sca*=0.75;}return sat(1.-1.6*occ);}
struct M{vec3 alb;float rough;vec3 emi;};
M getMat(float id,vec3 p,inout vec3 n){M m;m.emi=vec3(0.);m.rough=0.8;
 if(id==1.){float plank=floor(p.z/0.19);float g=fbm(vec2(p.x*2.5+plank*7.,p.z*30.));vec3 wood=mix(vec3(0.42,0.27,0.15),vec3(0.58,0.4,0.22),g)*mix(0.85,1.05,hash12(vec2(plank,1.)));float gap=smoothstep(0.004,0.012,abs(fract(p.z/0.19)-0.5)*0.19-0.085);m.alb=wood*mix(0.4,1.,gap);m.rough=0.32;n=normalize(n+vec3(0.,0.,(1.-gap)*0.3*sign(fract(p.z/0.19)-0.5)));}
 else if(id==2.){m.alb=vec3(0.82,0.81,0.78);m.rough=0.9;}
 else if(id==3.){m.alb=vec3(0.74,0.71,0.65)*(0.92+0.1*fbm(p.xy*6.+p.z*3.));m.rough=0.85;float base=smoothstep(0.14,0.1,p.y);m.alb=mix(m.alb,vec3(0.5,0.42,0.33),base);}
 else if(id==4.){m.alb=vec3(0.88,0.87,0.83);m.rough=0.45;}
 else if(id==5.){m.alb=vec3(0.26,0.16,0.09)*(0.85+0.3*fbm(p.xz*12.));m.rough=0.38;}
 else if(id==6.){m.alb=vec3(0.86,0.84,0.8);m.rough=0.14;}
 else if(id==7.){m.alb=vec3(0.55,0.09,0.07);m.rough=0.5;}
 else if(id==8.){m.alb=vec3(0.1,0.22,0.52);m.rough=0.5;}
 else if(id==9.){vec3 q=p-vec3(-1.7,0.3,-2.5);vec2 uvp=abs(n.y)>0.5?q.xz:(abs(n.x)>0.5?q.zy:q.xy);float plank=floor((uvp.y+0.3)/0.15);float gap=smoothstep(0.008,0.02,abs(fract((uvp.y+0.3)/0.15)-0.5)-0.46);float edge=smoothstep(0.26,0.29,max(abs(uvp.x),abs(uvp.y)));m.alb=mix(vec3(0.4,0.27,0.14),vec3(0.5,0.35,0.18),hash12(vec2(plank,3.)))*(0.7+0.6*fbm(uvp*25.))*gap;m.alb=mix(m.alb,vec3(0.25,0.16,0.09),edge);m.rough=0.7;}
 else if(id==10.){vec2 q=p.xz-vec2(0.3,-0.4);float stripe=step(0.5,fract(q.x*2.2));float border=step(1.3,abs(q.x))+step(0.9,abs(q.y));vec3 c=mix(vec3(0.42,0.12,0.13),vec3(0.62,0.5,0.32),stripe);c=mix(c,vec3(0.18,0.2,0.3),sat(border));m.alb=c*(0.85+0.3*fbm(q*40.));m.rough=0.95;}
 else if(id==11.){vec2 q=p.xy-vec2(-0.9,1.8);float inner=step(max(abs(q.x)-0.42,abs(q.y)-0.3),0.);vec3 paint=mix(vec3(0.2,0.35,0.55),vec3(0.9,0.75,0.4),fbm(q*5.+2.));paint=mix(paint,vec3(0.3,0.5,0.25),smoothstep(0.1,-0.1,q.y+0.1));m.alb=mix(vec3(0.12,0.09,0.06),paint,inner);m.rough=mix(0.4,0.7,inner);}
 else{m.alb=vec3(0.5);}
 return m;}
vec3 sky(vec3 rd){float t=sat(rd.y*2.+0.1);vec3 c=mix(vec3(0.75,0.85,1.0),vec3(0.35,0.55,1.0),t)*u_skyI;float cl=smoothstep(0.52,0.72,fbm(rd.xz/(rd.y+0.25)*2.5+vec2(3.,1.)));c=mix(c,vec3(1.0)*u_skyI*1.2,cl*sat(rd.y*3.));float ca=dot(rd,SUN_D);c+=SUN_C*(smoothstep(0.9994,0.9998,ca)*300.+pow(sat(ca),160.)*8.+pow(sat(ca),12.)*1.5)*u_skyI/12.;
 float ground=smoothstep(0.02,-0.02,rd.y);c=mix(c,vec3(0.28,0.36,0.22)*u_skyI*0.35,ground);return c;}
vec3 lightDir(vec3 p,vec3 n,vec3 v,M m){float nl=max(dot(n,SUN_D),0.);if(nl<=0.)return vec3(0.);float sh=shadow(p+n*0.012,SUN_D,30.,40.);vec3 h=normalize(SUN_D+v);float nh=max(dot(n,h),0.);float s=2./(m.rough*m.rough+1e-3)-2.;float spec=(s+8.)/25.13*pow(nh,s)*0.04;return (m.alb/3.14159+vec3(spec))*nl*SUN_C*u_sunI*sh;}
vec3 lightWindow(vec3 p,vec3 n,vec3 v,M m){vec3 acc=vec3(0.);for(int i=0;i<4;i++){vec3 wc=WIN_C+vec3(0.,(i<2?-0.38:0.38),(i%2==0?-0.42:0.42));vec3 L=wc-p;float d=length(L);L/=d;float nl=max(dot(n,L),0.);if(nl<=0.)continue;float sh=shadow(p+n*0.012,L,d-0.2,14.);float sa=2.4/(d*d+0.8);vec3 h=normalize(L+v);float nh=max(dot(n,h),0.);float s=2./(m.rough*m.rough+1e-3)-2.;float spec=(s+8.)/25.13*pow(nh,s)*0.04;acc+=(m.alb/3.14159+vec3(spec)*0.5)*nl*SKY_C*u_skyI*0.35*sa*sh;}return acc*0.25;}
void main(){vec2 fc=(gl_FragCoord.xy-0.5*u_res)/u_res.y;vec3 ta=vec3(0.5,1.05,-1.7);vec3 ro=vec3(-1.5,1.6,3.0);
 float yaw=u_cam.x,pit=u_cam.y;vec3 rel=ro-ta;rel.xz=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw))*rel.xz;rel.y+=pit*4.;ro=ta+rel;
 vec3 f=normalize(ta-ro),r=normalize(cross(f,vec3(0.,1.,0.))),u=cross(r,f);vec3 rd=normalize(f*1.35+fc.x*r+fc.y*u);
 vec2 h=march(ro,rd);vec3 col;
 if(h.y==0.){col=sky(rd);}
 else{vec3 p=ro+rd*h.x;vec3 n=calcN(p);vec3 v=-rd;M m=getMat(h.y,p,n);float a=ao(p,n);
  col=m.emi;
  vec3 amb=vec3(0.16,0.17,0.2)*(0.6+0.4*n.y)+vec3(0.12,0.08,0.05)*(0.5-0.5*n.y);col+=m.alb*amb*a*0.35;
  col+=lightDir(p,n,v,m);
  col+=lightWindow(p,n,v,m)*a;}
 o=vec4(col,h.y==0.?50.:h.x);}
`;
/* 햇빛 기둥: 저해상도에서 시선을 따라 산란을 적분한 뒤 블러 */
const VOL_FS=SCENE_FS.slice(0,SCENE_FS.indexOf('struct M{'))+`
uniform sampler2D u_depth;
void main(){vec2 fc=(gl_FragCoord.xy-0.5*u_res)/u_res.y;vec3 ta=vec3(0.5,1.05,-1.7);vec3 ro=vec3(-1.5,1.6,3.0);
 float yaw=u_cam.x,pit=u_cam.y;vec3 rel=ro-ta;rel.xz=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw))*rel.xz;rel.y+=pit*4.;ro=ta+rel;
 vec3 f=normalize(ta-ro),r=normalize(cross(f,vec3(0.,1.,0.))),u=cross(r,f);vec3 rd=normalize(f*1.35+fc.x*r+fc.y*u);
 float depth=texture(u_depth,uv).a;float tmax=min(depth,12.);float dt=tmax/64.;
 float jit=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
 float scat=0.;float t=dt*jit;for(int i=0;i<64;i++){if(t>tmax)break;vec3 p=ro+rd*t;if(p.x<3.3)scat+=shadowFast(p,SUN_D)*dt;t+=dt;}
 vec3 col=SUN_C*u_sunI*0.0026*scat*(0.5+0.5*pow(max(dot(rd,SUN_D),0.),6.));
 o=vec4(col,1.);}
`;
const BRIGHT_FS=G.COMMON+`uniform sampler2D u_src;uniform vec2 u_px;uniform float u_ldr;void main(){vec3 c=vec3(0.);for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)c+=texture(u_src,uv+vec2(float(i),float(j))*u_px).rgb;c/=9.;float th=1.;if(u_ldr>0.5){c=min(c,vec3(1.));th=0.5;}float l=max(c.r,max(c.g,c.b));o=vec4(c*sat((l-th)/max(l,1e-4)),1.);}`;
const BLUR_FS=G.COMMON+`uniform sampler2D u_src;uniform vec2 u_dir;void main(){float w[5]=float[5](0.227,0.194,0.121,0.054,0.016);vec3 c=texture(u_src,uv).rgb*w[0];for(int i=1;i<5;i++){c+=texture(u_src,uv+u_dir*float(i)).rgb*w[i];c+=texture(u_src,uv-u_dir*float(i)).rgb*w[i];}o=vec4(c,1.);}`;
const POST_FS=G.COMMON+`
uniform sampler2D u_scene,u_bloom,u_lut,u_vol;uniform float u_exposure,u_bloomK,u_dispGamma,u_zebra,u_encode,u_lutNearest,u_split;uniform int u_op,u_lutMode,u_gm;uniform mat3 u_gmM;
float hable(float x){float A=0.15,B=0.5,C=0.1,D=0.2,E=0.02,F=0.3;return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;}
float tm1(float x,int op){if(op==1)return x/(1.+x);if(op==2){float w=4.;return x*(1.+x/(w*w))/(1.+x);}if(op==3)return hable(x*2.)/hable(11.2);if(op==4){return sat((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14));}return sat(x);}
vec3 tm(vec3 c,int op){return vec3(tm1(c.r,op),tm1(c.g,op),tm1(c.b,op));}
vec3 lutSlice(vec3 c,float b){float x=(b*16.+0.5+c.r*15.)/256.;float y=(0.5+c.g*15.)/16.;return texture(u_lut,vec2(x,y)).rgb;}
vec3 lut(vec3 c){c=sat3(c);if(u_lutNearest>0.5){vec3 q=floor(c*15.+0.5);return texture(u_lut,vec2((q.b*16.+0.5+q.r)/256.,(0.5+q.g)/16.)).rgb;}float b=c.b*15.;float b0=floor(b),b1=min(b0+1.,15.);return mix(lutSlice(c,b0),lutSlice(c,b1),b-b0);}
void main(){vec3 base=(texture(u_scene,uv).rgb+texture(u_vol,uv).rgb)*u_exposure;vec3 c=base+texture(u_bloom,uv).rgb*u_bloomK*u_exposure;
 if(u_split>0.&&uv.x<u_split){vec3 e=encS3(sat3(base));if(u_split-uv.x<0.0016)e=vec3(1.);o=vec4(e,1.);return;}
 if(u_zebra>0.5&&max(c.r,max(c.g,c.b))>1.){float s=step(0.5,fract((gl_FragCoord.x+gl_FragCoord.y)/16.));o=vec4(mix(vec3(0.3,0.,0.14),vec3(1.,0.16,0.47),s),1.);return;}
 if(u_lutMode==2)c=decS3(lut(encS3(c)));
 vec3 d=tm(c,u_op);
 if(u_gm>0)d=sat3(u_gmM*d);
 if(u_encode>0.5){vec3 e=encS3(d);if(u_lutMode==1)e=lut(e);if(u_dispGamma>0.)e=encS3(pow(e,vec3(u_dispGamma)));o=vec4(e,1.);}else o=vec4(d,1.);}
`;
const ADD_FS=G.COMMON+`uniform vec2 u_res;uniform float u_I,u_mode;
void main(){vec2 q=uv*vec2(16.,9.);vec2 cell=floor(q/1.5);vec2 f=fract(q/1.5)-0.5;float edge=smoothstep(0.47,0.44,max(abs(f.x),abs(f.y)));float alb=mix(0.18,0.5,edge)*(0.85+0.3*fbm(q*3.+hash12(cell)));
 vec2 L1=vec2(5.2,4.5),L2=vec2(10.8,4.5);vec3 c1=vec3(1.,0.74,0.42),c2=vec3(0.55,0.78,1.);
 float f1=u_I*alb*4./(dot(q-L1,q-L1)+0.9),f2=u_I*alb*4./(dot(q-L2,q-L2)+0.9);
 vec3 col=u_mode<0.5?encS3(c1*f1)+encS3(c2*f2):encS3(c1*f1+c2*f2);
 float orb=smoothstep(0.12,0.08,length(q-L1))+smoothstep(0.12,0.08,length(q-L2));col=mix(col,vec3(1.),orb);
 o=vec4(sat3(col),1.);}`;
const BLEND_FS=G.COMMON+`uniform vec2 u_res;uniform float u_mode,u_blur;
vec3 mixc(vec3 a,vec3 b,float t){return u_mode<0.5?decS3(mix(encS3(a),encS3(b),t)):mix(a,b,t);}
void main(){float x=uv.x,y=uv.y;vec3 c;
 if(y>0.68){c=mixc(vec3(1.,0.,0.),vec3(0.,1.,0.),x);}
 else if(y>0.65||(y<0.35&&y>0.32)){c=vec3(0.02,0.02,0.03);}
 else if(y>0.35){c=mixc(vec3(0.02,0.05,0.4),vec3(1.,0.85,0.2),x);}
 else{vec3 acc=vec3(0.);float wsum=0.;float R=u_blur>0.5?0.05:0.0001;for(int i=-24;i<=24;i++){float dx=float(i)/24.*R;float xx=x+dx;float on=step(abs(xx-0.35),0.012)+step(abs(xx-0.65),0.004);vec3 v=mix(vec3(0.03,0.03,0.05),vec3(3.5,2.6,1.4),on);float w=exp(-dx*dx/(2.*R*R*0.25));acc+=(u_mode<0.5?encS3(v):v)*w;wsum+=w;}acc/=wsum;o=vec4(u_mode<0.5?acc:encS3(acc),1.);return;}
 o=vec4(encS3(c),1.);}`;
/* 02 밴딩: 어두운 그라데이션을 8비트 선형 / 8비트 sRGB로 저장 */
const BAND_FS=G.COMMON+`uniform float u_mode,u_boost;
void main(){float v=0.08*pow(uv.x,1.4);float vig=0.85+0.15*(1.-pow(abs(uv.y-0.5)*2.,2.));v*=vig;float q;
 if(u_mode<0.5){q=floor(v*255.+0.5)/255.;}else{q=decS(floor(encS(v)*255.+0.5)/255.);}
 float g=u_boost>0.5?8.:1.;o=vec4(encS3(vec3(q*g)),1.);}`;

/* ---------- 프로그램과 버퍼 ---------- */
const P={scene:G.prog(SCENE_FS),vol:G.prog(VOL_FS),bright:G.prog(BRIGHT_FS),blur:G.prog(BLUR_FS),post:G.prog(POST_FS),add:G.prog(ADD_FS),blend:G.prog(BLEND_FS),band:G.prog(BAND_FS)};
const SW=1280,SH=720;const sceneTex=G.tex(SW,SH),sceneFbo=G.fbo(sceneTex);
const BW=320,BH=180;const bA=G.tex(BW,BH),bB=G.tex(BW,BH),bL=G.tex(BW,BH),fA=G.fbo(bA),fB=G.fbo(bB),fL=G.fbo(bL);const VW=480,VH=270;const vA=G.tex(VW,VH),vB=G.tex(VW,VH),fVA=G.fbo(vA),fVB=G.fbo(vB);
const cam={x:0,y:0};const SUN_I=70,SKY_I=14;
function bloomInto(dst,ldr){G.draw(P.bright,{u_src:sceneTex,u_px:[1/SW,1/SH],u_ldr:ldr?1:0},dst);const t=dst.texs[0];G.draw(P.blur,{u_src:t,u_dir:[1.6/BW,0]},fB);G.draw(P.blur,{u_src:bB,u_dir:[0,1.6/BH]},dst);G.draw(P.blur,{u_src:t,u_dir:[3.2/BW,0]},fB);G.draw(P.blur,{u_src:bB,u_dir:[0,3.2/BH]},dst);}
function renderScene(){G.draw(P.scene,{u_res:[SW,SH],u_cam:[cam.x,cam.y],u_sunI:SUN_I,u_skyI:SKY_I},sceneFbo);G.draw(P.vol,{u_res:[VW,VH],u_cam:[cam.x,cam.y],u_sunI:SUN_I,u_skyI:SKY_I,u_depth:sceneTex},fVA);G.draw(P.blur,{u_src:vA,u_dir:[1.2/VW,0]},fVB);G.draw(P.blur,{u_src:vB,u_dir:[0,1.2/VH]},fVA);G.draw(P.blur,{u_src:vA,u_dir:[2.4/VW,0]},fVB);G.draw(P.blur,{u_src:vB,u_dir:[0,2.4/VH]},fVA);bloomInto(fA,false);bloomInto(fL,true);}
renderScene();
const I3=[1,0,0,0,1,0,0,0,1];
const postDefaults=()=>({u_scene:sceneTex,u_bloom:bA,u_bloomK:0.12,u_exposure:1,u_dispGamma:0,u_zebra:0,u_encode:1,u_lutNearest:0,u_op:4,u_lutMode:0,u_lut:lutTex,u_gm:0,u_gmM:I3,u_split:0,u_vol:vA});
function post(c,over){G.present(P.post,Object.assign(postDefaults(),over),c);}

/* ---------- LUT ---------- */
const GRADES={
 neutral:c=>c,
 evening:c=>{const l=0.2126*c[0]+0.7152*c[1]+0.0722*c[2];const sh=[0.10,0.14,0.36],hi=[1,0.78,0.52];const a=0.45*(1-l),b=0.35*l;return c.map((v,k)=>{const m1=v*(1-a)+sh[k]*a;return m1*(1-b)+hi[k]*b;});},
 night:c=>{const l=0.2126*c[0]+0.7152*c[1]+0.0722*c[2];return c.map((v,k)=>Math.pow(clamp((v*0.4+l*0.6)*[0.62,0.74,1.05][k]),0.9));},
 sepia:c=>[clamp(0.393*c[0]+0.769*c[1]+0.189*c[2]),clamp(0.349*c[0]+0.686*c[1]+0.168*c[2]),clamp(0.272*c[0]+0.534*c[1]+0.131*c[2])],
 contrast:c=>c.map(v=>{const t=clamp(v);return t*t*(3-2*t);}),
};
let lutTex=null,lutData=null;
function buildLut(g){const d=new Uint8Array(256*16*4);for(let y=0;y<16;y++)for(let x=0;x<256;x++){const r=x%16,b=(x/16)|0;const c=g([r/15,y/15,b/15]);const o=(y*256+x)*4;d[o]=to8(c[0]);d[o+1]=to8(c[1]);d[o+2]=to8(c[2]);d[o+3]=255;}lutData=d;lutTex=G.texData(256,16,d,{nearest:true});}
let lutName='evening';lutName=radio('lut',v=>{lutName=v;buildLut(GRADES[lutName]);});buildLut(GRADES[lutName]);

/* ---------- 00 히어로 ---------- */
let heroT=0,lastHero=0,split=0.5;
function drawHero(){const ev=reduced?0:Math.sin(heroT)*0.8;const c=cv('hero');post(c,{u_exposure:Math.pow(2,ev),u_split:split,u_bloomK:0.18});
 const ctx=c.getContext('2d');const cs=getComputedStyle(document.documentElement);ctx.font='bold 26px '+cs.getPropertyValue('--font');ctx.textBaseline='top';
 const tag=(t,x,align)=>{const w=ctx.measureText(t).width+28;const px=align==='right'?x-w:x;ctx.fillStyle='rgba(20,21,31,0.72)';ctx.fillRect(px,22,w,44);ctx.fillStyle='#fff';ctx.fillText(t,px+14,30);};
 const sx=split*c.width;if(sx>300)tag('숫자를 그대로 자른 화면 (클램프)',Math.max(24,sx-24-ctx.measureText('숫자를 그대로 자른 화면 (클램프)').width-28+0),'left');if(c.width-sx>300)tag('빛을 알고 다룬 화면 (톤매핑 + 블룸)',Math.min(c.width-24,sx+24),'left');
 ctx.font='500 20px '+cs.getPropertyValue('--font');ctx.fillStyle='rgba(255,255,255,0.75)';ctx.fillText('경계선을 끌어 비교하세요',24,c.height-44);}
(function loop(ts){if(!reduced){if(ts-lastHero>40){heroT+=0.01;lastHero=ts;drawHero();}requestAnimationFrame(loop);}else drawHero();})(0);
{let down=false;const c=cv('hero');c.style.cursor='col-resize';const set=e=>{const r=c.getBoundingClientRect();split=clamp((e.clientX-r.left)/r.width,0.02,0.98);drawHero();};c.addEventListener('pointerdown',e=>{down=true;c.setPointerCapture(e.pointerId);set(e);});c.addEventListener('pointermove',e=>{if(down)set(e);});c.addEventListener('pointerup',()=>down=false);}

/* ---------- 01 두 가지 숫자: 두 눈금 막대 + 변환기 ---------- */
function drawTwo(){const x=val('gamma-x');setVal('gamma-x',x.toFixed(2));
 const b=cv('two-bars'),bctx=b.getContext('2d');const cs=getComputedStyle(document.documentElement);const font=cs.getPropertyValue('--font');bctx.fillStyle='#262b40';bctx.fillRect(0,0,b.width,b.height);const bw=(b.width-48)/8;
 const row=(y0,title,vals,labs)=>{bctx.fillStyle='#ffffffee';bctx.font='bold 34px '+font;bctx.fillText(title,24,y0);for(let k=0;k<8;k++){const g=to8(enc(vals[k]));bctx.fillStyle=`rgb(${g},${g},${g})`;bctx.fillRect(24+k*bw+4,y0+22,bw-8,190);bctx.fillStyle='#ffffffd0';bctx.font='600 24px '+font;bctx.fillText(labs[k][0],24+k*bw+10,y0+250);bctx.fillStyle='#ffffff90';bctx.font='500 20px '+font;bctx.fillText(labs[k][1],24+k*bw+10,y0+280);}};
 row(56,'위: 빛의 양을 같은 간격으로 8칸 (물리에 고른 눈금)',[0,1,2,3,4,5,6,7].map(k=>k/7),[0,1,2,3,4,5,6,7].map(k=>[`빛 ${(k/7).toFixed(2)}`,`→ 저장 ${to8(enc(k/7))}`]));
 row(400,'아래: 저장값을 같은 간격으로 8칸 (눈에 고른 눈금)',[0,1,2,3,4,5,6,7].map(k=>dec(k/7)),[0,1,2,3,4,5,6,7].map(k=>[`저장 ${Math.round(k/7*255)}`,`→ 빛 ${dec(k/7).toFixed(3)}`]));
 const c=cv('converter');const {ctx,col,w:cw,h:chh,put}=graphSetup(c);const Pd=48,w=cw-Pd-16,h=chh-Pd-16;
 ctx.strokeStyle=col.line;ctx.lineWidth=1;for(let k=0;k<=4;k++){const gx=Pd+w*k/4,gy=16+h-h*k/4;ctx.beginPath();ctx.moveTo(gx,16);ctx.lineTo(gx,16+h);ctx.stroke();ctx.beginPath();ctx.moveTo(Pd,gy);ctx.lineTo(Pd+w,gy);ctx.stroke();ctx.fillStyle=col.mut;ctx.fillText((k/4).toFixed(2),gx-10,16+h+16);ctx.fillText(String(Math.round(255*k/4)),8,gy+4);}
 ctx.fillStyle=col.mut;ctx.fillText('빛의 양 (선형, 0~1)',Pd+w-100,16+h+32);ctx.save();ctx.translate(12,16+h/2+50);ctx.rotate(-Math.PI/2);ctx.fillText('저장값 (sRGB, 0~255)',0,0);ctx.restore();
 ctx.strokeStyle=col.mut;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(Pd,16+h);ctx.lineTo(Pd+w,16);ctx.stroke();ctx.setLineDash([]);ctx.fillText('y = x (두 눈금이 같다면)',Pd+w*0.6,16+h*0.45);
 ctx.strokeStyle=col.ink;ctx.lineWidth=2.5;ctx.beginPath();for(let k=0;k<=200;k++){const t=k/200,gx=Pd+w*t,gy=16+h-h*enc(t);k?ctx.lineTo(gx,gy):ctx.moveTo(gx,gy);}ctx.stroke();
 const px=Pd+w*x,py=16+h-h*enc(x);ctx.strokeStyle=col.acc;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px,16+h);ctx.lineTo(px,py);ctx.lineTo(Pd,py);ctx.stroke();ctx.fillStyle=col.acc;ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();
 const hx=Pd+w*dec(0.5),hy=16+h-h*0.5;ctx.strokeStyle=col.good;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(hx,16+h);ctx.lineTo(hx,hy);ctx.lineTo(Pd,hy);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=col.good;ctx.beginPath();ctx.arc(hx,hy,4,0,Math.PI*2);ctx.fill();
 ctx.font='bold 13px '+col.font;put(`빛 ${x.toFixed(2)} → 저장 ${to8(enc(x))}`,px+10,py-10,{color:col.ink,anchor:px});put('저장 128 = 빛 0.21',hx+10,hy+16,{color:col.good,anchor:hx});
 $('[data-out="gamma"]').innerHTML=`빛의 양 <b>${x.toFixed(2)}</b> → 저장값 <b>${enc(x).toFixed(3)}</b> (${to8(enc(x))}/255). 거꾸로 저장값 ${to8(enc(x))}을 빛의 양으로 되돌리면 ${dec(to8(enc(x))/255).toFixed(3)}. 저장값 128은 빛의 양 ${dec(128/255).toFixed(3)}, 빛의 양 0.5는 저장값 ${to8(enc(0.5))}.`;}

/* ---------- 02 밴딩 + 두 방향 곡선 ---------- */
function drawGamma(){const boost=togs['band-boost']?1:0;G.present(P.band,{u_mode:0,u_boost:boost},cv('band-a'));G.present(P.band,{u_mode:1,u_boost:boost},cv('band-b'));
 const c=cv('curves');const {ctx,col,w:cw,h:chh,put}=graphSetup(c);
 /* 왼쪽: 주 그래프 */
 const Pd=48,w=Math.round(cw*0.60)-Pd,h=chh-Pd-16;
 ctx.strokeStyle=col.line;ctx.lineWidth=1;for(let k=0;k<=4;k++){const gx=Pd+w*k/4,gy=16+h-h*k/4;ctx.beginPath();ctx.moveTo(gx,16);ctx.lineTo(gx,16+h);ctx.stroke();ctx.beginPath();ctx.moveTo(Pd,gy);ctx.lineTo(Pd+w,gy);ctx.stroke();ctx.fillStyle=col.mut;ctx.fillText((k/4).toFixed(2),gx-10,16+h+16);ctx.fillText((k/4).toFixed(2),8,gy+4);}
 ctx.fillStyle=col.mut;ctx.fillText('입력 (0~1)',Pd+w-56,16+h+32);ctx.save();ctx.translate(12,16+h/2+30);ctx.rotate(-Math.PI/2);ctx.fillText('출력 (0~1)',0,0);ctx.restore();
 const curve=(fn,color,width,dash)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash||[]);ctx.beginPath();for(let k=0;k<=300;k++){const t=k/300,gx=Pd+w*t,gy=16+h-h*clamp(fn(t));k?ctx.lineTo(gx,gy):ctx.moveTo(gx,gy);}ctx.stroke();ctx.setLineDash([]);};
 curve(t=>enc(t),col.ink,2.5);curve(t=>dec(t),col.acc,2.5);curve(t=>Math.pow(t,1/2.2),col.mut,1.5,[5,4]);curve(t=>Math.pow(t,2.2),col.mut,1.5,[5,4]);
 /* 범례: 왼쪽 위 빈 영역 */
 let ly=30;for(const [cc,t,dash] of [[col.ink,'OETF: 빛의 양 → 저장값 (sRGB 인코딩)',[]],[col.acc,'EOTF: 저장값 → 빛의 양 (sRGB 디코딩)',[]],[col.mut,'감마 2.2 근사 (점선, 두 방향)',[5,4]]]){ctx.strokeStyle=cc;ctx.lineWidth=3;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(Pd+10,ly-4);ctx.lineTo(Pd+36,ly-4);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=col.ink;ctx.fillText(t,Pd+44,ly);ly+=18;}
 /* 확대 영역 표시: 입력 0~0.02, 출력 0~0.16 */
 const zx=Pd,zy=16+h-h*0.16,zw=w*0.02,zh=h*0.16;ctx.strokeStyle=col.acc;ctx.lineWidth=2;ctx.strokeRect(zx-1,zy-1,Math.max(zw,6)+2,zh+2);
 put('확대 영역 (입력 0~0.02)',zx+12,zy-6,{color:col.acc});
 /* 오른쪽: 확대 패널 */
 const ix=Math.round(cw*0.66),iw=cw-ix-16,iy=30,ih=chh-iy-Pd+2;
 ctx.strokeStyle=col.acc;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(zx+Math.max(zw,6)+2,zy-1);ctx.lineTo(ix,iy);ctx.moveTo(zx+Math.max(zw,6)+2,zy+zh+1);ctx.lineTo(ix,iy+ih);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle=col.surfaceA;ctx.fillRect(ix,iy,iw,ih);ctx.strokeStyle=col.acc;ctx.lineWidth=1.5;ctx.strokeRect(ix,iy,iw,ih);
 ctx.fillStyle=col.ink;ctx.font='bold 12px '+col.font;ctx.fillText('어두운 끝 확대',ix+10,iy+16);ctx.font='12px '+col.font;ctx.fillStyle=col.mut;ctx.fillText('가로 입력 0~0.02, 세로 출력 0~0.16',ix+10,iy+32);
 const px0=ix+34,py0=iy+ih-28,pw=iw-46,ph=ih-72;
 ctx.strokeStyle=col.line;for(let k=0;k<=4;k++){const gx=px0+pw*k/4,gy=py0-ph*k/4;ctx.beginPath();ctx.moveTo(gx,py0-ph);ctx.lineTo(gx,py0);ctx.stroke();ctx.beginPath();ctx.moveTo(px0,gy);ctx.lineTo(px0+pw,gy);ctx.stroke();ctx.fillStyle=col.mut;ctx.fillText((0.02*k/4).toFixed(3),gx-12,py0+14);ctx.fillText((0.16*k/4).toFixed(2),px0-30,gy+4);}
 const zc=(fn,color,width,dash)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash||[]);ctx.beginPath();for(let k=0;k<=100;k++){const t=0.02*k/100,gx=px0+pw*t/0.02,gy=py0-ph*clamp(fn(t)/0.16);k?ctx.lineTo(gx,gy):ctx.moveTo(gx,gy);}ctx.stroke();ctx.setLineDash([]);};
 zc(t=>enc(t),col.ink,2.5);zc(t=>Math.pow(t,1/2.2),col.mut,1.5,[5,4]);
 ctx.fillStyle=col.ink;put('sRGB: 0.0031 아래는 직선 (12.92배)',px0+6,py0-ph+16,{color:col.ink});put('감마 2.2: 0 근처에서 급히 꺾임',px0+6,py0-ph+34,{color:col.mut});}

/* ---------- 03 선형에서 계산하기 ---------- */
function drawAdd(){const I=val('add-i');setVal('add-i',I.toFixed(2));
 G.present(P.add,{u_res:[1280,720],u_I:I,u_mode:0},cv('add-a'));G.present(P.add,{u_res:[1280,720],u_I:I,u_mode:1},cv('add-b'));
 const alb=0.5,d2=2.8*2.8;const f=I*alb*4/(d2+0.9);const ea=to8(enc(f)+enc(f)),eb=to8(enc(f+f));
 $('[data-out="add"]').innerHTML=`두 광원 한가운데 픽셀(초록 채널 기준). 빛의 양 ${f.toFixed(2)} + ${f.toFixed(2)} = <b>${(2*f).toFixed(2)}</b>. A는 저장값 ${to8(enc(f))} + ${to8(enc(f))} = <b>${ea}</b>${ea>=255?' (포화)':''}, B는 합을 인코딩해 <b>${eb}</b>.`;}
function drawBlend(){const blur=togs['blend-blur']?1:0;G.present(P.blend,{u_res:[1280,720],u_mode:0,u_blur:blur},cv('blend-a'));G.present(P.blend,{u_res:[1280,720],u_mode:1,u_blur:blur},cv('blend-b'));}

/* ---------- 04 HDR 버퍼, 노출, 블룸 재료 ---------- */
function drawHdr(){const ev=val('hdr-ev');setVal('hdr-ev',(ev>=0?'+':'')+ev.toFixed(1)+' EV');const m=Math.pow(2,ev);
 post(cv('hdr-a'),{u_exposure:m,u_op:0,u_bloomK:0});post(cv('hdr-b'),{u_exposure:m,u_op:0,u_bloomK:0,u_zebra:togs['hdr-zebra']?1:0});
 post(cv('bloom-a'),{u_op:0,u_bloom:bL,u_bloomK:0.35});post(cv('bloom-b'),{u_op:0,u_bloom:bA,u_bloomK:0.35});}
cv('hdr-b').addEventListener('mousemove',e=>{const c=e.currentTarget,rc=c.getBoundingClientRect();const x=Math.floor((e.clientX-rc.left)/rc.width*SW),y=Math.floor((e.clientY-rc.top)/rc.height*SH);if(x<0||y<0||x>=SW||y>=SH)return;const m=Math.pow(2,val('hdr-ev'));const v=G.read(sceneFbo,x,SH-1-y);const r=v[0]*m,g=v[1]*m,b=v[2]*m;const mx=Math.max(r,g,b);
 $('[data-out="hdr"]').innerHTML=`픽셀 (${x}, ${y}): R <b>${r.toFixed(3)}</b> G <b>${g.toFixed(3)}</b> B <b>${b.toFixed(3)}</b>. ${mx>1?`화면 천장 1.0의 <b>${mx.toFixed(1)}배</b>라서 8비트로는 255로 잘립니다.`:'1.0 아래라 8비트로도 담깁니다.'}`;});

/* ---------- 05 톤매핑 ---------- */
const OPS={clamp:x=>clamp(x),reinhard:x=>x/(1+x),reinhardw:x=>{const w=4;return x*(1+x/(w*w))/(1+x);},hable:x=>{const f=x=>{const A=0.15,B=0.5,C=0.1,D=0.2,E=0.02,F=0.3;return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;};return f(x*2)/f(11.2);},aces:x=>clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14))};
const OPI={clamp:0,reinhard:1,reinhardw:2,hable:3,aces:4};
const OPNAME={clamp:'클램프',reinhard:'Reinhard (2002)',reinhardw:'Reinhard 확장 (흰색점 4.0)',hable:'Hable, Uncharted 2 (2010)',aces:'ACES 근사 (Narkowicz 2016, 휘도 기준 근사라 원곡선보다 밝은 쪽 채도가 높음)'};
let op='aces';op=radio('op',v=>op=v);
const SAMPLE_PX=[['창밖 하늘',[1040,500]],['햇빛 든 바닥',[816,108]],['그늘진 벽',[148,349]],['탁자 아래',[556,182]]];
function drawTm(){const ev=val('tm-ev');setVal('tm-ev',(ev>=0?'+':'')+ev.toFixed(1)+' EV');const m=Math.pow(2,ev);const f=OPS[op];
 post(cv('tm-scene'),{u_exposure:m,u_op:OPI[op],u_encode:togs['tm-noenc']?0:1});
 const c=cv('tm-graph');const {ctx,col,w:cw,h:chh,put}=graphSetup(c);
 const Pd=44,w=cw-Pd-16,h=chh-Pd-16;const lo=-6,hi=4;const X=x=>Pd+w*(Math.log2(Math.max(x,1e-6))-lo)/(hi-lo),Y=y=>16+h-h*clamp(y);
 ctx.strokeStyle=col.line;ctx.lineWidth=1;
 for(let k=lo;k<=hi;k++){const gx=X(Math.pow(2,k));ctx.beginPath();ctx.moveTo(gx,16);ctx.lineTo(gx,16+h);ctx.stroke();ctx.fillStyle=col.mut;const lab=k<0?'1/'+Math.pow(2,-k):String(Math.pow(2,k));ctx.fillText(lab,gx-8,16+h+16);}
 for(let k=0;k<=4;k++){const gy=Y(k/4);ctx.beginPath();ctx.moveTo(Pd,gy);ctx.lineTo(Pd+w,gy);ctx.stroke();ctx.fillStyle=col.mut;ctx.fillText((k/4).toFixed(2),6,gy+4);}
 ctx.fillStyle=col.mut;ctx.fillText('장면 값 (로그 눈금, 한 칸 = 1 EV)',Pd+w-200,16+h+32);ctx.save();ctx.translate(12,16+h/2+40);ctx.rotate(-Math.PI/2);ctx.fillText('화면값 (선형, 0~1)',0,0);ctx.restore();
 ctx.strokeStyle=col.acc;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(X(1),16);ctx.lineTo(X(1),16+h);ctx.stroke();ctx.setLineDash([]);put('1.0',X(1)+4,28,{color:col.acc});
 for(const k in OPS){if(k===op)continue;ctx.strokeStyle=col.line;ctx.lineWidth=1.5;ctx.beginPath();for(let s=0;s<=300;s++){const x=Math.pow(2,lo+(hi-lo)*s/300);const gx=X(x),gy=Y(OPS[k](x));s?ctx.lineTo(gx,gy):ctx.moveTo(gx,gy);}ctx.stroke();}
 ctx.strokeStyle=col.ink;ctx.lineWidth=2.5;ctx.beginPath();for(let s=0;s<=300;s++){const x=Math.pow(2,lo+(hi-lo)*s/300);const gx=X(x),gy=Y(f(x));s?ctx.lineTo(gx,gy):ctx.moveTo(gx,gy);}ctx.stroke();
 const bracket=(x0,x1,label,above)=>{const gy=above?Y(f(x1))-18:Y(f(x0))+22;ctx.strokeStyle=col.acc;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(X(x0),gy);ctx.lineTo(X(x1),gy);ctx.moveTo(X(x0),gy-4);ctx.lineTo(X(x0),gy+4);ctx.moveTo(X(x1),gy-4);ctx.lineTo(X(x1),gy+4);ctx.stroke();put(label,X(x0),above?gy-6:gy+14,{color:col.acc});};
 if(op==='hable'||op==='aces'){bracket(1/32,1/5,'발끝 (toe): 어두운 쪽을 눌러 깊게',false);bracket(1,8,'어깨 (shoulder): 밝은 쪽을 부드럽게 접음',false);}
 else if(op==='reinhard'||op==='reinhardw'){bracket(1,8,'어깨: 끝없이 눌리며 흰색에 닿지 않음',false);}
 else{put('여기서 잘림: 1.0 위는 전부 흰색',X(1)+8,Y(1)+40,{color:col.acc});}
 const samples=SAMPLE_PX.map(([n,[px,py]])=>{const v=G.read(sceneFbo,px,py);return [n,Math.max(v[0],v[1],v[2])*m];});
 for(const [n,x] of samples){const gx=X(x),gy=Y(f(x));ctx.fillStyle=col.acc;ctx.beginPath();ctx.arc(gx,gy,4,0,Math.PI*2);ctx.fill();put(n,gx+7,gy-7,{color:col.ink,anchor:gx});}
 $('[data-out="tm"]').innerHTML=`<b>${OPNAME[op]}</b>. 창밖 하늘 ${samples[0][1].toFixed(2)} → 화면값 <b>${f(samples[0][1]).toFixed(3)}</b>, 햇빛 든 바닥 ${samples[1][1].toFixed(2)} → <b>${f(samples[1][1]).toFixed(3)}</b>, 그늘진 벽 ${samples[2][1].toFixed(3)} → <b>${f(samples[2][1]).toFixed(3)}</b>. 회색 선은 다른 곡선들입니다.`;}

/* ---------- 06 LUT ---------- */
function drawLut(){const s=cv('lut-strip'),sctx=s.getContext('2d');const img=sctx.createImageData(256,16);img.data.set(lutData);sctx.putImageData(img,0,0);
 post(cv('lut-scene'),{u_lutMode:togs['lut-before']?2:1,u_lutNearest:togs['lut-nearest']?1:0});}

/* ---------- 07 색역 ---------- */
const LOCUS=[[380,0.1741,0.0050],[400,0.1733,0.0048],[420,0.1714,0.0051],[440,0.1644,0.0109],[450,0.1566,0.0177],[460,0.1440,0.0297],[470,0.1241,0.0578],[480,0.0913,0.1327],[490,0.0454,0.2950],[500,0.0082,0.5384],[510,0.0139,0.7502],[520,0.0743,0.8338],[530,0.1547,0.8059],[540,0.2296,0.7543],[550,0.3016,0.6923],[560,0.3731,0.6245],[570,0.4441,0.5547],[580,0.5125,0.4866],[590,0.5752,0.4242],[600,0.6270,0.3725],[610,0.6658,0.3340],[620,0.6915,0.3083],[630,0.7079,0.2920],[640,0.7190,0.2809],[650,0.7260,0.2740],[700,0.7347,0.2653]];
const GAMUTS={'g-709':{n:'sRGB / Rec.709',p:[[0.64,0.33],[0.30,0.60],[0.15,0.06]]},'g-p3':{n:'Display P3',p:[[0.680,0.320],[0.265,0.690],[0.150,0.060]]},'g-2020':{n:'Rec.2020',p:[[0.708,0.292],[0.170,0.797],[0.131,0.046]]}};
const D65=[0.3127,0.3290];
function inPoly(px,py,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
let gamutBase=null;
function drawGamutDiagram(){const c=cv('gamut');const {ctx,col,w:cw,h:chh}=graphSetup(c);
 const Pd=36;const k=(chh-Pd-14)/0.9;const ox=Pd+Math.max(0,(cw-Pd-12-0.8*k)/2);const X=x=>ox+x*k,Y=y=>chh-Pd-y*k;
 if(!gamutBase){const poly=LOCUS.map(l=>[l[1],l[2]]);const img=ctx.createImageData(c.width,c.height);const dd=img.data;
  for(let py=0;py<c.height;py++)for(let px=0;px<c.width;px++){const x=(px/2-ox)/k,y=(chh-Pd-py/2)/k;const o=(py*c.width+px)*4;
   if(x<0||y<=0||!inPoly(x,y,poly)){dd[o+3]=0;continue;}
   const Yl=0.55,Xc=x/y*Yl,Zc=(1-x-y)/y*Yl;let r=3.2406*Xc-1.5372*Yl-0.4986*Zc,g=-0.9689*Xc+1.8758*Yl+0.0415*Zc,b=0.0557*Xc-0.2040*Yl+1.0570*Zc;
   const mn=Math.min(r,g,b);if(mn<0){r-=mn;g-=mn;b-=mn;}const mx=Math.max(r,g,b);if(mx>1){r/=mx;g/=mx;b/=mx;}
   dd[o]=to8(enc(r));dd[o+1]=to8(enc(g));dd[o+2]=to8(enc(b));dd[o+3]=255;}
  gamutBase=img;}
 ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(gamutBase,0,0);ctx.scale(2,2);
 ctx.fillStyle=col.mut;for(let q=0;q<=8;q++){const x=q*0.1;ctx.fillText(x.toFixed(1),X(x)-8,chh-Pd+16);}for(let q=0;q<=9;q++){const y=q*0.1;ctx.fillText(y.toFixed(1),ox-30,Y(y)+4);}
 ctx.fillText('x',X(0.82),chh-Pd+16);ctx.fillText('y',ox-30,Y(0.95));
 ctx.fillStyle=col.ink;for(const l of LOCUS){if(l[0]%20===0&&l[0]>=460&&l[0]<=620){ctx.fillText(l[0]+'nm',X(l[1])+(l[1]>0.4?6:-34),Y(l[2])+(l[2]>0.5?-6:12));}}
 const colors={'g-709':col.ink,'g-p3':'#2f7d5a','g-2020':col.acc};let ly=28;const lx=Math.min(X(0.62),cw-180);
 for(const q in GAMUTS){if(!togs[q])continue;const g=GAMUTS[q];ctx.strokeStyle=colors[q];ctx.lineWidth=2.5;ctx.beginPath();g.p.forEach((pp,i)=>i?ctx.lineTo(X(pp[0]),Y(pp[1])):ctx.moveTo(X(pp[0]),Y(pp[1])));ctx.closePath();ctx.stroke();
  ctx.fillStyle=colors[q];ctx.fillRect(lx,ly-9,14,14);ctx.fillStyle=col.ink;ctx.fillText(g.n,lx+20,ly+3);ly+=20;}
 ctx.fillStyle='#fff';ctx.strokeStyle=col.ink;ctx.lineWidth=2;ctx.beginPath();ctx.arc(X(D65[0]),Y(D65[1]),5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=col.ink;ctx.fillText('D65 (백색점)',X(D65[0])+9,Y(D65[1])+4);}
/* 색역 해석 행렬 (행 우선 → 열 우선으로 변환) */
const mul3=(A,B)=>{const C=[];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=A[i*3+k]*B[k*3+j];C.push(s);}return C;};
const colMajor=M=>[M[0],M[3],M[6],M[1],M[4],M[7],M[2],M[5],M[8]];
const sRGB2XYZ=[0.4124,0.3576,0.1805,0.2126,0.7152,0.0722,0.0193,0.1192,0.9505];
const XYZ2sRGB=[3.2406,-1.5372,-0.4986,-0.9689,1.8758,0.0415,0.0557,-0.2040,1.0570];
const R2020toXYZ=[0.6370,0.1446,0.1689,0.2627,0.6780,0.0593,0.0,0.0281,1.0610];
const XYZto2020=[1.7167,-0.3557,-0.2534,-0.6667,1.6165,0.0158,0.0176,-0.0428,0.9421];
const M_WIDE=colMajor(mul3(XYZ2sRGB,R2020toXYZ));  /* sRGB 숫자를 2020 원색으로 해석해 표시: 과포화 */
const M_NARROW=colMajor(mul3(XYZto2020,sRGB2XYZ)); /* 2020 숫자를 sRGB 원색으로 그대로 표시: 탈색 */
let gm='ok';gm=radio('gm',v=>gm=v);
const CHART=[[115,82,68],[194,150,130],[98,122,157],[87,108,67],[133,128,177],[103,189,170],[214,126,44],[80,91,166],[193,90,99],[94,60,108],[157,188,64],[224,163,46],[56,61,150],[70,148,73],[175,54,60],[231,199,31],[187,86,149],[8,133,161],[243,243,242],[200,200,200],[160,160,160],[122,122,121],[85,85,85],[52,52,52]];
function applyM(Mrow,v){return [0,1,2].map(i=>Mrow[i*3]*v[0]+Mrow[i*3+1]*v[1]+Mrow[i*3+2]*v[2]);}
function drawChart(){const c=cv('gamut-chart'),ctx=c.getContext('2d');ctx.fillStyle='#262b40';ctx.fillRect(0,0,c.width,c.height);const Mrow=gm==='wide'?mul3(XYZ2sRGB,R2020toXYZ):gm==='narrow'?mul3(XYZto2020,sRGB2XYZ):null;const n=CHART.length,pw=(c.width-24)/n;
 CHART.forEach((p8,i)=>{let lin=p8.map(v=>dec(v/255));if(Mrow)lin=applyM(Mrow,lin).map(v=>clamp(v));const e=lin.map(v=>to8(enc(v)));ctx.fillStyle=`rgb(${e[0]},${e[1]},${e[2]})`;ctx.fillRect(12+i*pw+3,14,pw-6,c.height-28);});}
function drawGamut(){drawGamutDiagram();post(cv('gamut-b'),{u_gm:gm==='ok'?0:1,u_gmM:gm==='wide'?M_WIDE:gm==='narrow'?M_NARROW:I3});drawChart();}

/* ---------- 08 출력 인코딩: EOTF 비교 + 니트 축 ---------- */
let gam='2.4';gam=radio('g',v=>gam=v);
const pq=L=>{const Y=Math.max(L,0)/10000;const m1=0.1593017578125,m2=78.84375,c1=0.8359375,c2=18.8515625,c3=18.6875;const Ym=Math.pow(Y,m1);return Math.pow((c1+c2*Ym)/(1+c3*Ym),m2);};
function drawEotf(){post(cv('eotf-a'),{});post(cv('eotf-b'),{u_dispGamma:parseFloat(gam)});
 const pw=val('pw'),peak=val('peak');setVal('pw',pw+' nit');setVal('peak',peak+' nit');
 const c=cv('nits');const {ctx,col,w:cw,h:chh,put}=graphSetup(c);const Pd=48,w=cw-Pd-16,h=chh-Pd-16;const lo=-2,hi=4;const X=n=>Pd+w*(Math.log10(Math.max(n,1e-3))-lo)/(hi-lo),Y=v=>16+h-h*clamp(v);
 ctx.strokeStyle=col.line;ctx.lineWidth=1;for(let k=lo;k<=hi;k++){const gx=X(Math.pow(10,k));ctx.beginPath();ctx.moveTo(gx,16);ctx.lineTo(gx,16+h);ctx.stroke();ctx.fillStyle=col.mut;ctx.fillText(Math.pow(10,k)>=1?String(Math.pow(10,k)):Math.pow(10,k).toFixed(2),gx-10,16+h+16);}
 for(let k=0;k<=4;k++){const gy=Y(k/4);ctx.beginPath();ctx.moveTo(Pd,gy);ctx.lineTo(Pd+w,gy);ctx.stroke();ctx.fillStyle=col.mut;ctx.fillText((k/4).toFixed(2),8,gy+4);}
 ctx.fillStyle=col.mut;ctx.fillText('밝기 (니트, 로그 눈금)',Pd+w-110,16+h+32);ctx.save();ctx.translate(12,16+h/2+40);ctx.rotate(-Math.PI/2);ctx.fillText('저장값 (0~1)',0,0);ctx.restore();
 const sdrPeak=100;
 ctx.strokeStyle=col.ink;ctx.lineWidth=2.5;ctx.beginPath();for(let s=0;s<=300;s++){const n=Math.pow(10,lo+(hi-lo)*s/300);const v=n<=sdrPeak?enc(n/sdrPeak):1;const gx=X(n),gy=Y(v);s?ctx.lineTo(gx,gy):ctx.moveTo(gx,gy);}ctx.stroke();
 ctx.strokeStyle=col.acc;ctx.lineWidth=2.5;ctx.beginPath();for(let s=0;s<=300;s++){const n=Math.pow(10,lo+(hi-lo)*s/300);const gx=X(n),gy=Y(pq(n));s?ctx.lineTo(gx,gy):ctx.moveTo(gx,gy);}ctx.stroke();
 const mark=(n,v,label,color,dy)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(X(n),Y(v),5,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(X(n),Y(v));ctx.lineTo(X(n),16+h);ctx.stroke();ctx.setLineDash([]);put(label,X(n)+8,Y(v)+dy,{color:col.ink,anchor:X(n)});};
 mark(sdrPeak,1,'SDR 흰색 = 모니터 최대 (100니트 가정)',col.ink,-8);
 mark(pw,pq(pw),`Paper white ${pw}니트 → PQ ${pq(pw).toFixed(3)}`,col.acc,16);
 mark(peak,pq(peak),`디스플레이 최대 ${peak}니트 → PQ ${pq(peak).toFixed(3)}`,col.acc,-8);
 let ly=28;for(const [cc,t] of [[col.ink,'sRGB (상대값: 1.0 = 그 모니터의 최대)'],[col.acc,'PQ, ST 2084 (절대값: 저장값이 곧 니트)']]){ctx.strokeStyle=cc;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(Pd+12,ly-4);ctx.lineTo(Pd+38,ly-4);ctx.stroke();ctx.fillStyle=col.ink;ctx.fillText(t,Pd+46,ly);ly+=18;}
 const stops=Math.log2(peak/pw);
 $('[data-out="nits"]').innerHTML=`화면값 1.0(톤매핑된 흰색, UI 흰색)을 <b>${pw}니트</b>에 놓으면 PQ 저장값 <b>${pq(pw).toFixed(3)}</b> (10비트 ${Math.round(pq(pw)*1023)}). 그 위로 디스플레이 최대 ${peak}니트까지 <b>${(peak/pw).toFixed(1)}배, 약 ${stops.toFixed(1)}스톱</b>의 하이라이트 여유가 생깁니다. SDR에서는 이 여유가 0이라 하이라이트를 05의 어깨로 눌러야 했습니다.`;}

function redrawAll(){drawTwo();drawGamma();drawAdd();drawBlend();drawHdr();drawTm();drawLut();drawGamut();drawEotf();drawHero();}
$$('input[type=range]').forEach(r=>r.addEventListener('input',redrawAll));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{gamutBase=null;redrawAll();});
redrawAll();
})();
