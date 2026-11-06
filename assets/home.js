document.addEventListener("DOMContentLoaded",function(){
function toks(s){return s.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)}
var WANT=toks("L26-0417-A"),DENY=/NOT LEGIBLE|ILLEGIBLE|ASSUMED|LIKELY|CONSISTENT WITH|UNREADABLE/,BORROW=/SLIP|PACKING|EXPECTED/;
function gate(raw){var r=raw.toUpperCase().trim();if(!r)return["Review","No lot was read off the box.",0];if(DENY.test(r))return["Review","That wording admits no real read, so it counts as unread.",0];var bare=r.replace(/\(MATCHES EXPECTED\)/g," ").trim();if(!toks(bare).length)return["Review","No lot was read off the box.",0];if(BORROW.test(bare))return["Review","That borrows the lot from paperwork. A slip is printed from the order, so it can't prove what is in the box.",0];if(toks(bare).join("-")===WANT.join("-"))return["Proved","What was read is exactly the expected lot.",1];return["Hold","A lot was read and it is the wrong one, so the order stops.",0]}
var inp=document.getElementById("lot"),out=document.getElementById("out"),why=document.getElementById("why");
function run(){var r=gate(inp.value);out.textContent=r[0];out.className="out "+(r[2]?"ok":"no");why.textContent=r[1]}
inp.addEventListener("input",run);[].forEach.call(document.querySelectorAll("#chips button"),function(b){b.addEventListener("click",function(){inp.value=b.dataset.v;run()})});run();

var N={
 engine:{x:0,y:0,l:"Workflow engine",m:"about 1,200 runs a day",k:"hub"},
 storefront:{x:-300,y:-340,l:"Storefront",k:"ext"},accounting:{x:40,y:-340,l:"Accounting",k:"ext"},workbook:{x:-320,y:340,l:"Operations workbook",m:"about 1,000 active parts",k:"ext"},model:{x:400,y:-340,l:"Vision model",k:"ext"},archive:{x:800,y:-250,l:"Photo archive",k:"ext"},
 intake:{x:-600,y:-170,l:"Dock intake",m:"4 chained workflows",k:"sys"},sync:{x:-600,y:170,l:"Inventory sync",m:"3 scheduled runs a day",k:"sys"},ledger:{x:60,y:340,l:"Production ledger",m:"487 tests",k:"sys"},kiosk:{x:440,y:-110,l:"Shipping kiosk",m:"72 steps, 2 stations",k:"sys"},watch:{x:470,y:220,l:"Operations watcher",m:"read-only",k:"sys"},more:{x:-250,y:0,l:"Routine automations",m:"about 225 hours a year",k:"sys"},
 i1:{x:-1010,y:-320,l:"Phone app",g:"intake"},i2:{x:-1010,y:-230,l:"Packing list",m:"ground truth",g:"intake"},i3:{x:-1010,y:-140,l:"Side count",m:"vision",g:"intake"},i4:{x:-1010,y:-50,l:"Close-up count",m:"vision",g:"intake"},i5:{x:-810,y:-170,l:"Three-way check",g:"intake",k:"code"},i6:{x:-810,y:-300,l:"Lot-traced listing",g:"intake"},i7:{x:-810,y:-40,l:"Accounting receipt",g:"intake"},
 s1:{x:-1000,y:90,l:"API bridge",m:"desktop accounting",g:"sync"},s2:{x:-1000,y:190,l:"Stock report",g:"sync"},s3:{x:-800,y:300,l:"Reorder dates",g:"sync"},s4:{x:-1000,y:300,l:"Station routing",g:"sync"},s5:{x:-800,y:60,l:"Hourly request poll",g:"sync"},
 l1:{x:-400,y:540,l:"Raw stock rack",g:"ledger"},l2:{x:-220,y:620,l:"Parts and batches",g:"ledger"},l3:{x:0,y:680,l:"Plan, then a person's Yes",m:"server enforced",g:"ledger",k:"code"},l4:{x:290,y:620,l:"Append-only logs",m:"database enforced",g:"ledger"},l5:{x:430,y:520,l:"Assistant evals",m:"13 cases gate deploys",g:"ledger"},l6:{x:-400,y:680,l:"Travelers and labels",g:"ledger"},l7:{x:230,y:490,l:"Accounting receipt",g:"ledger"},
 k1:{x:290,y:135,l:"Station A",g:"kiosk"},k2:{x:460,y:70,l:"Station B",g:"kiosk"},k3:{x:680,y:-110,l:"Schema check",g:"kiosk",k:"code"},k4:{x:880,y:-110,l:"Verdict engine",m:"9 hold conditions",g:"kiosk",k:"code"},k5:{x:1120,y:-210,l:"Pass",g:"kiosk"},k6:{x:1120,y:-110,l:"Review",g:"kiosk"},k7:{x:1120,y:-10,l:"Hold",g:"kiosk",k:"code"},k8:{x:1120,y:90,l:"Person, with a note",g:"kiosk"},k9:{x:680,y:70,l:"Second reader",m:"local GPU, shadow only",g:"kiosk"},k0:{x:880,y:70,l:"Human review queue",g:"kiosk"},
 w1:{x:800,y:190,l:"Execution history",g:"watch"},w2:{x:800,y:290,l:"Rules with provenance",g:"watch"},w3:{x:800,y:390,l:"Findings",g:"watch"},w4:{x:560,y:390,l:"Dossiers and evidence",g:"watch"},
 m1:{x:-520,y:-110,l:"Backorder copying",g:"more"},m2:{x:-90,y:-140,l:"Payments check",g:"more"},m3:{x:-520,y:60,l:"Daily accounting report",g:"more"},m4:{x:-100,y:130,l:"Paid-order watch",m:"every 30 minutes",g:"more"},m5:{x:-330,y:150,l:"New stock email",g:"more"},
 ad:{x:40,y:1120,l:"Adapt Automations",m:"founder",k:"hub",g:"adapt"},a1:{x:-340,y:980,l:"Lead Hunter",m:"scanner, CRM, previews",k:"sys",g:"adapt"},a2:{x:420,y:980,l:"Nico",m:"live LLM chatbot",k:"sys",g:"adapt"},a3:{x:-340,y:1260,l:"Client sites and apps",k:"sys",g:"adapt"},a4:{x:420,y:1260,l:"Public report card",k:"sys",g:"adapt"},a5:{x:-650,y:900,l:"Lead scanner",g:"adapt"},a6:{x:-650,y:1050,l:"Facts-only previews",g:"adapt"},a7:{x:-90,y:880,l:"Approval gate",m:"server enforced",g:"adapt",k:"code"},a8:{x:720,y:900,l:"Scoped knowledge",g:"adapt"},a9:{x:720,y:1050,l:"Red-team cases",g:"adapt",k:"code"}
};
var L=[["intake","engine","webhooks"],["sync","engine"],["engine","ledger"],["engine","kiosk","5 webhooks"],["more","engine"],["watch","engine","read only"],["engine","accounting"],["engine","storefront"],["engine","workbook"],["kiosk","model","schema"],["kiosk","archive","photos"],["watch","kiosk"],["watch","ledger"],
 ["i1","i5"],["i2","i5"],["i3","i5"],["i4","i5"],["i5","intake"],["i5","i6"],["i5","i7"],
 ["s1","s2"],["s2","sync"],["sync","s3"],["s4","s3"],["s5","sync"],
 ["l1","l2"],["l6","l2"],["l2","l3"],["l3","l4"],["l4","l5"],["l3","ledger","token"],["ledger","l7"],
 ["k1","kiosk"],["k2","kiosk"],["kiosk","k3"],["k3","k4"],["k4","k5"],["k4","k6"],["k4","k7"],["k7","k8"],["k1","k9"],["k2","k9"],["k9","k0"],
 ["w1","watch"],["w2","watch"],["watch","w3"],["w3","w4"],
 ["more","m1"],["more","m2"],["more","m3"],["more","m4"],["more","m5"],
 ["a1","ad"],["a2","ad"],["a3","ad"],["a4","ad"],["a5","a1"],["a1","a6"],["a1","a7"],["a8","a2"],["a9","a2"]];
var cv=document.getElementById("world"),c=cv.getContext("2d"),W=0,H=0,DPR=1,still=false;
var NARROW,HOME,wide;
// The home map sits just above the headline, wherever the headline lands on this screen.
function layout(){NARROW=innerWidth<=980;wide=!NARROW;var z=NARROW?Math.max(.27,Math.min(.46,innerWidth/1700)):.62,hh=innerHeight/2,head=document.querySelector("h1").getBoundingClientRect().top+scrollY,room=head-22-62,y=680*z+40<=room?-(62+room/2-hh)/z:Math.min(360-(head-22-hh)/z,-340-(62-hh)/z);HOME={x:NARROW?-20:20,y:Math.round(y),z:z}}layout();
var cam={x:HOME.x,y:HOME.y,z:HOME.z,active:"",reveal:{},shift:0};
function size(){var dp=Math.min(devicePixelRatio||1,2);DPR=innerWidth*innerHeight*dp*dp>8e6?1.5:dp;W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;c.setTransform(DPR,0,0,DPR,0,0)}size();addEventListener("resize",function(){size();if(still)draw(0)});
function route(a,b){var pts=[],mx=(a.x+b.x)/2,i;for(i=0;i<=28;i++){var u=i/28,v=1-u;pts.push({x:v*v*v*a.x+3*v*v*u*mx+3*v*u*u*mx+u*u*u*b.x,y:v*v*v*a.y+3*v*v*u*a.y+3*v*u*u*b.y+u*u*u*b.y})}
 var d=[0];for(i=1;i<pts.length;i++)d.push(d[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y));return{p:pts,d:d,len:d[d.length-1]}}
function at(r,t){var s=t*r.len,i=1;while(i<r.d.length-1&&r.d[i]<s)i++;var a=r.p[i-1],b=r.p[i],f=(s-r.d[i-1])/((r.d[i]-r.d[i-1])||1);var nx=-(b.y-a.y),ny=b.x-a.x,nl=Math.hypot(nx,ny)||1;return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,nx:nx/nl,ny:ny/nl}}
if(NARROW){N.more.x=-270;N.more.y=-70;N.more.m=""}
var PAL=[["56,232,255","122,92,255","255,255,255","255,64,214"],["255,64,214","255,178,46","255,255,255","122,92,255"],["70,255,190","56,160,255","255,255,255","196,92,255"],["255,120,60","255,64,150","255,244,190","80,170,255"]];
function swarm(){var pal=PAL[Math.floor(Math.random()*PAL.length)],sp=[],nc=16+Math.floor(Math.random()*8),nt=26+Math.floor(Math.random()*14),i;
 for(i=0;i<nc;i++){var rr=.8+Math.pow(Math.random(),1.15)*7.2;sp.push({core:1,rad:rr,th:Math.random()*6.3,om:(.55+Math.random()*.8)*(rr<3?1.5:1),r:.34+Math.random()*.62,a:.5+Math.random()*.5,ph:Math.random()*6.3,w:3+Math.random()*7,col:i<1?pal[2]:pal[[0,1,3,0,1,3,2][Math.floor(Math.random()*7)]],halo:Math.random()<.22})}
 for(i=0;i<nt;i++){var u=Math.pow(Math.random(),1.35),sg=Math.random()<.5?-1:1;sp.push({core:0,d:6+u*50,o:sg*(.5+u*4.6)*Math.random(),arc:Math.random()*6.3,r:.34+Math.random()*(.8-u*.3),a:(.6+Math.random()*.4)*(1-u*.62),ph:Math.random()*6.3,w:2+Math.random()*7,col:pal[[0,1,3,0,1,3,2][Math.floor(Math.random()*7)]],halo:Math.random()<.2})}
 return{t:Math.random(),sp:sp,glow:pal[0]}}
