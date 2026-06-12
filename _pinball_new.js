function _pinballInit(){
  var cv = document.getElementById('pinball-canvas');
  var stage = document.getElementById('stage');
  var W = stage.clientWidth - 40;
  var H = stage.clientHeight - 20;
  if(W < 200){ W = 500; } if(H < 200){ H = 500; }
  cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d');

  var N = entries.length;
  var BALL_R = Math.max(10, Math.min(24, Math.floor((W - 20) / Math.max(N * 2, 1))));

  var BANNER = 50;
  var PIN_AREA_TOP = BANNER + 10;
  var FUNNEL_TOP = H * 0.58;
  var FUNNEL_BOT = H - 70;
  var EXIT_W = Math.max(BALL_R * 2.8, drawCount * BALL_R * 2.8);
  var EXIT_L = W/2 - EXIT_W/2;
  var EXIT_R = W/2 + EXIT_W/2;
  var WALL_L = 10;
  var WALL_R = W - 10;

  var PIN_R = 5;
  var ROWS = 7;
  var pins = [];
  for(var r = 0; r < ROWS; r++){
    var cols = r + 3;
    var span = W * 0.74;
    var x0 = (W - span) / 2 + (r % 2 === 0 ? 0 : span / (cols * 2));
    var gap = span / Math.max(cols - 1, 1);
    var py = PIN_AREA_TOP + (r + 0.5) * ((FUNNEL_TOP - PIN_AREA_TOP) / ROWS);
    for(var c = 0; c < cols; c++){
      pins.push({ x: x0 + c * gap, y: py });
    }
  }

  var bumpers = [
    { x: W * 0.28, y: PIN_AREA_TOP + (FUNNEL_TOP - PIN_AREA_TOP) * 0.45, r: 14, f: 0 },
    { x: W * 0.72, y: PIN_AREA_TOP + (FUNNEL_TOP - PIN_AREA_TOP) * 0.45, r: 14, f: 0 }
  ];

  var BALL_COLORS = [
    ['#f8b865','#e07b2a','#8a3c08'],
    ['#6db8f7','#2a75e0','#083c8a'],
    ['#7df87c','#2ae040','#086e08'],
    ['#f87c9e','#e02a5a','#8a0828'],
    ['#c47df8','#8b2ae0','#44088a'],
    ['#f8e07c','#e0c02a','#8a6c08'],
    ['#f8a07c','#e0602a','#8a2c08'],
    ['#7cf8e0','#2ae0c0','#08706a']
  ];

  // 이름 순서를 매번 무작위로 섞어 시작 위치 랜덤화
  var balls = shuffle(entries.map(function(name, i){
    return { name: name, colorSet: BALL_COLORS[i % BALL_COLORS.length] };
  }));
  balls = balls.map(function(b, i){
    var startX = N > 1
      ? WALL_L + BALL_R + (i / (N - 1)) * (W - WALL_L * 2 - BALL_R * 2)
      : W / 2;
    startX = Math.max(WALL_L + BALL_R, Math.min(WALL_R - BALL_R, startX));
    return {
      name: b.name,
      x: startX + (Math.random() - 0.5) * BALL_R * 2,
      y: BANNER + BALL_R + 2 + i * Math.min(BALL_R * 0.3, 10),
      vx: (Math.random() - 0.5) * 2,
      vy: 0,
      spin: Math.random() * Math.PI * 2,
      trail: [],
      won: false,
      sunk: false,
      sunkTick: 0,
      colorSet: b.colorSet
    };
  });

  var winners = [];
  var done = false;
  var tick = 0;

  function drawPaw(x,y,r,name,spin,cs,won){
    ctx.save(); ctx.translate(x,y);
    ctx.shadowColor = won ? 'rgba(255,220,50,0.9)' : 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = won ? 22 : 10;
    var g = ctx.createRadialGradient(-r*0.15,-r*0.18,0,0,0,r);
    g.addColorStop(0,cs[0]); g.addColorStop(0.5,cs[1]); g.addColorStop(1,cs[2]);
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='rgba(255,220,130,0.5)'; ctx.lineWidth=1.8; ctx.stroke();
    var tr=r*0.37;
    var toes=[{a:-.72,d:r*1.08},{a:-.24,d:r*1.14},{a:.24,d:r*1.14},{a:.72,d:r*1.08}];
    for(var ti=0;ti<toes.length;ti++){
      var tx=Math.sin(toes[ti].a)*toes[ti].d, ty=-Math.cos(toes[ti].a)*toes[ti].d;
      var tg=ctx.createRadialGradient(tx-tr*0.2,ty-tr*0.2,0,tx,ty,tr);
      tg.addColorStop(0,cs[0]); tg.addColorStop(1,cs[2]);
      ctx.beginPath(); ctx.arc(tx,ty,tr,0,Math.PI*2); ctx.fillStyle=tg; ctx.fill();
      ctx.strokeStyle='rgba(255,210,120,0.35)'; ctx.lineWidth=1; ctx.stroke();
    }
    ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(-r*0.22,-r*0.26,r*0.28,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fill();
    ctx.rotate(spin);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    var fs=Math.min(13,Math.max(6,Math.floor(r*1.4/Math.max(name.length,1))));
    ctx.font='bold '+fs+'px Segoe UI';
    ctx.fillStyle='rgba(30,10,2,0.92)';
    if(name.length<=4){ ctx.fillText(name,0,0); }
    else { var h2=Math.ceil(name.length/2),lh=fs+2; ctx.fillText(name.slice(0,h2),0,-lh/2); ctx.fillText(name.slice(h2),0,lh/2); }
    ctx.restore();
  }

  function funnelCollide(ball){
    if(ball.y < FUNNEL_TOP) return;
    var prog=Math.min((ball.y-FUNNEL_TOP)/Math.max(FUNNEL_BOT-FUNNEL_TOP,1),1);
    var lx=(W/2-W*0.44)+(EXIT_L-(W/2-W*0.44))*prog;
    var rx=(W/2+W*0.44)+(EXIT_R-(W/2+W*0.44))*prog;
    if(ball.x-BALL_R<lx){ ball.x=lx+BALL_R; ball.vx=Math.abs(ball.vx)*0.7+0.5; }
    if(ball.x+BALL_R>rx){ ball.x=rx-BALL_R; ball.vx=-(Math.abs(ball.vx)*0.7+0.5); }
  }

  function ballBallCollide(){
    for(var i=0;i<balls.length;i++){
      if(balls[i].sunk) continue;
      for(var j=i+1;j<balls.length;j++){
        if(balls[j].sunk) continue;
        var dx=balls[j].x-balls[i].x, dy=balls[j].y-balls[i].y;
        var dist=Math.sqrt(dx*dx+dy*dy);
        var minD=BALL_R*2;
        if(dist<minD&&dist>0.01){
          var nx=dx/dist, ny=dy/dist;
          var ov=minD-dist;
          balls[i].x-=nx*ov*0.5; balls[i].y-=ny*ov*0.5;
          balls[j].x+=nx*ov*0.5; balls[j].y+=ny*ov*0.5;
          var dvx=balls[j].vx-balls[i].vx, dvy=balls[j].vy-balls[i].vy;
          var dot=dvx*nx+dvy*ny;
          if(dot<0){
            var imp=dot*0.8;
            balls[i].vx+=imp*nx; balls[i].vy+=imp*ny;
            balls[j].vx-=imp*nx; balls[j].vy-=imp*ny;
          }
        }
      }
    }
  }

  function frame(){
    if(done) return;
    tick++;
    ctx.clearRect(0,0,W,H);

    var bgGrad=ctx.createLinearGradient(0,0,0,H);
    bgGrad.addColorStop(0,'#1c1208'); bgGrad.addColorStop(1,'#100b03');
    ctx.fillStyle=bgGrad; ctx.fillRect(0,0,W,H);

    ctx.fillStyle='rgba(28,18,6,0.88)'; ctx.fillRect(0,0,W,BANNER);
    ctx.strokeStyle='rgba(210,160,80,0.2)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,BANNER); ctx.lineTo(W,BANNER); ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if(winners.length>0){
      ctx.fillStyle='rgba(245,192,106,0.95)'; ctx.font='bold 14px Segoe UI';
      ctx.fillText('🐾 당첨: '+winners.join(', '), W/2, BANNER/2);
    } else {
      ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.font='13px Segoe UI';
      ctx.fillText('🐾 핑볼 추첨 진행 중… ('+drawCount+'명 당첨)', W/2, BANNER/2);
    }

    ctx.fillStyle='rgba(210,160,80,0.06)';
    ctx.fillRect(0,BANNER,WALL_L,H); ctx.fillRect(W-WALL_L,BANNER,WALL_L,H);

    for(var pi=0;pi<pins.length;pi++){
      var p=pins[pi];
      var pg=ctx.createRadialGradient(p.x-1,p.y-1.5,0,p.x,p.y,PIN_R);
      pg.addColorStop(0,'rgba(255,235,160,0.95)'); pg.addColorStop(1,'rgba(140,85,20,0.8)');
      ctx.beginPath(); ctx.arc(p.x,p.y,PIN_R,0,Math.PI*2); ctx.fillStyle=pg; ctx.fill();
    }

    for(var bi=0;bi<bumpers.length;bi++){
      var bmp=bumpers[bi]; var fl=bmp.f>0;
      var bg2=ctx.createRadialGradient(bmp.x,bmp.y,0,bmp.x,bmp.y,bmp.r);
      bg2.addColorStop(0,fl?'rgba(255,220,50,1)':'rgba(220,130,30,0.9)');
      bg2.addColorStop(1,fl?'rgba(255,60,0,0.9)':'rgba(130,50,5,0.6)');
      ctx.beginPath(); ctx.arc(bmp.x,bmp.y,bmp.r,0,Math.PI*2); ctx.fillStyle=bg2; ctx.fill();
      ctx.strokeStyle=fl?'#ffd166':'rgba(245,192,106,0.5)'; ctx.lineWidth=2; ctx.stroke();
      if(fl){ ctx.beginPath(); ctx.arc(bmp.x,bmp.y,bmp.r+6,0,Math.PI*2); ctx.strokeStyle='rgba(255,200,50,0.25)'; ctx.lineWidth=4; ctx.stroke(); }
      ctx.fillStyle='#fff'; ctx.font='bold 9px Segoe UI'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('★',bmp.x,bmp.y); if(bmp.f>0) bmp.f--;
    }

    var ftL=W/2-W*0.44, ftR=W/2+W*0.44;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ftL,FUNNEL_TOP); ctx.lineTo(ftR,FUNNEL_TOP);
    ctx.lineTo(EXIT_R,FUNNEL_BOT); ctx.lineTo(EXIT_L,FUNNEL_BOT); ctx.closePath();
    var funnelGrad=ctx.createLinearGradient(W/2,FUNNEL_TOP,W/2,FUNNEL_BOT);
    funnelGrad.addColorStop(0,'rgba(55,35,10,0.45)'); funnelGrad.addColorStop(1,'rgba(70,44,14,0.28)');
    ctx.fillStyle=funnelGrad; ctx.fill();
    ctx.strokeStyle='rgba(210,160,80,0.55)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(ftL,FUNNEL_TOP); ctx.lineTo(EXIT_L,FUNNEL_BOT); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ftR,FUNNEL_TOP); ctx.lineTo(EXIT_R,FUNNEL_BOT); ctx.stroke();
    ctx.strokeStyle='rgba(245,192,106,0.65)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(EXIT_L,FUNNEL_BOT); ctx.lineTo(EXIT_L,H-22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(EXIT_R,FUNNEL_BOT); ctx.lineTo(EXIT_R,H-22); ctx.stroke();
    var exitGlow=ctx.createLinearGradient(EXIT_L,0,EXIT_R,0);
    exitGlow.addColorStop(0,'rgba(245,192,106,0)'); exitGlow.addColorStop(0.5,'rgba(245,192,106,0.5)'); exitGlow.addColorStop(1,'rgba(245,192,106,0)');
    ctx.fillStyle=exitGlow; ctx.fillRect(EXIT_L,H-30,EXIT_W,12);
    ctx.restore();
    ctx.fillStyle='rgba(245,192,106,0.85)'; ctx.font='bold 11px Segoe UI';
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillText('🐾 당첨 출구', W/2, H-6);

    ballBallCollide();

    for(var i=0;i<balls.length;i++){
      var ball=balls[i];
      if(ball.sunk){ ball.sunkTick++; ball.y+=2; ball.spin+=0.04; continue; }

      ball.vy+=0.15; ball.vx*=0.998;
      ball.x+=ball.vx; ball.y+=ball.vy; ball.spin+=0.04;

      if(ball.x-BALL_R<WALL_L){ ball.x=WALL_L+BALL_R; ball.vx=Math.abs(ball.vx)*0.7; }
      if(ball.x+BALL_R>WALL_R){ ball.x=WALL_R-BALL_R; ball.vx=-Math.abs(ball.vx)*0.7; }
      if(ball.y-BALL_R<BANNER){ ball.y=BANNER+BALL_R; ball.vy=Math.abs(ball.vy)*0.4; }

      for(var pi2=0;pi2<pins.length;pi2++){
        var pp=pins[pi2];
        var dx=ball.x-pp.x, dy=ball.y-pp.y;
        var dd=Math.sqrt(dx*dx+dy*dy);
        if(dd<BALL_R+PIN_R+0.5&&dd>0.01){
          var nx=dx/dd, ny=dy/dd;
          var spd=Math.sqrt(ball.vx*ball.vx+ball.vy*ball.vy);
          var side=Math.random()>0.5?1:-1;
          ball.vx=nx*spd*0.3+side*spd*0.9;
          ball.vy=Math.abs(ny*spd)*0.5+0.8;
          ball.x=pp.x+nx*(BALL_R+PIN_R+2); ball.y=pp.y+ny*(BALL_R+PIN_R+2);
        }
      }

      for(var bi2=0;bi2<bumpers.length;bi2++){
        var bb=bumpers[bi2];
        var dx2=ball.x-bb.x, dy2=ball.y-bb.y;
        var dd2=Math.sqrt(dx2*dx2+dy2*dy2);
        if(dd2<BALL_R+bb.r+0.5&&dd2>0.01){
          var nx2=dx2/dd2, ny2=dy2/dd2;
          var spd2=Math.sqrt(ball.vx*ball.vx+ball.vy*ball.vy);
          ball.vx=nx2*(spd2*1.5+4); ball.vy=ny2*(spd2*1.5+4);
          ball.x=bb.x+nx2*(BALL_R+bb.r+2); ball.y=bb.y+ny2*(BALL_R+bb.r+2);
          bb.f=12;
        }
      }

      funnelCollide(ball);

      if(ball.y+BALL_R>FUNNEL_BOT && ball.x>EXIT_L && ball.x<EXIT_R){
        if(winners.length<drawCount){
          ball.won=true; ball.sunk=true; ball.vy=3; ball.vx=0;
          winners.push(ball.name);
        }
      }
    }

    for(var di=0;di<balls.length;di++){
      var bl=balls[di];
      if(bl.sunk && bl.sunkTick>50) continue;
      bl.trail.push({x:bl.x,y:bl.y});
      if(bl.trail.length>8) bl.trail.shift();
      for(var ti=0;ti<bl.trail.length;ti++){
        var ta=(ti/bl.trail.length)*0.12;
        var ts=BALL_R*(0.18+ti/bl.trail.length*0.44);
        ctx.beginPath(); ctx.arc(bl.trail[ti].x,bl.trail[ti].y,ts,0,Math.PI*2);
        ctx.fillStyle='rgba(224,123,42,'+ta+')'; ctx.fill();
      }
      if(bl.sunk){
        ctx.globalAlpha=Math.max(0,1-bl.sunkTick/35);
        drawPaw(bl.x,bl.y,BALL_R,bl.name,bl.spin,bl.colorSet,true);
        ctx.globalAlpha=1;
      } else {
        drawPaw(bl.x,bl.y,BALL_R,bl.name,bl.spin,bl.colorSet,false);
      }
    }

    if(winners.length>=drawCount&&!done){
      var readyToEnd=balls.filter(function(b){return b.won;}).every(function(b){return b.sunkTick>30;});
      if(readyToEnd){ done=true; setTimeout(function(){ showResult(winners); },500); return; }
    }

    if(tick>6000&&!done){
      var remaining=shuffle(balls.filter(function(b){return !b.won;}));
      for(var ri=0;ri<remaining.length&&winners.length<drawCount;ri++) winners.push(remaining[ri].name);
      done=true; setTimeout(function(){ showResult(winners); },300); return;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
