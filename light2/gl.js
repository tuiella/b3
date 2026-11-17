/* 공통 WebGL2 헬퍼. 숨은 캔버스 하나에서 렌더링하고 결과를 각 2D 캔버스에 복사한다. */
window.GLX=(()=>{
 const cv=document.createElement('canvas');
 const gl=cv.getContext('webgl2',{premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false,alpha:false});
 if(!gl)return null;
 const extF=gl.getExtension('EXT_color_buffer_float');gl.getExtension('OES_texture_float_linear');
 const VS=`#version 300 es
in vec2 p;out vec2 uv;void main(){uv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}`;
 const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);console.error(log,src.split('\n').map((l,i)=>(i+1)+': '+l).join('\n'));throw new Error('shader: '+log);}return s;}
 function prog(fs,vs=VS){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('link: '+gl.getProgramInfoLog(p));const loc={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const u=gl.getActiveUniform(p,i);loc[u.name.replace('[0]','')]={l:gl.getUniformLocation(p,u.name),t:u.type,s:u.size};}return {p,loc};}
 function tex(w,h,opt={}){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);const f=opt.float!==false;gl.texImage2D(gl.TEXTURE_2D,0,f?gl.RGBA16F:gl.RGBA8,w,h,0,gl.RGBA,f?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);const filt=opt.nearest?gl.NEAREST:gl.LINEAR;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filt);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filt);const wrap=opt.repeat?gl.REPEAT:gl.CLAMP_TO_EDGE;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);return {t,w,h};}
 function texData(w,h,data,opt={}){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data);const filt=opt.nearest?gl.NEAREST:gl.LINEAR;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filt);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filt);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return {t,w,h};}
 function fbo(...texs){const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);texs.forEach((tx,i)=>gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,tx.t,0));gl.drawBuffers(texs.map((_,i)=>gl.COLOR_ATTACHMENT0+i));const st=gl.checkFramebufferStatus(gl.FRAMEBUFFER);if(st!==gl.FRAMEBUFFER_COMPLETE)console.error('fbo incomplete',st);gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {f,w:texs[0].w,h:texs[0].h,texs};}
 function setU(pr,name,v){const u=pr.loc[name];if(!u)return;const l=u.l;
  if(v&&v.t!==undefined&&v.w!==undefined){const unit=setU.unit++;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,v.t);gl.uniform1i(l,unit);return;}
  if(typeof v==='number'){if(u.t===gl.INT||u.t===gl.BOOL)gl.uniform1i(l,v);else gl.uniform1f(l,v);return;}
  if(typeof v==='boolean'){gl.uniform1i(l,v?1:0);return;}
  if(Array.isArray(v)||v instanceof Float32Array){const a=v instanceof Float32Array?v:new Float32Array(v.flat(2));
   switch(u.t){case gl.FLOAT:gl.uniform1fv(l,a);break;case gl.FLOAT_VEC2:gl.uniform2fv(l,a);break;case gl.FLOAT_VEC3:gl.uniform3fv(l,a);break;case gl.FLOAT_VEC4:gl.uniform4fv(l,a);break;case gl.FLOAT_MAT3:gl.uniformMatrix3fv(l,false,a);break;case gl.INT:gl.uniform1iv(l,new Int32Array(a));break;}}}
 function draw(pr,uniforms,target){if(target){gl.bindFramebuffer(gl.FRAMEBUFFER,target.f);gl.viewport(0,0,target.w,target.h);}else{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cv.width,cv.height);}
  gl.useProgram(pr.p);setU.unit=0;for(const k in uniforms)setU(pr,k,uniforms[k]);
  const a=gl.getAttribLocation(pr.p,'p');gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
 function size(w,h){if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}}
 /* 기본 프레임버퍼에 그린 뒤 대상 2D 캔버스로 복사 */
 function present(pr,uniforms,dest){size(dest.width,dest.height);draw(pr,uniforms,null);const ctx=dest.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(cv,0,0);}
 function read(target,x,y){gl.bindFramebuffer(gl.FRAMEBUFFER,target.f);const out=new Float32Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.FLOAT,out);gl.bindFramebuffer(gl.FRAMEBUFFER,null);return out;}
 /* 임의 삼각형 그리기 (그림자 다각형용) */
 const TRI_VS=`#version 300 es
in vec2 p;uniform vec2 u_scale;void main(){gl_Position=vec4(p/u_scale*2.-1.,0.,1.);}`;
 const TRI_FS=`#version 300 es
precision highp float;out vec4 o;void main(){o=vec4(1.);}`;
 let triProg=null,triBuf=null;
 function drawTris(verts,target,scale){if(!triProg){triProg=prog(TRI_FS,TRI_VS);triBuf=gl.createBuffer();}gl.bindFramebuffer(gl.FRAMEBUFFER,target.f);gl.viewport(0,0,target.w,target.h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(triProg.p);gl.uniform2f(triProg.loc.u_scale.l,scale[0],scale[1]);gl.bindBuffer(gl.ARRAY_BUFFER,triBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);const a=gl.getAttribLocation(triProg.p,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,verts.length/2);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
 const COMMON=`#version 300 es
precision highp float;
in vec2 uv;out vec4 o;
float sat(float x){return clamp(x,0.,1.);}
vec3 sat3(vec3 x){return clamp(x,0.,1.);}
float encS(float x){x=sat(x);return x<=0.0031308?12.92*x:1.055*pow(x,1./2.4)-0.055;}
vec3 encS3(vec3 c){return vec3(encS(c.r),encS(c.g),encS(c.b));}
float decS(float v){v=sat(v);return v<=0.04045?v/12.92:pow((v+0.055)/1.055,2.4);}
vec3 decS3(vec3 c){return vec3(decS(c.r),decS(c.g),decS(c.b));}
vec3 aces(vec3 x){return sat3((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14));}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=0.,w=.5;for(int i=0;i<5;i++){a+=w*vnoise(p);p=p*2.03+vec2(1.7,9.2);w*=.5;}return a;}
`;
 return {gl,cv,prog,tex,texData,fbo,draw,present,read,drawTris,COMMON,ok:!!extF};
})();