var LK=L.map(function(l){var a=N[l[0]],b=N[l[1]],r=route(a,b),n=(!a.g&&!b.g)||a.k==="hub"||b.k==="hub"?3:2,ps=[];for(var i=0;i<n;i++){var s=swarm();s.t=(i+Math.random()*.6)/n;ps.push(s)}return{a:a,b:b,r:r,ps:ps}});
function vis(n){if(!n.g)return cam.adaptOnly?0:1;return cam.reveal[n.g]||0}
function PT(x,y){return{x:(x-cam.x)*cam.z+W/2+cam.shift,y:(y-cam.y)*cam.z+H/2}}
var BLUE="118,146,238";
function draw(dt){dt=dt||0;c.setTransform(DPR,0,0,DPR,0,0);c.fillStyle="#07090c";c.fillRect(0,0,W,H);
 var bg=c.createRadialGradient(W*.6,H*.42,0,W*.6,H*.42,Math.max(W,H)*.75);bg.addColorStop(0,"#0e1620");bg.addColorStop(1,"rgba(7,9,12,0)");c.fillStyle=bg;c.fillRect(0,0,W,H);
 c.lineCap="round";c.lineJoin="round";
 var now=window.gsap?gsap.ticker.time:0;
 LK.forEach(function(k){var al=Math.min(vis(k.a),vis(k.b));if(al<.01)return;c.beginPath();k.r.p.forEach(function(p,i){var q=PT(p.x,p.y);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y)});c.strokeStyle="rgba(126,160,190,"+(.13*al)+")";c.lineWidth=1;c.stroke()});
 c.globalCompositeOperation="lighter";
 var S=Math.min(1.25,Math.max(.8,cam.z));
 LK.forEach(function(k){var al=Math.min(vis(k.a),vis(k.b));if(al<.01)return;
  k.ps.forEach(function(s){if(s.t>1+60/k.r.len)return;var head=at(k.r,Math.min(s.t,1)),H0=PT(head.x,head.y);if(H0.x<-90||H0.x>W+90||H0.y<-90||H0.y>H+90)return;
   var ht=s.t<=1?1:Math.max(0,1-(s.t-1)*k.r.len/40);
   if(s.t<=1){var gr=c.createRadialGradient(H0.x,H0.y,0,H0.x,H0.y,13*S);gr.addColorStop(0,"rgba("+s.glow+","+(.34*al).toFixed(3)+")");gr.addColorStop(.45,"rgba("+s.glow+","+(.08*al).toFixed(3)+")");gr.addColorStop(1,"rgba("+s.glow+",0)");c.fillStyle=gr;c.beginPath();c.arc(H0.x,H0.y,13*S,0,6.3);c.fill()}
   s.sp.forEach(function(d){var tw=.45+.55*Math.sin(now*d.w+d.ph),A,x,y,R=d.r*S;
    if(d.core){if(s.t>1)return;var an=d.th+now*d.om,ax=Math.cos(an)*d.rad*S,ay=Math.sin(an)*d.rad*.62*S;x=H0.x+head.nx*ay+(head.ny)*ax;y=H0.y+head.ny*ay-(head.nx)*ax;A=d.a*(.55+.45*tw)*al}
    else{var tt=s.t-(d.d*S/Math.max(cam.z,.55))/k.r.len;if(tt<0||tt>1)return;var p=at(k.r,tt),Q=PT(p.x,p.y),sway=Math.sin(now*1.1+d.arc+d.d*.14)*(.5+d.d*.022);x=Q.x+p.nx*(d.o+sway)*S;y=Q.y+p.ny*(d.o+sway)*S;A=d.a*(.3+.7*tw)*al}
    if(x<-8||x>W+8||y<-8||y>H+8)return;A=A*ht*(1+(k.boost||0)*1.1);if(A>1)A=1;R=R*(1+(k.boost||0)*.4);if(d.halo){c.fillStyle="rgba("+d.col+","+(A*.2).toFixed(3)+")";c.beginPath();c.arc(x,y,R*3.4,0,6.3);c.fill()}c.fillStyle="rgba("+d.col+","+A.toFixed(3)+")";c.beginPath();c.arc(x,y,R,0,6.3);c.fill()})})});
 c.globalCompositeOperation="source-over";
 c.textBaseline="middle";c.textAlign="center";
 Object.keys(N).forEach(function(id){var n=N[id],al=vis(n);if(al<.01)return;var p=PT(n.x,n.y),z=Math.max(NARROW?.62:.74,Math.min(cam.z,1.25)),hub=n.k==="hub",sys=n.k==="sys",act=cam.active===id;var fs=(hub||sys?13.5:n.k==="ext"?12:11.8)*z,fm=10.4*z;c.font=(sys||hub?"500 ":"400 ")+fs+'px Plex, sans-serif';var tw=c.measureText(n.l).width;var showm=n.m&&!!n.g&&(cam.z>.68||(NARROW&&cam.z>.4));c.font="400 "+fm+'px Plex, sans-serif';var tm=showm?c.measureText(n.m).width:0;var px=(sys||hub?14:10)*z,w=Math.max(tw,tm)+px*2,h=(showm?(fs+fm+15*z):(sys||hub?33:26)*z);
  c.globalAlpha=al;if(act||hub){c.fillStyle="rgba(124,200,255,.11)";c.beginPath();c.roundRect(p.x-w/2-7,p.y-h/2-7,w+14,h+14,10);c.fill()}
  c.fillStyle=act?"#16202b":hub?"#121a24":"#0c1117";c.strokeStyle=n.k==="code"?"#f0793a":act||hub?"#7cc8ff":sys?"#4b5d70":"#2f3a47";c.lineWidth=act?1.5:1;c.beginPath();c.roundRect(p.x-w/2,p.y-h/2,w,h,6);c.fill();c.stroke();
  c.font=(sys||hub?"500 ":"400 ")+fs+'px Plex, sans-serif';c.fillStyle=n.k==="ext"?"#aab4bf":"#eceef0";c.fillText(n.l,p.x,p.y+(showm?-fm*.62:.5));if(showm){c.font="400 "+fm+'px Plex, sans-serif';c.fillStyle="#9fb2d4";c.fillText(n.m,p.x,p.y+fs*.68)}c.globalAlpha=1});
}
var reduced=matchMedia("(prefers-reduced-motion: reduce)").matches,last=0,running=true;
function loop(ts){if(!running)return;var dt=last?Math.min((ts-last)/16.7,3):1;last=ts;draw(dt);requestAnimationFrame(loop)}
var root=document.documentElement;
var CAM={engine:{x:-60,y:-20,z:1},intake:{x:-800,y:-145,z:1.1},sync:{x:-790,y:190,z:1.15},ledger:{x:10,y:500,z:.86},kiosk:{x:720,y:-60,z:.88},watch:{x:620,y:280,z:1.2},more:{x:-310,y:30,z:1.2},adapt:{x:40,y:1080,z:.54}},CAMN={intake:{x:-800,y:-170,z:1.1},ledger:{x:30,y:520,z:.98},kiosk:{x:760,y:-60,z:.92},more:{x:-280,y:30,z:1.45},adapt:{x:-110,y:1080,z:.74}};
if(!window.gsap||reduced){still=true;root.classList.remove("js");document.fonts.ready.then(function(){layout();cam.y=HOME.y;cam.z=HOME.z;draw(0)});addEventListener("resize",function(){layout();cam.x=HOME.x;cam.y=HOME.y;cam.z=HOME.z;draw(0)});return}
gsap.registerPlugin(ScrollTrigger,SplitText);
document.addEventListener("visibilitychange",function(){running=!document.hidden});
var covered=false;gsap.ticker.add(function(){if(running&&!covered)draw(1)});
LK.forEach(function(k){k.ps.forEach(function(s){var dur=Math.max(2.6,k.r.len/62)*(.85+Math.random()*.35),o=s.t;s.tw=gsap.fromTo(s,{t:0},{t:1+62/k.r.len/.55,duration:dur,ease:"none",repeat:-1}).progress(o)})});
window.siteMap={pulse:function(key){var n=N[key];if(!n)return;LK.forEach(function(k){if(k.a!==n&&k.b!==n&&k.a.g!==key&&k.b.g!==key)return;gsap.killTweensOf(k,"boost");gsap.fromTo(k,{boost:1},{boost:0,duration:2.8,ease:"power2.out"});k.ps.forEach(function(s){if(s.tw)gsap.fromTo(s.tw,{timeScale:2.8},{timeScale:1,duration:2.8,ease:"power2.out",overwrite:true})})})}};
gsap.to("#rail",{scaleX:1,ease:"none",scrollTrigger:{start:0,end:"max",scrub:.2}});
Object.keys(CAM).forEach(function(g){cam.reveal[g]=0});
// One place decides what the map shows, from where the page actually is. Fast scrolling, jumps, deep links and resizing all land in the same state.
function reveal(k){gsap.killTweensOf(cam.reveal);var off={duration:.45,ease:"power2.out"};Object.keys(CAM).forEach(function(g){if(g!==k)off[g]=0});gsap.to(cam.reveal,off);if(k){var on={duration:.9,delay:.3,ease:"power2.out"};on[k]=1;gsap.to(cam.reveal,on)}}
function tweenTo(k){var d=wide?CAM[k]:CAMN[k]||CAM[k];cam.active=k;gsap.to(cam,{x:d.x,y:wide?d.y:d.y+(H*.22)/(d.z*.55),z:wide?d.z*Math.max(.6,Math.min(1,(W-600)/840)):d.z*.55,shift:wide?Math.min(W*.2,300):0,duration:1.25,ease:"power3.inOut",overwrite:true});reveal(k)}
function reset(){cam.active="";gsap.to(cam,{x:HOME.x,y:HOME.y,z:HOME.z,shift:0,duration:1.2,ease:"power3.inOut",overwrite:true});reveal("")}
var chapters=gsap.utils.toArray(".ch"),detail=document.getElementById("detail"),current="";
function chapterNow(){if(detail.getBoundingClientRect().top<=H*.5)return"";var k="",line=H*.62;chapters.forEach(function(s){if(s.getBoundingClientRect().top<=line)k=s.dataset.cam});return k}
function sync(force){var k=chapterNow();if(k===current&&!force)return;current=k;if(k)tweenTo(k);else reset()}
ScrollTrigger.create({start:0,end:"max",onUpdate:function(){sync()},onRefresh:function(){sync()}});
ScrollTrigger.create({trigger:detail,start:"top top",end:"max",onToggle:function(t){covered=t.isActive}});
addEventListener("resize",function(){var was=wide;layout();if(was!==wide)sync(true);else if(!current)gsap.to(cam,{x:HOME.x,y:HOME.y,z:HOME.z,duration:.4,ease:"power2.out",overwrite:true})});
sync();
chapters.forEach(function(s){
 var cd=s.querySelector(".card");gsap.from(cd,{y:34,opacity:0,duration:.8,ease:"expo.out",scrollTrigger:{trigger:cd,start:"top 80%",toggleActions:"play none none reverse"}});
 gsap.from(cd.querySelectorAll("li,.ret div"),{opacity:0,x:-8,duration:.5,stagger:.05,ease:"power2.out",scrollTrigger:{trigger:cd,start:"top 66%",toggleActions:"play none none reverse"}})});
