(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[185],{5295:function(e,t,o){Promise.resolve().then(o.bind(o,9438)),Promise.resolve().then(o.t.bind(o,6087,23)),Promise.resolve().then(o.t.bind(o,2445,23)),Promise.resolve().then(o.bind(o,5925))},826:function(e,t,o){"use strict";o.d(t,{h:function(){return r}});let r=o(4829).Z.create({baseURL:"/api",headers:{"Content-Type":"application/json"},timeout:6e4});r.interceptors.response.use(e=>e,e=>{var t,o;return((null===(t=e.response)||void 0===t?void 0:t.status)===401||(null===(o=e.response)||void 0===o?void 0:o.status)===403)&&(localStorage.removeItem("token"),delete r.defaults.headers.common.Authorization,window.location.href="/login"),Promise.reject(e)}),r.interceptors.request.use(e=>{let t=localStorage.getItem("token");return t&&(e.headers.Authorization="Bearer ".concat(t)),e},e=>Promise.reject(e))},9438:function(e,t,o){"use strict";o.r(t),o.d(t,{AuthProvider:function(){return d},useAuth:function(){return c}});var r=o(7437),a=o(2265),i=o(826);class n{async sendLog(e,t){let o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};if(this.isEnabled)try{await i.h.post("/admin/logs/client",{level:e,message:t,component:o.component,action:o.action,url:o.url||window.location.href,metadata:o.metadata})}catch(e){console.warn("Failed to send client log:",e)}}error(e,t){console.error("[CLIENT ERROR] ".concat(e),t),this.sendLog("error",e,t)}warn(e,t){console.warn("[CLIENT WARN] ".concat(e),t),this.sendLog("warn",e,t)}info(e,t){console.info("[CLIENT INFO] ".concat(e),t),this.sendLog("info",e,t)}debug(e,t){console.debug("[CLIENT DEBUG] ".concat(e),t),this.sendLog("debug",e,t)}userAction(e,t,o){this.info("User action: ".concat(e),{component:t,action:e,metadata:o})}apiError(e,t,o){var r;this.error("API Error: ".concat(e),{component:"API",action:"request",metadata:{endpoint:e,error:(null==t?void 0:t.message)||t,status:null==t?void 0:null===(r=t.response)||void 0===r?void 0:r.status,...o}})}navigation(e,t){this.info("Navigation: ".concat(e," -> ").concat(t),{component:"Router",action:"navigation",metadata:{from:e,to:t}})}componentError(e,t,o){this.error("Component Error: ".concat(e),{component:e,action:"render",metadata:{error:(null==t?void 0:t.message)||t,stack:null==t?void 0:t.stack,...o}})}constructor(){this.isEnabled=!0,this.isEnabled=!1}}let s=new n,l=(0,a.createContext)(void 0);function d(e){let{children:t}=e,[o,n]=(0,a.useState)(null),[d,c]=(0,a.useState)(!0);(0,a.useEffect)(()=>{u()},[]);let u=async()=>{let e=localStorage.getItem("token");if(!e){c(!1);return}i.h.defaults.headers.common.Authorization="Bearer ".concat(e);let t=0;for(;t<5;)try{let e=await i.h.get("/auth/profile");n(e.data),c(!1);return}catch(r){var o;let e=null==r?void 0:null===(o=r.response)||void 0===o?void 0:o.status;if(t++,401===e||403===e){localStorage.removeItem("token"),delete i.h.defaults.headers.common.Authorization,n(null),c(!1);return}await new Promise(e=>setTimeout(e,Math.min(5e3,500*t)))}c(!1)},p=async(e,t)=>{try{s.info("Login attempt",{component:"Auth",action:"login",metadata:{email:e}});let{user:o,token:r,requiresTwoFactor:a,userId:l,requiresPasswordChange:d}=(await i.h.post("/auth/login",{email:e,password:t})).data;if(a)return{requiresTwoFactor:!0,userId:l};if(d)return{requiresPasswordChange:!0,userId:l};return localStorage.setItem("token",r),i.h.defaults.headers.common.Authorization="Bearer ".concat(r),n(o),s.info("Login successful",{component:"Auth",action:"login",metadata:{userId:o.id,email:e}}),{}}catch(n){var o,r,a;let t=null==n?void 0:null===(o=n.response)||void 0===o?void 0:o.status,i=null==n?void 0:null===(a=n.response)||void 0===a?void 0:null===(r=a.data)||void 0===r?void 0:r.error;throw s.apiError("/auth/login",n,{email:e}),Error(401===t?"Неверный email или пароль":500===t?"Ошибка сервера при входе":i||"Ошибка входа")}},m=async e=>{try{let{token:t,user:o}=(await i.h.post("/auth/register",e)).data;if(t&&o)return localStorage.setItem("token",t),i.h.defaults.headers.common.Authorization="Bearer ".concat(t),n(o),{token:t};return{}}catch(i){var t,o,r;let e=null==i?void 0:null===(t=i.response)||void 0===t?void 0:t.status,a=null==i?void 0:null===(r=i.response)||void 0===r?void 0:null===(o=r.data)||void 0===o?void 0:o.error;throw Error(409===e?"Пользователь с таким email уже существует":a||"Ошибка регистрации")}},f=async e=>{try{let t=await i.h.put("/auth/profile",e);n(e=>e?{...e,...t.data}:null)}catch(e){var t,o;throw Error((null===(o=e.response)||void 0===o?void 0:null===(t=o.data)||void 0===t?void 0:t.error)||"Ошибка обновления профиля")}},h=async(e,t)=>{try{let{token:o,user:r}=(await i.h.post("/auth/verify-2fa",{userId:e,code:t})).data;return localStorage.setItem("token",o),i.h.defaults.headers.common.Authorization="Bearer ".concat(o),n(r),o}catch(e){var o,r;throw Error((null==e?void 0:null===(r=e.response)||void 0===r?void 0:null===(o=r.data)||void 0===o?void 0:o.error)||"Ошибка подтверждения 2FA")}},v=async(e,t)=>{try{let{token:o,user:r}=(await i.h.post("/auth/verify-email",{userId:e,code:t})).data;return o&&(localStorage.setItem("token",o),i.h.defaults.headers.common.Authorization="Bearer ".concat(o),n(r)),o}catch(e){var o,r;throw Error((null==e?void 0:null===(r=e.response)||void 0===r?void 0:null===(o=r.data)||void 0===o?void 0:o.error)||"Ошибка подтверждения email")}},g=async(e,t)=>{try{await i.h.post("/auth/resend-code",{userId:e,type:t})}catch(e){var o,r;throw Error((null==e?void 0:null===(r=e.response)||void 0===r?void 0:null===(o=r.data)||void 0===o?void 0:o.error)||"Ошибка отправки кода")}},y=async e=>{try{return(await i.h.post("/auth/check-company",{inn:e})).data}catch(e){var t,o;throw Error((null==e?void 0:null===(o=e.response)||void 0===o?void 0:null===(t=o.data)||void 0===t?void 0:t.error)||"Ошибка проверки компании")}},b=async(e,t,o)=>{try{await i.h.put("/auth/force-change-password",{userId:e,currentPassword:t,newPassword:o})}catch(e){var r,a;throw Error((null==e?void 0:null===(a=e.response)||void 0===a?void 0:null===(r=a.data)||void 0===r?void 0:r.error)||"Ошибка смены пароля")}};return(0,r.jsx)(l.Provider,{value:{user:o,loading:d,login:p,register:m,logout:()=>{s.info("User logout",{component:"Auth",action:"logout",metadata:{userId:null==o?void 0:o.id}}),localStorage.removeItem("token"),delete i.h.defaults.headers.common.Authorization,n(null),window.location.href="/login"},updateProfile:f,verifyTwoFactor:h,verifyEmail:v,resendCode:g,checkCompany:y,forceChangePassword:b},children:t})}function c(){let e=(0,a.useContext)(l);if(void 0===e)throw Error("useAuth must be used within an AuthProvider");return e}},2445:function(){},6087:function(e){e.exports={style:{fontFamily:"'__Inter_f367f3', '__Inter_Fallback_f367f3'",fontStyle:"normal"},className:"__className_f367f3"}},5925:function(e,t,o){"use strict";let r,a;o.r(t),o.d(t,{CheckmarkIcon:function(){return K},ErrorIcon:function(){return G},LoaderIcon:function(){return W},ToastBar:function(){return el},ToastIcon:function(){return eo},Toaster:function(){return ep},default:function(){return em},resolveValue:function(){return I},toast:function(){return R},useToaster:function(){return U},useToasterStore:function(){return D}});var i,n=o(2265);let s={data:""},l=e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||s},d=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,c=/\/\*[^]*?\*\/|  +/g,u=/\n+/g,p=(e,t)=>{let o="",r="",a="";for(let i in e){let n=e[i];"@"==i[0]?"i"==i[1]?o=i+" "+n+";":r+="f"==i[1]?p(n,i):i+"{"+p(n,"k"==i[1]?"":t)+"}":"object"==typeof n?r+=p(n,t?t.replace(/([^,])+/g,e=>i.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):i):null!=n&&(i=/^--/.test(i)?i:i.replace(/[A-Z]/g,"-$&").toLowerCase(),a+=p.p?p.p(i,n):i+":"+n+";")}return o+(t&&a?t+"{"+a+"}":a)+r},m={},f=e=>{if("object"==typeof e){let t="";for(let o in e)t+=o+f(e[o]);return t}return e},h=(e,t,o,r,a)=>{var i;let n=f(e),s=m[n]||(m[n]=(e=>{let t=0,o=11;for(;t<e.length;)o=101*o+e.charCodeAt(t++)>>>0;return"go"+o})(n));if(!m[s]){let t=n!==e?e:(e=>{let t,o,r=[{}];for(;t=d.exec(e.replace(c,""));)t[4]?r.shift():t[3]?(o=t[3].replace(u," ").trim(),r.unshift(r[0][o]=r[0][o]||{})):r[0][t[1]]=t[2].replace(u," ").trim();return r[0]})(e);m[s]=p(a?{["@keyframes "+s]:t}:t,o?"":"."+s)}let l=o&&m.g?m.g:null;return o&&(m.g=m[s]),i=m[s],l?t.data=t.data.replace(l,i):-1===t.data.indexOf(i)&&(t.data=r?i+t.data:t.data+i),s},v=(e,t,o)=>e.reduce((e,r,a)=>{let i=t[a];if(i&&i.call){let e=i(o),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;i=t?"."+t:e&&"object"==typeof e?e.props?"":p(e,""):!1===e?"":e}return e+r+(null==i?"":i)},"");function g(e){let t=this||{},o=e.call?e(t.p):e;return h(o.unshift?o.raw?v(o,[].slice.call(arguments,1),t.p):o.reduce((e,o)=>Object.assign(e,o&&o.call?o(t.p):o),{}):o,l(t.target),t.g,t.o,t.k)}g.bind({g:1});let y,b,w,x=g.bind({k:1});function E(e,t){let o=this||{};return function(){let r=arguments;function a(i,n){let s=Object.assign({},i),l=s.className||a.className;o.p=Object.assign({theme:b&&b()},s),o.o=/ *go\d+/.test(l),s.className=g.apply(o,r)+(l?" "+l:""),t&&(s.ref=n);let d=e;return e[0]&&(d=s.as||e,delete s.as),w&&d[0]&&w(s),y(d,s)}return t?t(a):a}}var k=e=>"function"==typeof e,I=(e,t)=>k(e)?e(t):e,A=(r=0,()=>(++r).toString()),C=()=>{if(void 0===a&&"u">typeof window){let e=matchMedia("(prefers-reduced-motion: reduce)");a=!e||e.matches}return a},N="default",_=(e,t)=>{let{toastLimit:o}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,o)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:r}=t;return _(e,{type:e.toasts.find(e=>e.id===r.id)?1:0,toast:r});case 3:let{toastId:a}=t;return{...e,toasts:e.toasts.map(e=>e.id===a||void 0===a?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let i=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+i}))}}},P=[],z={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},L={},$=(e,t=N)=>{L[t]=_(L[t]||z,e),P.forEach(([e,o])=>{e===t&&o(L[t])})},j=e=>Object.keys(L).forEach(t=>$(e,t)),O=e=>Object.keys(L).find(t=>L[t].toasts.some(t=>t.id===e)),S=(e=N)=>t=>{$(t,e)},T={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},D=(e={},t=N)=>{let[o,r]=(0,n.useState)(L[t]||z),a=(0,n.useRef)(L[t]);(0,n.useEffect)(()=>(a.current!==L[t]&&r(L[t]),P.push([t,r]),()=>{let e=P.findIndex(([e])=>e===t);e>-1&&P.splice(e,1)}),[t]);let i=o.toasts.map(t=>{var o,r,a;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(o=e[t.type])?void 0:o.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(r=e[t.type])?void 0:r.duration)||(null==e?void 0:e.duration)||T[t.type],style:{...e.style,...null==(a=e[t.type])?void 0:a.style,...t.style}}});return{...o,toasts:i}},F=(e,t="blank",o)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...o,id:(null==o?void 0:o.id)||A()}),B=e=>(t,o)=>{let r=F(t,e,o);return S(r.toasterId||O(r.id))({type:2,toast:r}),r.id},R=(e,t)=>B("blank")(e,t);R.error=B("error"),R.success=B("success"),R.loading=B("loading"),R.custom=B("custom"),R.dismiss=(e,t)=>{let o={type:3,toastId:e};t?S(t)(o):j(o)},R.dismissAll=e=>R.dismiss(void 0,e),R.remove=(e,t)=>{let o={type:4,toastId:e};t?S(t)(o):j(o)},R.removeAll=e=>R.remove(void 0,e),R.promise=(e,t,o)=>{let r=R.loading(t.loading,{...o,...null==o?void 0:o.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let a=t.success?I(t.success,e):void 0;return a?R.success(a,{id:r,...o,...null==o?void 0:o.success}):R.dismiss(r),e}).catch(e=>{let a=t.error?I(t.error,e):void 0;a?R.error(a,{id:r,...o,...null==o?void 0:o.error}):R.dismiss(r)}),e};var M=1e3,U=(e,t="default")=>{let{toasts:o,pausedAt:r}=D(e,t),a=(0,n.useRef)(new Map).current,i=(0,n.useCallback)((e,t=M)=>{if(a.has(e))return;let o=setTimeout(()=>{a.delete(e),s({type:4,toastId:e})},t);a.set(e,o)},[]);(0,n.useEffect)(()=>{if(r)return;let e=Date.now(),a=o.map(o=>{if(o.duration===1/0)return;let r=(o.duration||0)+o.pauseDuration-(e-o.createdAt);if(r<0){o.visible&&R.dismiss(o.id);return}return setTimeout(()=>R.dismiss(o.id,t),r)});return()=>{a.forEach(e=>e&&clearTimeout(e))}},[o,r,t]);let s=(0,n.useCallback)(S(t),[t]),l=(0,n.useCallback)(()=>{s({type:5,time:Date.now()})},[s]),d=(0,n.useCallback)((e,t)=>{s({type:1,toast:{id:e,height:t}})},[s]),c=(0,n.useCallback)(()=>{r&&s({type:6,time:Date.now()})},[r,s]),u=(0,n.useCallback)((e,t)=>{let{reverseOrder:r=!1,gutter:a=8,defaultPosition:i}=t||{},n=o.filter(t=>(t.position||i)===(e.position||i)&&t.height),s=n.findIndex(t=>t.id===e.id),l=n.filter((e,t)=>t<s&&e.visible).length;return n.filter(e=>e.visible).slice(...r?[l+1]:[0,l]).reduce((e,t)=>e+(t.height||0)+a,0)},[o]);return(0,n.useEffect)(()=>{o.forEach(e=>{if(e.dismissed)i(e.id,e.removeDelay);else{let t=a.get(e.id);t&&(clearTimeout(t),a.delete(e.id))}})},[o,i]),{toasts:o,handlers:{updateHeight:d,startPause:l,endPause:c,calculateOffset:u}}},q=x`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,H=x`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Z=x`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,G=E("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${q} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${H} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${Z} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,V=x`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,W=E("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${V} 1s linear infinite;
`,Y=x`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,J=x`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,K=E("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${Y} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${J} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,Q=E("div")`
  position: absolute;
`,X=E("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,ee=x`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,et=E("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${ee} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,eo=({toast:e})=>{let{icon:t,type:o,iconTheme:r}=e;return void 0!==t?"string"==typeof t?n.createElement(et,null,t):t:"blank"===o?null:n.createElement(X,null,n.createElement(W,{...r}),"loading"!==o&&n.createElement(Q,null,"error"===o?n.createElement(G,{...r}):n.createElement(K,{...r})))},er=e=>`
0% {transform: translate3d(0,${-200*e}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,ea=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*e}%,-1px) scale(.6); opacity:0;}
`,ei=E("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,en=E("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,es=(e,t)=>{let o=e.includes("top")?1:-1,[r,a]=C()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[er(o),ea(o)];return{animation:t?`${x(r)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${x(a)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},el=n.memo(({toast:e,position:t,style:o,children:r})=>{let a=e.height?es(e.position||t||"top-center",e.visible):{opacity:0},i=n.createElement(eo,{toast:e}),s=n.createElement(en,{...e.ariaProps},I(e.message,e));return n.createElement(ei,{className:e.className,style:{...a,...o,...e.style}},"function"==typeof r?r({icon:i,message:s}):n.createElement(n.Fragment,null,i,s))});i=n.createElement,p.p=void 0,y=i,b=void 0,w=void 0;var ed=({id:e,className:t,style:o,onHeightUpdate:r,children:a})=>{let i=n.useCallback(t=>{if(t){let o=()=>{r(e,t.getBoundingClientRect().height)};o(),new MutationObserver(o).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,r]);return n.createElement("div",{ref:i,className:t,style:o},a)},ec=(e,t)=>{let o=e.includes("top"),r=e.includes("center")?{justifyContent:"center"}:e.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:C()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${t*(o?1:-1)}px)`,...o?{top:0}:{bottom:0},...r}},eu=g`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,ep=({reverseOrder:e,position:t="top-center",toastOptions:o,gutter:r,children:a,toasterId:i,containerStyle:s,containerClassName:l})=>{let{toasts:d,handlers:c}=U(o,i);return n.createElement("div",{"data-rht-toaster":i||"",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...s},className:l,onMouseEnter:c.startPause,onMouseLeave:c.endPause},d.map(o=>{let i=o.position||t,s=ec(i,c.calculateOffset(o,{reverseOrder:e,gutter:r,defaultPosition:t}));return n.createElement(ed,{id:o.id,key:o.id,onHeightUpdate:c.updateHeight,className:o.visible?eu:"",style:s},"custom"===o.type?I(o.message,o):a?a(o):n.createElement(el,{toast:o,position:i}))}))},em=R}},function(e){e.O(0,[737,971,938,744],function(){return e(e.s=5295)}),_N_E=e.O()}]);