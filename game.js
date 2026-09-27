(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const rand=(a,b)=>a+Math.random()*(b-a);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;

  const UI={
    score:document.getElementById('score'), combo:document.getElementById('combo'),
    weaponName:document.getElementById('weaponName'), ammoText:document.getElementById('ammoText'),
    ammoTicks:document.getElementById('ammoTicks'), hearts:document.getElementById('hearts'),
    kills:document.getElementById('killCount'), mission:document.getElementById('missionText'),
    chapter:document.getElementById('chapterText'), briefing:document.getElementById('briefingText'),
    banner:document.getElementById('centerBanner'), hit:document.getElementById('hitMarker'),
    damage:document.getElementById('damageVignette'), transition:document.getElementById('railTransition'),
    start:document.getElementById('startScreen'), pause:document.getElementById('pauseScreen'),
    result:document.getElementById('resultScreen')
  };

  const weapons={
    pistol:{name:'半自动手枪',mag:8,reserve:Infinity,damage:36,head:2.4,rate:250,reload:700,spread:.008,auto:false},
    smg:{name:'冲锋枪',mag:30,reserve:180,damage:17,head:1.75,rate:90,reload:1050,spread:.022,auto:true},
    rifle:{name:'半自动步枪',mag:10,reserve:80,damage:45,head:2.2,rate:240,reload:1000,spread:.009,auto:false},
    sniper:{name:'狙击步枪',mag:5,reserve:35,damage:105,head:3.0,rate:700,reload:1200,spread:.002,auto:false},
    lmg:{name:'轻机枪',mag:40,reserve:200,damage:23,head:1.7,rate:105,reload:1350,spread:.025,auto:true},
    hmg:{name:'重机枪',mag:80,reserve:240,damage:30,head:1.6,rate:78,reload:1650,spread:.03,auto:true},
    grenade:{name:'手榴弹',mag:4,reserve:0,damage:135,head:1,rate:900,reload:0,spread:0,auto:false}
  };

  const stages=[
    {
      title:'南京路街口',chapter:'第一章 · 第一战斗点',
      mission:'清除街口敌军',brief:'敌军从商业街正面推进。优先击杀窗口射手，保持街口畅通。',
      spawns:[['grunt',.5,'streetL'],['grunt',.9,'streetR'],['smg',1.4,'windowL'],['grunt',2.0,'streetC'],['officer',2.6,'streetR'],['grunt',3.2,'windowR']]
    },
    {
      title:'石库门巷道',chapter:'第一章 · 第二战斗点',
      mission:'穿过巷道伏击区',brief:'巷道视线狭窄。敌人会从二楼窗口和屋顶突然出现，狙击手必须优先处理。',
      spawns:[['grunt',.4,'alleyL'],['sniper',.9,'roofR'],['smg',1.4,'windowL'],['grunt',1.8,'alleyR'],['sniper',2.3,'roofL'],['officer',3.0,'alleyC'],['smg',3.5,'windowR']]
    },
    {
      title:'桥头火力点',chapter:'第一章 · 第三战斗点',
      mission:'摧毁重机枪阵地',brief:'桥头沙袋后部署了重火力。先压制机枪手，再消灭侧翼增援。',
      spawns:[['gunner',.4,'bunkerL'],['grunt',.9,'streetR'],['smg',1.3,'streetL'],['gunner',2.0,'bunkerR'],['officer',2.5,'streetC'],['sniper',3.0,'roofR'],['grunt',3.4,'streetL']]
    },
    {
      title:'敌军指挥所',chapter:'第一章 · 最终战斗点',
      mission:'击败敌军指挥官',brief:'最后的敌军正在指挥所前集结。击败护卫并消灭指挥官，打通整条路线。',
      spawns:[['grunt',.4,'streetL'],['smg',.8,'windowR'],['officer',1.3,'streetR'],['gunner',1.8,'bunkerL'],['boss',2.5,'streetC']]
    }
  ];

  const archetypes={
    grunt:{hp:66,scale:1,fire:1.55,damage:7,color:'#5e594b',score:100},
    smg:{hp:78,scale:1.0,fire:.94,damage:6,color:'#685348',score:130},
    sniper:{hp:55,scale:.86,fire:2.25,damage:19,color:'#4a5048',score:190},
    gunner:{hp:155,scale:1.12,fire:.58,damage:5,color:'#4f493d',score:240},
    officer:{hp:105,scale:1.05,fire:1.18,damage:10,color:'#443d34',score:270},
    boss:{hp:680,scale:1.34,fire:.46,damage:8,color:'#322d2a',score:2200,boss:true}
  };

  const slots={
    streetL:[270,515],streetC:[640,500],streetR:[1010,515],
    windowL:[300,330],windowR:[980,330],roofL:[350,250],roofR:[930,245],
    alleyL:[400,500],alleyC:[640,485],alleyR:[880,505],
    bunkerL:[430,500],bunkerR:[850,500]
  };

  let state,last=0,mouse={x:W/2,y:H/2,down:false};
  let enemies=[],particles=[],tracers=[],splats=[],explosions=[];
  const skyline=Array.from({length:18},(_,i)=>({x:i*82+rand(-20,20),w:rand(72,128),h:rand(115,230)}));

  function reset(){
    const ammo={}; for(const k in weapons) ammo[k]={mag:weapons[k].mag,reserve:weapons[k].reserve};
    state={running:false,paused:false,ended:false,time:0,health:100,lives:8,score:0,kills:0,headshots:0,shots:0,hits:0,combo:0,bestCombo:0,lastKill:-99,weapon:'pistol',ammo,reloading:false,lastShot:0,stage:0,phase:'intro',nextStageAt:1.4,spawnQueue:[],screenShake:0,muzzle:0,rail:0,railDir:0};
    enemies=[];particles=[];tracers=[];splats=[];explosions=[];updateUI();
  }

  function startGame(){
    reset();state.running=true;UI.start.classList.remove('show');UI.result.classList.remove('show');showStageIntro(0);
  }

  function showStageIntro(i){
    const s=stages[i]; UI.chapter.textContent=s.chapter;UI.mission.textContent=s.mission;UI.briefing.textContent=s.brief;
    showBanner(s.chapter,s.title,1500);
  }

  function beginStage(i){
    const s=stages[i];state.phase='active';state.spawnQueue=s.spawns.map(x=>x.slice());
    for(const item of s.spawns){
      const [type,delay,slot]=item;
      setTimeout(()=>{
        if(state.running&&!state.ended&&state.phase==='active'){spawnEnemy(type,slot);state.spawnQueue.shift();}
      },delay*1000);
    }
  }

  function advanceRail(){
    state.phase='rail';state.rail=0;state.railDir=1;UI.transition.classList.add('show');
    setTimeout(()=>{
      state.stage++;showStageIntro(state.stage);state.phase='intro';state.nextStageAt=state.time+1.25;UI.transition.classList.remove('show');
    },1200);
  }

  function spawnEnemy(type,slotName){
    const a=archetypes[type], base=slots[slotName]||slots.streetC, isElevated=slotName.includes('window')||slotName.includes('roof');
    enemies.push({
      type,slot:slotName,x:base[0]+rand(-26,26),y:base[1]+rand(-10,10),baseX:base[0],baseY:base[1],
      hp:a.hp,maxHp:a.hp,scale:a.scale,fireEvery:a.fire,damage:a.damage,color:a.color,score:a.score,boss:!!a.boss,
      t:0,nextFire:rand(.65,1.45),dead:false,hitFlash:0,stagger:0,headR:(isElevated?12:17)*a.scale,bodyW:38*a.scale,bodyH:78*a.scale,
      elevated:isElevated
    });
  }

  function update(dt){
    if(!state.running||state.paused||state.ended)return;
    state.time+=dt;state.screenShake=Math.max(0,state.screenShake-dt*11);state.muzzle=Math.max(0,state.muzzle-dt*13);
    if(state.combo>0&&state.time-state.lastKill>2.2){state.combo=0;updateUI();}
    if(state.phase==='intro'&&state.time>=state.nextStageAt)beginStage(state.stage);
    if(state.phase==='rail')state.rail=Math.min(1,state.rail+dt*.8);

    for(const e of enemies){
      if(e.dead)continue;
      e.t+=dt;e.hitFlash=Math.max(0,e.hitFlash-dt*8);e.stagger=Math.max(0,e.stagger-dt*5);
      const sway=e.boss?Math.sin(e.t*1.6)*55:Math.sin(e.t*(1.2+(e.type==='smg' ? .5 : 0)))*14;
      e.x=e.baseX+sway;e.y=e.baseY+Math.sin(e.t*1.7)*4;
      e.nextFire-=dt;
      if(e.nextFire<=0){enemyFire(e);const boost=enemies.some(x=>!x.dead&&x.type==='officer') ? .84 : 1;e.nextFire=e.fireEvery*boost*rand(.85,1.2);}
    }

    particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.g*dt;});
    particles=particles.filter(p=>p.life>0);tracers.forEach(t=>t.life-=dt);tracers=tracers.filter(t=>t.life>0);
    explosions.forEach(e=>e.life-=dt);explosions=explosions.filter(e=>e.life>0);splats.forEach(s=>s.life-=dt*.025);splats=splats.filter(s=>s.life>0);

    if(state.phase==='active'&&!enemies.some(e=>!e.dead)&&state.spawnQueue.length===0){
      if(state.stage>=stages.length-1)finishGame(true);else advanceRail();
    }
  }

  function enemyFire(e){
    if(state.paused||state.ended)return;
    const missChance=e.type==='sniper' ? .27 : e.boss ? .2 : .43;
    const miss=Math.random()<missChance;
    const tx=miss?rand(80,W-80):W/2+rand(-40,40),ty=miss?rand(120,H-150):H/2+rand(-30,30);
    tracers.push({x1:e.x,y1:e.y-e.bodyH*.58,x2:tx,y2:ty,life:.12,enemy:true});
    if(!miss)damagePlayer(e.damage);
  }

  function damagePlayer(n){
    state.health=clamp(state.health-n,0,100);state.lives=Math.ceil(state.health/12.5);state.screenShake=Math.min(8,state.screenShake+3);
    UI.damage.classList.add('show');setTimeout(()=>UI.damage.classList.remove('show'),110);updateUI();if(state.health<=0)finishGame(false);
  }

  function shoot(){
    if(!state.running||state.paused||state.ended||state.reloading||state.phase==='rail')return;
    const w=weapons[state.weapon],a=state.ammo[state.weapon],now=performance.now();
    if(now-state.lastShot<w.rate)return;state.lastShot=now;
    if(state.weapon==='grenade'){if(a.mag<=0)return;a.mag--;state.shots++;throwGrenade(mouse.x,mouse.y);updateUI();return;}
    if(a.mag<=0){reload();return;}
    a.mag--;state.shots++;state.muzzle=1;state.screenShake=Math.min(5,state.screenShake+1.1);
    const sx=mouse.x+rand(-w.spread*W,w.spread*W),sy=mouse.y+rand(-w.spread*H,w.spread*H);
    tracers.push({x1:W/2,y1:H*.92,x2:sx,y2:sy,life:.07,enemy:false});
    const hit=findHit(sx,sy);
    if(hit){
      const mult=hit.zone==='head'?w.head:(hit.zone==='leg' ? .72 : 1);const e=hit.enemy;e.hp-=w.damage*mult;e.hitFlash=1;e.stagger=.4;state.hits++;hitMarker(hit.zone==='head');impactFx(sx,sy,hit.zone==='head');
      if(e.hp<=0)killEnemy(e,hit.zone==='head');
    }else sparkFx(sx,sy);
    updateUI();if(a.mag<=0&&a.reserve>0)setTimeout(reload,160);
  }

  function findHit(x,y){
    let best=null,d=1e9;
    for(const e of enemies){
      if(e.dead)continue;
      const hx=e.x,hy=e.y-e.bodyH*.73,hd=Math.hypot(x-hx,y-hy);
      if(hd<e.headR*1.35&&hd<d){best={enemy:e,zone:'head'};d=hd;}
      const bw=e.bodyW*.74;
      if(x>e.x-bw&&x<e.x+bw&&y>e.y-e.bodyH*.67&&y<e.y-e.bodyH*.18){const nd=Math.hypot(x-e.x,y-(e.y-e.bodyH*.45));if(nd<d){best={enemy:e,zone:'body'};d=nd;}}
      if(x>e.x-bw*.8&&x<e.x+bw*.8&&y>=e.y-e.bodyH*.18&&y<e.y+15){const nd=Math.hypot(x-e.x,y-e.y);if(nd<d){best={enemy:e,zone:'leg'};d=nd;}}
    }
    return best;
  }

  function killEnemy(e,head){
    e.dead=true;state.kills++;if(head)state.headshots++;state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);state.lastKill=state.time;
    const chain=1+Math.min(4,Math.floor(state.combo/5))*.5;state.score+=Math.round(e.score*(head?1.65:1)*chain);
    for(let i=0;i<18;i++)particles.push({x:e.x,y:e.y-e.bodyH*.45,vx:rand(-120,120),vy:rand(-135,25),g:220,life:rand(.25,.75),c:head?'#8a2119':'#57241d',r:rand(1,4)});
    if(e.boss){explosions.push({x:e.x,y:e.y-35,r:110,life:.75,blast:true});state.score+=1800;}updateUI();
  }

  function throwGrenade(x,y){
    explosions.push({x,y,r:20,life:.75});
    setTimeout(()=>{if(state.ended)return;explosions.push({x,y,r:150,life:.55,blast:true});state.screenShake=9;
      for(const e of enemies){if(e.dead)continue;const dist=Math.hypot(e.x-x,(e.y-e.bodyH*.4)-y);if(dist<185){e.hp-=weapons.grenade.damage*(1-dist/240);e.hitFlash=1;state.hits++;if(e.hp<=0)killEnemy(e,false);}}
    },400);
  }

  function reload(){
    const w=weapons[state.weapon],a=state.ammo[state.weapon];if(state.weapon==='grenade'||state.reloading||a.mag>=w.mag||a.reserve<=0)return;
    state.reloading=true;updateUI();setTimeout(()=>{if(!state.reloading)return;const need=w.mag-a.mag,take=a.reserve===Infinity?need:Math.min(need,a.reserve);a.mag+=take;if(a.reserve!==Infinity)a.reserve-=take;state.reloading=false;updateUI();},w.reload);
  }

  function selectWeapon(k){
    if(!weapons[k])return;state.weapon=k;state.reloading=false;document.querySelectorAll('.weapon-rack button').forEach(b=>b.classList.toggle('active',b.dataset.weapon===k));updateUI();
  }

  function updateUI(){
    if(!state)return;
    UI.score.textContent=String(state.score).padStart(6,'0');UI.combo.textContent=state.combo;UI.kills.textContent=state.kills;
    UI.hearts.innerHTML=Array.from({length:8},(_,i)=>'<span class="heart '+(i<state.lives?'':'empty')+'">♥</span>').join('');
    const w=weapons[state.weapon],a=state.ammo[state.weapon];UI.weaponName.textContent=state.reloading?'装填中…':w.name;
    UI.ammoText.textContent=state.weapon==='grenade'?String(a.mag):`${a.mag} / ${a.reserve===Infinity?'∞':a.reserve}`;
    UI.ammoTicks.innerHTML=Array.from({length:Math.min(w.mag,20)},(_,i)=>'<i class="'+(i<Math.ceil(a.mag/Math.max(1,w.mag/20))?'':'empty')+'"></i>').join('');
  }

  function hitMarker(head){UI.hit.textContent=head?'✦':'×';UI.hit.style.color=head?'#ffe163':'#f0f0e8';UI.hit.classList.remove('show');void UI.hit.offsetWidth;UI.hit.classList.add('show');}
  function impactFx(x,y,head){splats.push({x,y,r:head?rand(8,17):rand(4,9),life:1,c:head?'#6f1712':'#50201a'});for(let i=0;i<(head?9:5);i++)particles.push({x,y,vx:rand(-90,90),vy:rand(-80,40),g:180,life:rand(.2,.5),c:'#7d2019',r:rand(1,3)});}
  function sparkFx(x,y){for(let i=0;i<4;i++)particles.push({x,y,vx:rand(-70,70),vy:rand(-90,10),g:180,life:rand(.12,.3),c:'#e8c56e',r:1.5});}

  function draw(){
    const shake=state?.screenShake||0,ox=rand(-shake,shake),oy=rand(-shake,shake);
    ctx.save();ctx.translate(ox,oy);drawScene(state?.stage||0,state?.rail||0);
    splats.forEach(s=>{ctx.globalAlpha=.3*s.life;ctx.fillStyle=s.c;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;});
    enemies.filter(e=>!e.dead).sort((a,b)=>a.y-b.y).forEach(drawEnemy);explosions.forEach(drawExplosion);tracers.forEach(drawTracer);
    particles.forEach(p=>{ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();});drawWeapon();drawCrosshair();ctx.restore();
  }

  function drawScene(stage,rail){
    const scene=clamp(stage+rail,0,3);const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#6d6b61');sky.addColorStop(.55,'#898473');sky.addColorStop(1,'#403c32');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(230,215,178,.12)';ctx.beginPath();ctx.arc(1030,110,52,0,Math.PI*2);ctx.fill();
    const shift=-scene*72;
    skyline.forEach((b,i)=>{const x=b.x+shift;const y=345-b.h;ctx.fillStyle=i%3===0?'#47473f':'#535047';ctx.fillRect(x,y,b.w,b.h);ctx.fillStyle='#343530';ctx.fillRect(x-5,y-8,b.w+10,10);
      for(let wx=x+14;wx<x+b.w-10;wx+=27)for(let wy=y+28;wy<335;wy+=31){ctx.fillStyle=((wx+wy+i*13)%91)<7?'#b19a62':'#2f312d';ctx.fillRect(wx,wy,10,14);}
    });
    ctx.fillStyle='#292a25';ctx.fillRect(0,338,W,32);
    if(stage===0)drawNanjing();else if(stage===1)drawAlley();else if(stage===2)drawBridge();else drawHQ();
  }

  function drawRoad(){ctx.fillStyle='#504a40';ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(250,420);ctx.lineTo(1030,420);ctx.lineTo(W,H);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(213,195,150,.25)';ctx.lineWidth=2;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(420+i*110,H);ctx.lineTo(520+i*60,420);ctx.stroke();}}
  function drawNanjing(){drawRoad();shop(85,360,210,'南京路商行');shop(985,372,190,'华丰百货');ctx.fillStyle='#706046';ctx.fillRect(600,332,125,20);ctx.fillStyle='#a92d23';ctx.fillRect(610,335,105,14);ctx.fillStyle='#f0dca0';ctx.font='700 11px serif';ctx.fillText('大上海百货',635,346);}
  function drawAlley(){ctx.fillStyle='#4d473d';ctx.fillRect(0,420,W,300);ctx.fillStyle='#2a2924';ctx.fillRect(150,345,285,230);ctx.fillRect(845,335,285,240);ctx.fillStyle='#151713';for(const x of [230,320,930,1020]){ctx.fillRect(x,375,45,62);ctx.fillStyle='#34342d';ctx.fillRect(x+4,380,37,53);ctx.fillStyle='#151713';}ctx.fillStyle='#7e2d23';ctx.fillRect(502,360,130,22);ctx.fillStyle='#e0c58c';ctx.font='700 12px serif';ctx.fillText('石库门里弄',535,376);}
  function drawBridge(){drawRoad();ctx.fillStyle='#363832';ctx.fillRect(0,395,W,34);ctx.strokeStyle='#282b29';ctx.lineWidth=8;for(let x=120;x<W;x+=170){ctx.beginPath();ctx.moveTo(x,325);ctx.lineTo(x+110,540);ctx.stroke();ctx.beginPath();ctx.moveTo(x+110,325);ctx.lineTo(x,540);ctx.stroke();}sandbags(350,455,220);sandbags(750,455,220);ctx.fillStyle='#5c5b50';ctx.fillRect(560,400,160,90);ctx.fillStyle='#2a2c29';ctx.fillRect(582,385,80,35);}
  function drawHQ(){drawRoad();ctx.fillStyle='#47463f';ctx.fillRect(375,270,530,245);ctx.fillStyle='#2c2d29';ctx.fillRect(560,355,150,160);for(let x=420;x<850;x+=110){ctx.fillStyle='#252724';ctx.fillRect(x,310,48,60);}ctx.fillStyle='#84241e';ctx.fillRect(500,286,280,24);ctx.fillStyle='#e3cf94';ctx.font='700 13px serif';ctx.fillText('军事管制区域',598,303);sandbags(340,475,200);sandbags(760,475,200);}
  function shop(x,y,w,label){ctx.fillStyle='#30312c';ctx.fillRect(x,y,w,105);ctx.fillStyle='#171813';ctx.fillRect(x+16,y+28,w-32,77);ctx.fillStyle='#962921';ctx.fillRect(x+8,y-18,w-16,25);ctx.fillStyle='#ead79d';ctx.font='700 13px serif';ctx.fillText(label,x+45,y);}
  function sandbags(x,y,w){ctx.fillStyle='#6b6654';for(let row=0;row<2;row++)for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(x+i*(w/5)+22+(row?14:0),y-row*17,34,14,0,0,Math.PI*2);ctx.fill();}}

  function drawEnemy(e){
    const s=e.scale,flash=e.hitFlash>0;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.stagger?Math.sin(e.t*35)*.035:0);
    if(e.boss){ctx.fillStyle='rgba(140,20,15,.17)';ctx.beginPath();ctx.arc(0,-60,60,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1f1d19';ctx.fillRect(-68,-132,136,8);ctx.fillStyle='#a4382f';ctx.fillRect(-68,-132,136*(e.hp/e.maxHp),8);}
    if(e.slot.includes('bunker')){ctx.fillStyle='#706b58';ctx.beginPath();ctx.ellipse(0,-5,58,22,0,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=flash?'#d8c9a7':e.color;ctx.fillRect(-e.bodyW*.43,-e.bodyH,e.bodyW*.86,e.bodyH*.72);ctx.fillStyle=flash?'#eddfbd':'#b5a88d';ctx.beginPath();ctx.arc(0,-e.bodyH*.73,e.headR,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#292822';ctx.fillRect(-e.bodyW*.34,-e.bodyH*.95,e.bodyW*.68,7*s);ctx.strokeStyle='#24231f';ctx.lineWidth=8*s;ctx.beginPath();ctx.moveTo(-8,-e.bodyH*.27);ctx.lineTo(-16,8);ctx.moveTo(8,-e.bodyH*.27);ctx.lineTo(17,8);ctx.stroke();
    ctx.strokeStyle='#252521';ctx.lineWidth=5*s;ctx.beginPath();ctx.moveTo(-e.bodyW*.2,-e.bodyH*.62);ctx.lineTo(-36,-e.bodyH*.47);ctx.moveTo(e.bodyW*.2,-e.bodyH*.62);ctx.lineTo(35,-e.bodyH*.49);ctx.stroke();ctx.strokeStyle='#141512';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(25,-e.bodyH*.49);ctx.lineTo(60,-e.bodyH*.57);ctx.stroke();
    if(e.type==='officer'||e.boss){ctx.fillStyle='#8a2b22';ctx.fillRect(-15,-e.bodyH*.5,30,5);}ctx.restore();
  }

  function drawExplosion(e){const p=1-e.life/.75,r=e.blast?e.r*(.45+p*.65):20+p*e.r;const g=ctx.createRadialGradient(e.x,e.y,2,e.x,e.y,r);g.addColorStop(0,'rgba(255,247,192,.96)');g.addColorStop(.3,'rgba(255,145,45,.8)');g.addColorStop(1,'rgba(55,25,10,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.fill();}
  function drawTracer(t){ctx.globalAlpha=clamp(t.life/.12,0,1);ctx.strokeStyle=t.enemy?'#efab58':'#ffe896';ctx.lineWidth=t.enemy?2:3;ctx.beginPath();ctx.moveTo(t.x1,t.y1);ctx.lineTo(t.x2,t.y2);ctx.stroke();ctx.globalAlpha=1;}

  function drawWeapon(){
    if(!state)return;const r=state.muzzle*16;ctx.save();ctx.translate(W/2,H+r);
    const k=state.weapon;
    if(k==='pistol'){ctx.fillStyle='#252622';ctx.fillRect(-30,-108,60,95);ctx.fillStyle='#484942';ctx.fillRect(-35,-125,70,24);}
    if(k==='smg'){ctx.fillStyle='#3f3428';ctx.fillRect(-50,-96,100,70);ctx.fillStyle='#242520';ctx.fillRect(-43,-126,86,34);ctx.fillRect(22,-130,98,11);}
    if(k==='rifle'||k==='sniper'){ctx.fillStyle='#4c3c29';ctx.fillRect(-34,-88,68,66);ctx.fillStyle='#22231f';ctx.fillRect(-23,-116,46,23);ctx.fillRect(15,-120,155,9);if(k==='sniper'){ctx.fillRect(-9,-138,55,8);ctx.beginPath();ctx.arc(14,-135,10,0,Math.PI*2);ctx.fill();}}
    if(k==='lmg'||k==='hmg'){ctx.fillStyle='#383126';ctx.fillRect(-55,-96,110,70);ctx.fillStyle='#20211e';ctx.fillRect(-50,-126,100,34);ctx.fillRect(30,-130,145,13);if(k==='hmg'){ctx.fillRect(-70,-112,30,52);}}
    if(k==='grenade'){ctx.fillStyle='#3d4935';ctx.beginPath();ctx.ellipse(0,-72,34,48,0,0,Math.PI*2);ctx.fill();}
    if(state.muzzle>0&&k!=='grenade'){ctx.fillStyle='rgba(255,220,104,.86)';ctx.beginPath();ctx.moveTo(-14,-132);ctx.lineTo(0,-190-rand(0,18));ctx.lineTo(14,-132);ctx.fill();}ctx.restore();
  }

  function drawCrosshair(){
    const x=mouse.x,y=mouse.y;ctx.strokeStyle='#27ff49';ctx.fillStyle='#27ff49';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x-22,y);ctx.lineTo(x-7,y);ctx.moveTo(x+7,y);ctx.lineTo(x+22,y);ctx.moveTo(x,y-22);ctx.lineTo(x,y-7);ctx.moveTo(x,y+7);ctx.lineTo(x,y+22);ctx.stroke();ctx.fillRect(x-1,y-1,3,3);
  }

  function showBanner(a,b,ms){UI.banner.querySelector('span').textContent=a;UI.banner.querySelector('strong').textContent=b;UI.banner.classList.add('show');setTimeout(()=>UI.banner.classList.remove('show'),ms);}
  function finishGame(win){
    state.ended=true;state.running=false;const acc=state.shots?Math.round(state.hits/state.shots*100):0,secs=Math.floor(state.time),min=String(Math.floor(secs/60)).padStart(2,'0'),sec=String(secs%60).padStart(2,'0');
    const perf=state.score+state.headshots*100+acc*42+state.bestCombo*55+(win?2500:0);let grade=perf>10500?'S':perf>7600?'A':perf>5200?'B':'C';
    document.getElementById('resultTitle').textContent=win?'路线已打通':'任务失败';document.getElementById('grade').textContent=win?grade:'D';document.getElementById('rKills').textContent=state.kills;document.getElementById('rHeadshots').textContent=state.headshots;document.getElementById('rAccuracy').textContent=acc+'%';document.getElementById('rCombo').textContent=state.bestCombo;document.getElementById('rScore').textContent=state.score.toLocaleString('zh-CN');document.getElementById('rTime').textContent=`${min}:${sec}`;UI.result.classList.add('show');
  }

  function togglePause(force){if(!state.running||state.ended)return;state.paused=typeof force==='boolean'?force:!state.paused;UI.pause.classList.toggle('show',state.paused);}

  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*W;mouse.y=(e.clientY-r.top)/r.height*H;});
  canvas.addEventListener('pointerdown',e=>{if(e.button===0){mouse.down=true;shoot();}});window.addEventListener('pointerup',()=>mouse.down=false);
  window.addEventListener('keydown',e=>{if(e.key==='Escape')togglePause();if(e.key.toLowerCase()==='r'||e.code==='Space')reload();const keys={1:'pistol',2:'smg',3:'rifle',4:'sniper',5:'lmg',6:'hmg',7:'grenade'};if(keys[e.key])selectWeapon(keys[e.key]);});
  document.getElementById('startBtn').onclick=startGame;document.getElementById('restartBtn').onclick=startGame;document.getElementById('playAgainBtn').onclick=startGame;document.getElementById('pauseBtn').onclick=()=>togglePause();document.getElementById('resumeBtn').onclick=()=>togglePause(false);document.querySelectorAll('.weapon-rack button').forEach(b=>b.onclick=()=>selectWeapon(b.dataset.weapon));

  function loop(ts){const dt=Math.min(.033,(ts-last)/1000||0);last=ts;if(state?.running&&!state.paused&&mouse.down&&weapons[state.weapon].auto)shoot();update(dt);draw();requestAnimationFrame(loop);}
  reset();requestAnimationFrame(loop);
})();