var counts=gsap.utils.toArray("[data-count]").map(function(n){var to=+n.dataset.count,o={v:0};return gsap.to(o,{v:to,duration:1.3,ease:"expo.out",scrollTrigger:{trigger:n,start:"top 92%",once:true},onUpdate:function(){n.textContent=Math.round(o.v).toLocaleString("en-US")}})});
function countsFinal(){counts.forEach(function(t){t.kill()});gsap.utils.toArray("[data-count]").forEach(function(n){n.textContent=(+n.dataset.count).toLocaleString("en-US")})}addEventListener("beforeprint",countsFinal);matchMedia("print").addEventListener("change",function(e){if(e.matches)countsFinal()});
gsap.from(".v",{autoAlpha:0,y:14,duration:.7,stagger:.1,ease:"expo.out",scrollTrigger:{trigger:".value",start:"top 88%",once:true}});
gsap.from("#ladder div",{scaleY:0,duration:.9,stagger:.09,ease:"expo.out",scrollTrigger:{trigger:"#ladder",start:"top 84%",once:true}});
document.fonts.ready.then(function(){gsap.set("[data-h]",{autoAlpha:1});root.classList.remove("js");layout();if(!current){cam.y=HOME.y;cam.z=HOME.z}var sp=new SplitText("h1",{type:"lines",mask:"lines"});gsap.timeline({defaults:{ease:"expo.out"}}).from(sp.lines,{yPercent:112,duration:1.05,stagger:.1}).from(".sub",{autoAlpha:0,y:10,duration:.8},"-=.55");if(!current)gsap.from(cam,{z:HOME.z*.7,duration:2,ease:"expo.out"});gsap.from("#world",{autoAlpha:0,duration:.9});gsap.utils.toArray(".solid h2").forEach(function(h){var s=new SplitText(h,{type:"lines",mask:"lines"});gsap.from(s.lines,{yPercent:110,duration:.9,ease:"expo.out",stagger:.07,scrollTrigger:{trigger:h,start:"top 86%",once:true}})});ScrollTrigger.refresh()});
});
