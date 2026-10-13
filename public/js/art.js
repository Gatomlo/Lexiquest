'use strict';
/* Dessins : icônes, compagnons, accessoires, Gardien, articles de la boutique. Fonctions pures. */
/* ================= icônes & dessins ================= */
var IC={
  home:'<path d="M4 11.5 12 4l8 7.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  play:'<path d="M8 5.5v13l11-6.5z"/>',
  book:'<path d="M5 5a2 2 0 0 1 2-1h12v15H7a2 2 0 0 0-2 2z"/><path d="M5 5v15"/>',
  paw:'<circle cx="7" cy="10" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="17" cy="10" r="2"/><path d="M12 12c-3 0-5 3-5 5a2.5 2.5 0 0 0 3 2c1-.4 1.5-.6 2-.6s1 .2 2 .6a2.5 2.5 0 0 0 3-2c0-2-2-5-5-5z"/>',
  flame:'<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  gem:'<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 16M15 4l-3 16"/>',
  lock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
  cards:'<rect x="4" y="6" width="12" height="14" rx="2"/><path d="M8 4h10a2 2 0 0 1 2 2v10"/>',
  swords:'<path d="M5 19 17 7m0 0h-4m4 0v4M19 19 7 7m0 0h4m-4 0v4"/>',
  shuffle:'<path d="M4 7h3l10 10h3M4 17h3l3-3M14 7h6m0 0-2-2m2 2-2 2M20 17l-2-2m2 2-2 2"/>',
  hammer:'<path d="M14 4l6 6-3 3-6-6z"/><path d="M12.5 11.5 5 19"/>',
  crown:'<path d="M4 18h16l1-10-5 4-4-7-4 7-5-4z"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  left:'<path d="m15 6-6 6 6 6"/>',
  chev:'<path d="m9 6 6 6-6 6"/>',
  bars:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert:'<path d="M12 4 3 19h18z"/><path d="M12 10v4M12 16.5v.5"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  down:'<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  out:'<path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M9 12h10"/>',
  eyeoff:'<path d="M3 3l18 18"/><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.6M6.4 7.7C3.9 9.4 2.5 12 2.5 12S6 18 12 18c1.4 0 2.6-.3 3.7-.8"/><path d="M9.9 10a2.8 2.8 0 0 0 4 4"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  heart:'<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  gift:'<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16M12 9c-3 0-5-1-5-3s3-2 5 3c2-5 5-5 5-3s-2 3-5 3z"/>'
};
function ic(n,fill){return '<svg class="ic" viewBox="0 0 24 24" fill="'+(fill||'none')+'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[n]+'</svg>';}
function heart(on){return '<svg viewBox="0 0 24 24" fill="'+(on?'var(--coral)':'var(--surface)')+'" stroke="var(--edge)" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true">'+IC.heart+'</svg>';}
function itemSvg(id){
  var E='var(--edge)',w='stroke="'+E+'" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"',s='<svg viewBox="0 0 40 40" aria-hidden="true">';
  if(id==='pomme'){s+='<circle cx="20" cy="23" r="12" fill="#FF6150" '+w+'/><path d="M20 11c0-3 2-5 5-6" fill="none" '+w+'/><ellipse cx="26" cy="9" rx="4.5" ry="2.6" fill="#2FBF71" '+w+'/>';}
  else if(id==='gateau'){s+='<rect x="6" y="21" width="28" height="13" rx="3" fill="#FF8FB1" '+w+'/><rect x="9" y="13" width="22" height="9" rx="3" fill="#FFF4CC" '+w+'/><path d="M20 7v6" '+w+'/><circle cx="20" cy="5" r="2.4" fill="#FFC62E" '+w+'/>';}
  else if(id==='festin'){s+='<path d="M5 19h30a15 13 0 0 1-30 0z" fill="#FF9418" '+w+'/><circle cx="14" cy="14" r="4.5" fill="#FF6150" '+w+'/><circle cx="22" cy="12" r="4.5" fill="#FFC62E" '+w+'/><circle cx="28" cy="15" r="4" fill="#2FBF71" '+w+'/>';}
  else if(id==='potion'){s+='<path d="M16 5h8v8l8 15a4 4 0 0 1-3.5 6h-17A4 4 0 0 1 8 28l8-15z" fill="#CBF3DC" '+w+'/><path d="M11 27h18l2 3a2.5 2.5 0 0 1-2 4H11a2.500 2.500 0 0 1-2-4z" fill="#2FBF71" '+w+'/><path d="M15 5h10" '+w+'/>';}
  else if(id==='bain'){s+='<path d="M5 22h30v3a9 9 0 0 1-9 9H14a9 9 0 0 1-9-9z" fill="#D4E8FF" '+w+'/><circle cx="13" cy="14" r="5" fill="#fff" '+w+'/><circle cx="23" cy="11" r="6.5" fill="#fff" '+w+'/><circle cx="30" cy="17" r="3.6" fill="#fff" '+w+'/>';}
  else if(id==='resur'){s+='<path d="M16 5h8v7l7 13a6 6 0 0 1-5.3 9H14.3A6 6 0 0 1 9 25l7-13z" fill="#C28BFF" '+w+'/><path d="M15 5h10" '+w+'/><path d="m20 17 1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#FFC62E" stroke="'+E+'" stroke-width="1.6" stroke-linejoin="round"/>';}
  else{s+='<circle cx="20" cy="20" r="14" fill="#2E8CFF" '+w+'/><path d="M8 14c8 4 16 4 24 0M8 26c8-4 16-4 24 0" fill="none" stroke="#FFC62E" stroke-width="3.4"/><circle cx="20" cy="20" r="14" fill="none" '+w+'/>';}
  return s+'</svg>';
}

/* créatures : 5 espèces, 3 stades, 4 niveaux de forme + à terre */
function critter(kind,lvl,size,stg,react,acc){
  size=size||110;stg=stg==null?1:stg;acc=acc||null;
  var ko=lvl===4;if(ko){lvl=3;react=null;}
  var eff=lvl;if(react==='happy'||react==='wow'){eff=0;}else if(react==='sad'){eff=2;}
  var E='var(--edge)',R=[22,26,29][stg],cy=60,i,sd,k;
  var P={phenix:{b:'#FFA63D',be:'#FFE2A0',a:'#FF6150',a2:'#FFC62E'},dragon:{b:'#4CC38A',be:'#D6F5E3',a:'#2E8F63',a2:'#FFE08A'},licorne:{b:'#FFFFFF',be:'#F4E4FF',a:'#C28BFF',a2:'#FFC62E'},griffon:{b:'#E2A658',be:'#FFF1CF',a:'#B9772E',a2:'#FFFFFF'},kraken:{b:'#8F72E8',be:'#D9CCFF',a:'#5B3FC0',a2:'#FF8FB1'},renard:{b:'#F28A3A',be:'#FFF1DC',a:'#7A3E1B',a2:'#FFFFFF'},hibou:{b:'#A8754F',be:'#F3E2C4',a:'#6B4630',a2:'#FFC62E'}}[kind];
  var s='<svg class="pet l'+lvl+(ko?' ko':'')+'" width="'+size+'" height="'+size+'" viewBox="0 0 100 100" aria-hidden="true">';
  s+='<ellipse cx="50" cy="95" rx="'+(R+8)+'" ry="4.5" fill="rgba(0,0,0,.2)"/>';
  var sw='stroke="'+E+'" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
  /* derrière le corps */
  if(kind==='phenix'){
    var tail=[2,3,5][stg];for(i=0;i<tail;i++){var a=tail>1?-34+i*(68/(tail-1)):0;s+='<ellipse cx="50" cy="'+(cy+R+9)+'" rx="5.5" ry="15" fill="'+(i%2?P.a:P.a2)+'" '+sw+' transform="rotate('+a+' 50 '+(cy+R-2)+')"/>';}
    [-1,1].forEach(function(d){for(var j=0;j<=stg;j++){var x=50+d*(R+3+j*3),y=cy+3+j*5;s+='<ellipse cx="'+x+'" cy="'+y+'" rx="7" ry="13" fill="'+(j%2?P.a2:P.b)+'" '+sw+' transform="rotate('+(d*(18+j*12))+' '+x+' '+y+')"/>';}});
  }else if(kind==='dragon'){
    [-1,1].forEach(function(d){var bx=50+d*(R-3),by=cy;s+='<path d="M'+bx+' '+by+' L'+(bx+d*(26+stg*4))+' '+(by-26-stg*3)+' L'+(bx+d*18)+' '+(by-4)+' L'+(bx+d*(30+stg*3))+' '+(by+2)+' L'+(bx+d*13)+' '+(by+12)+'z" fill="'+P.a+'" '+sw+'/>';});
    s+='<path d="M'+(50+R-4)+' '+(cy+R-6)+' q 24 4 22 -16" fill="none" stroke="'+E+'" stroke-width="12" stroke-linecap="round"/><path d="M'+(50+R-4)+' '+(cy+R-6)+' q 24 4 22 -16" fill="none" stroke="'+P.b+'" stroke-width="7" stroke-linecap="round"/><path d="M'+(50+R+16)+' '+(cy+R-26)+' l8 -4 -2 9z" fill="'+P.a2+'" '+sw+'/>';
  }else if(kind==='licorne'){
    s+='<path d="M'+(50+R-2)+' '+(cy+R-8)+' q 22 2 18 -20 q -4 12 -14 12" fill="#FF8FB1" '+sw+'/><path d="M'+(50+R-2)+' '+(cy+R-4)+' q 20 8 18 -2" fill="none" stroke="#8FD0FF" stroke-width="5" stroke-linecap="round"/>';
    s+='<path d="M'+(50-R+2)+' '+(cy-14)+' q -16 -4 -12 14 q 2 8 -2 16" fill="none" stroke="#FF8FB1" stroke-width="7" stroke-linecap="round"/><path d="M'+(50-R+4)+' '+(cy-8)+' q -12 4 -8 16" fill="none" stroke="#8FD0FF" stroke-width="5" stroke-linecap="round"/>';
  }else if(kind==='griffon'){
    [-1,1].forEach(function(d){for(var j=0;j<=stg+1;j++){var x=50+d*(R+2+j*4),y=cy-4+j*6;s+='<ellipse cx="'+x+'" cy="'+y+'" rx="8" ry="15" fill="'+(j%2?P.a2:P.be)+'" '+sw+' transform="rotate('+(d*(22+j*13))+' '+x+' '+y+')"/>';}});
    s+='<path d="M'+(50+R-2)+' '+(cy+R-4)+' q 20 4 16 -10 q -6 6 -16 4z" fill="'+P.a+'" '+sw+'/>';
  }else if(kind==='renard'){
    s+='<path d="M'+(50+R-6)+' '+(cy+R-4)+' q 34 6 26 -30 q -8 14 -26 14z" fill="'+P.b+'" '+sw+'/><path d="M'+(50+R+14)+' '+(cy+R-22)+' q 10 -2 12 6 q -8 0 -12 -6z" fill="'+P.a2+'" '+sw+'/>';
  }else if(kind==='hibou'){
    [-1,1].forEach(function(d){for(var j=0;j<=stg;j++){var x=50+d*(R+1+j*3),y=cy+4+j*5;s+='<ellipse cx="'+x+'" cy="'+y+'" rx="7" ry="14" fill="'+(j%2?P.a:P.b)+'" '+sw+' transform="rotate('+(d*(14+j*10))+' '+x+' '+y+')"/>';}});
  }else if(kind==='kraken'){
    var tn=[4,5,6][stg];for(i=0;i<tn;i++){var x0=50-R+6+i*((2*R-12)/(tn-1)),dir=i%2?1:-1;s+='<path d="M'+x0+' '+(cy+R-8)+' q '+(8*dir)+' 12 0 20 q '+(-8*dir)+' 8 3 14" fill="none" stroke="'+E+'" stroke-width="12" stroke-linecap="round"/><path d="M'+x0+' '+(cy+R-8)+' q '+(8*dir)+' 12 0 20 q '+(-8*dir)+' 8 3 14" fill="none" stroke="'+P.b+'" stroke-width="7" stroke-linecap="round"/>';}
  }
  /* corps */
  if(kind==='kraken'){s+='<ellipse cx="50" cy="'+(cy-2)+'" rx="'+R+'" ry="'+(R*1.02)+'" fill="'+P.b+'" '+sw+'/><circle cx="36" cy="'+(cy-R*.6)+'" r="3" fill="'+P.a+'"/><circle cx="62" cy="'+(cy-R*.7)+'" r="4" fill="'+P.a+'"/><circle cx="52" cy="'+(cy-R*.9)+'" r="2.4" fill="'+P.a+'"/>';}
  else{s+='<circle cx="50" cy="'+cy+'" r="'+R+'" fill="'+P.b+'" '+sw+'/><ellipse cx="50" cy="'+(cy+R*.4)+'" rx="'+(R*.6)+'" ry="'+(R*.5)+'" fill="'+P.be+'"/>';}
  /* devant le corps */
  if(kind==='phenix'){var cn=[1,2,3][stg];for(i=0;i<cn;i++){var x1=50+(i-(cn-1)/2)*10,y1=cy-R+3,hg=11+stg*3;s+='<path d="M'+x1+' '+y1+' c-5 -4 -5 -'+(hg*.6)+' 0 -'+hg+' c5 '+(hg*.4)+' 5 '+(hg*.6)+' 0 '+hg+'z" fill="'+(i%2?P.a2:P.a)+'" '+sw+'/>';}}
  if(kind==='dragon'){
    s+='<path d="M'+(50-R*.5)+' '+(cy-R+4)+' l-5 -16 l11 8z" fill="#FFF4CC" '+sw+'/><path d="M'+(50+R*.5)+' '+(cy-R+4)+' l5 -16 l-11 8z" fill="#FFF4CC" '+sw+'/>';
    var sp=[1,2,3][stg];for(i=0;i<sp;i++){var xs=50+(i-(sp-1)/2)*9;s+='<path d="M'+(xs-4)+' '+(cy-R+1)+' l4 -9 l4 9z" fill="'+P.a+'" '+sw+'/>';}
  }
  if(kind==='licorne'){
    s+='<path d="M'+(50-R*.55)+' '+(cy-R+6)+' l-4 -12 l10 6z" fill="#FFDDEA" '+sw+'/><path d="M'+(50+R*.55)+' '+(cy-R+6)+' l4 -12 l-10 6z" fill="#FFDDEA" '+sw+'/>';
    s+='<path d="M45 '+(cy-R+4)+' L50 '+(cy-R-18-stg*3)+' L55 '+(cy-R+4)+'z" fill="'+P.a2+'" '+sw+'/><path d="M46.5 '+(cy-R-2)+' h7M47.5 '+(cy-R-8)+' h5" stroke="'+E+'" stroke-width="2" stroke-linecap="round"/>';
  }
  if(kind==='renard'){
    s+='<path d="M'+(50-R*.7)+' '+(cy-R+10)+' l-3 -22 l16 14z" fill="'+P.b+'" '+sw+'/><path d="M'+(50+R*.7)+' '+(cy-R+10)+' l3 -22 l-16 14z" fill="'+P.b+'" '+sw+'/><path d="M'+(50-R*.62)+' '+(cy-R+5)+' l-1 -11 l7 6z M'+(50+R*.62)+' '+(cy-R+5)+' l1 -11 l-7 6z" fill="'+P.a+'"/>';
    s+='<path d="M30 '+(cy+8)+' q20 14 40 0 q-8 16 -20 16 q-12 0 -20 -16z" fill="'+P.be+'" '+sw+'/>';
  }
  if(kind==='hibou'){
    s+='<path d="M'+(50-R*.7)+' '+(cy-R+8)+' l-4 -16 l14 8z" fill="'+P.a+'" '+sw+'/><path d="M'+(50+R*.7)+' '+(cy-R+8)+' l4 -16 l-14 8z" fill="'+P.a+'" '+sw+'/>';
    s+='<circle cx="41" cy="'+(cy-4)+'" r="10" fill="'+P.be+'" '+sw+'/><circle cx="59" cy="'+(cy-4)+'" r="10" fill="'+P.be+'" '+sw+'/>';
  }
  if(kind==='griffon'){
    s+='<path d="M'+(50-R*.6)+' '+(cy-R+6)+' q -6 -12 3 -14 q 0 8 6 12z" fill="'+P.a+'" '+sw+'/><path d="M'+(50+R*.6)+' '+(cy-R+6)+' q 6 -12 -3 -14 q 0 8 -6 12z" fill="'+P.a+'" '+sw+'/>';
  }
  /* visage */
  var ey=cy-4,sadl=eff>=2;
  s+='<circle cx="41" cy="'+ey+'" r="6.2" fill="#fff" '+sw+'/><circle cx="59" cy="'+ey+'" r="6.2" fill="#fff" '+sw+'/>';
  var pr=react==='wow'?3.8:eff===3?2.2:3;
  s+='<circle cx="42" cy="'+(ey+(sadl?1.8:0))+'" r="'+pr+'" fill="'+E+'"/><circle cx="58" cy="'+(ey+(sadl?1.8:0))+'" r="'+pr+'" fill="'+E+'"/>';
  if(eff<2){s+='<circle cx="43.4" cy="'+(ey-1.4)+'" r="1.2" fill="#fff"/><circle cx="59.4" cy="'+(ey-1.4)+'" r="1.2" fill="#fff"/>';}
  if(eff>=2){s+='<path d="M34 '+(ey-5)+' h14 M52 '+(ey-5)+' h14" stroke="'+E+'" stroke-width="'+(eff===3?5:3.4)+'" stroke-linecap="round"/>';}
  if(eff===3){s+='<path d="M35 '+(ey+8)+' q6 3 12 0 M53 '+(ey+8)+' q6 3 12 0" fill="none" stroke="#6B5B7B" stroke-width="2.4" stroke-linecap="round"/>';}
  if(kind==='phenix'||kind==='griffon'||kind==='hibou'){s+='<path d="M45 '+(cy+4)+' L55 '+(cy+4)+' L50 '+(cy+12)+'z" fill="'+(kind==='phenix'?'#FF9418':'#FFC62E')+'" '+sw+'/>';}
  else{
    var my=cy+9;
    if(eff===0){s+='<path d="M43 '+my+' q7 8 14 0" fill="#FF6150" '+sw+'/>';}
    else if(eff===1){s+='<path d="M44 '+(my+2)+' q6 3 12 0" fill="none" '+sw+'/>';}
    else{s+='<path d="M43 '+(my+5)+' q7 -7 14 0" fill="none" '+sw+'/>';}
  }
  s+='<circle cx="33" cy="'+(cy+4)+'" r="3.6" fill="#FF6150" opacity="'+(eff<2?.5:.18)+'"/><circle cx="67" cy="'+(cy+4)+'" r="3.6" fill="#FF6150" opacity="'+(eff<2?.5:.18)+'"/>';
  if(acc){s+=accSvg(acc,R,cy,ey,sw);}
  /* décrépitude */
  if(lvl>=2){s+='<path d="M72 '+(cy-20)+' q4 7 0 10 q-4 -3 0 -10z" fill="#8FD0FF" stroke="'+E+'" stroke-width="1.8"/>';}
  if(lvl===3){
    s+='<g fill="#8D9C94" opacity=".8"><circle cx="22" cy="52" r="2.6"/><circle cx="80" cy="70" r="3"/><circle cx="30" cy="82" r="2"/><circle cx="70" cy="40" r="2.2"/><circle cx="58" cy="28" r="1.8"/></g>';
    s+='<path d="M4 4 L26 4 M4 4 L4 26 M4 4 L20 20 M13 4 Q10 12 4 13 M20 4 Q15 15 4 20" fill="none" stroke="#9AA6A0" stroke-width="1.6"/>';
    s+='<path d="M30 '+(cy+R*.2)+' l4 3 l-3 4 M66 '+(cy+R*.5)+' l-4 3 l3 4" stroke="'+E+'" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
  }
  if(ko){s+='<text x="70" y="18" font-family="Nunito,sans-serif" font-weight="900" font-size="13" fill="'+E+'">z<tspan font-size="10" dy="-6">z</tspan><tspan font-size="8" dy="-5">z</tspan></text>';}
  return s+'</svg>';
}
function accSvg(id,R,cy,ey,sw){
  var X=50+R*.6,Y=cy-R*.75,y,i,o='',E='var(--edge)';
  function rot(a,inner){return '<g transform="rotate('+a+' '+X+' '+Y+')">'+inner+'</g>';}
  if(id==='casque'){return '<path d="M'+(50-R*.85)+' '+(cy-4)+' q0 -'+(R*1.3)+' '+(R*.85)+' -'+(R*1.3)+' q'+(R*.85)+' 0 '+(R*.85)+' '+(R*1.3)+'" fill="none" stroke="'+E+'" stroke-width="5" stroke-linecap="round"/><rect x="'+(50-R*.85-5)+'" y="'+(cy-12)+'" width="10" height="20" rx="5" fill="#2E8CFF" '+sw+'/><rect x="'+(50+R*.85-5)+'" y="'+(cy-12)+'" width="10" height="20" rx="5" fill="#2E8CFF" '+sw+'/>';}
  if(id==='monocle'){return '<circle cx="59" cy="'+ey+'" r="9" fill="rgba(255,255,255,.2)" stroke="#FFC62E" stroke-width="3"/><path d="M66 '+(ey+6)+' q6 10 2 22" fill="none" stroke="#FFC62E" stroke-width="1.8" stroke-linecap="round"/>';}
  if(id==='cape'){y=cy+R*.45;return '<path d="M'+(50-R*.8)+' '+y+' q'+(R*.8)+' 8 '+(R*1.6)+' 0 l6 '+(R*.9)+' q-'+(R*.9+6)+' 6 -'+(R*1.8+12)+' 0z" fill="#FF6150" '+sw+'/><circle cx="50" cy="'+(y+4)+'" r="3" fill="#FFC62E" '+sw+'/>';}
  if(id==='noeud'){y=cy+R*.62;return '<path d="M50 '+y+' l-10 -6 v12z M50 '+y+' l10 -6 v12z" fill="#FF6150" '+sw+'/><circle cx="50" cy="'+y+'" r="2.8" fill="#FFC62E" '+sw+'/>';}
  if(id==='echarpe'){y=cy+R*.38;return '<path d="M'+(50+R*.35)+' '+(y+5)+' l3 16 l8 -2 l-4 -15z" fill="#FFC62E" '+sw+'/><path d="M'+(50-R*.9)+' '+y+' q'+(R*.9)+' 10 '+(R*1.8)+' 0 v8 q'+(-R*.9)+' 10 '+(-R*1.8)+' 0z" fill="#2E8CFF" '+sw+'/>';}
  if(id==='collier'){for(i=0;i<=8;i++){var t=i/8;o+='<circle cx="'+(50-R*.72+t*R*1.44)+'" cy="'+(cy+R*.4+Math.sin(t*Math.PI)*7)+'" r="2.5" fill="#FFF8F0" stroke="'+E+'" stroke-width="1.4"/>';}return o;}
  if(id==='medaille'){y=cy+R*.3;return '<path d="M'+(50-R*.45)+' '+y+' L50 '+(y+R*.42)+' L'+(50+R*.45)+' '+y+'" fill="none" stroke="#2E8CFF" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="'+(y+R*.42+5)+'" r="6" fill="#FFC62E" '+sw+'/><circle cx="50" cy="'+(y+R*.42+5)+'" r="2.6" fill="none" stroke="#B9772E" stroke-width="1.4"/>';}
  if(id==='lunettes'){return '<circle cx="41" cy="'+ey+'" r="8.6" fill="rgba(255,255,255,.18)" '+sw+'/><circle cx="59" cy="'+ey+'" r="8.6" fill="rgba(255,255,255,.18)" '+sw+'/><path d="M49.6 '+ey+' h0.8" '+sw+'/>';}
  if(id==='soleil'){return '<rect x="32" y="'+(ey-6)+'" width="17" height="11" rx="4.5" fill="#23305E" '+sw+'/><rect x="51" y="'+(ey-6)+'" width="17" height="11" rx="4.5" fill="#23305E" '+sw+'/><path d="M49 '+(ey-3)+' h2" '+sw+'/><path d="M35 '+(ey-3)+' l4 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>';}
  if(id==='bandeau'){return '<path d="M'+(50-R*.92)+' '+(ey-11)+' L'+(50+R*.96)+' '+(ey+1)+'" stroke="'+E+'" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="59" cy="'+ey+'" rx="7.6" ry="7" fill="#23305E" '+sw+'/><path d="M56 '+(ey-2)+' l3 3 l3 -3" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>';}
  if(id==='fleur'){for(i=0;i<5;i++){var an=i*72*Math.PI/180;o+='<circle cx="'+(X+Math.cos(an)*4.4)+'" cy="'+(Y-4+Math.sin(an)*4.4)+'" r="3.4" fill="#FF8FB1" stroke="'+E+'" stroke-width="1.6"/>';}return o+'<circle cx="'+X+'" cy="'+(Y-4)+'" r="2.6" fill="#FFC62E" stroke="'+E+'" stroke-width="1.6"/>';}
  if(id==='bonnet'){return rot(22,'<path d="M'+(X-11)+' '+Y+' q0 -17 11 -17 q11 0 11 17z" fill="#FF6150" '+sw+'/><rect x="'+(X-12.5)+'" y="'+(Y-3.5)+'" width="25" height="7" rx="3.5" fill="#fff" '+sw+'/><circle cx="'+X+'" cy="'+(Y-18)+'" r="4.4" fill="#fff" '+sw+'/>');}
  if(id==='casquette'){return rot(18,'<ellipse cx="'+(X+11)+'" cy="'+Y+'" rx="10" ry="2.8" fill="#1B5FB0" '+sw+'/><path d="M'+(X-10)+' '+Y+' q0 -14 10 -14 q10 0 10 14z" fill="#2E8CFF" '+sw+'/><circle cx="'+X+'" cy="'+(Y-14)+'" r="1.8" fill="#1B5FB0"/>');}
  if(id==='chapeau'){return rot(26,'<path d="M'+(X-8)+' '+Y+' L'+X+' '+(Y-24)+' L'+(X+8)+' '+Y+'z" fill="#8F72E8" '+sw+'/><ellipse cx="'+X+'" cy="'+Y+'" rx="13" ry="3.6" fill="#5B3FC0" '+sw+'/><circle cx="'+(X-1)+'" cy="'+(Y-11)+'" r="2" fill="#FFC62E"/>');}
  if(id==='couronne'){return rot(20,'<path d="M'+(X-10)+' '+Y+' v-11 l5 6 l5 -9 l5 9 l5 -6 v11z" fill="#FFC62E" '+sw+'/><circle cx="'+X+'" cy="'+(Y-4)+'" r="1.8" fill="#FF6150"/>');}
  if(id==='aureole'){y=cy-R-13;return '<ellipse cx="50" cy="'+y+'" rx="14" ry="4" fill="none" stroke="'+E+'" stroke-width="6"/><ellipse cx="50" cy="'+y+'" rx="14" ry="4" fill="none" stroke="#FFE08A" stroke-width="3"/>';}
  return '';
}
function bossArt(lang,size){
  var c=lang==='nl'?'#FF9418':lang==='en'?'#2E8CFF':'#FFC62E';
  return '<svg class="bossart" width="'+size+'" height="'+size+'" viewBox="0 0 120 120" aria-hidden="true">'
   +'<path d="M26 40 14 14l26 14zM94 40l12-26-26 14z" fill="#FFF4CC" stroke="var(--edge)" stroke-width="3.5" stroke-linejoin="round"/>'
   +'<path d="M18 70c0-26 18-42 42-42s42 16 42 42c0 20-14 34-42 34S18 90 18 70z" fill="var(--plum)" stroke="var(--edge)" stroke-width="4"/>'
   +'<ellipse cx="60" cy="86" rx="26" ry="14" fill="'+c+'" opacity=".9"/>'
   +'<path d="M30 56l22 8M90 56l-22 8" stroke="var(--edge)" stroke-width="5" stroke-linecap="round"/>'
   +'<circle cx="44" cy="68" r="9" fill="#fff" stroke="var(--edge)" stroke-width="3"/><circle cx="76" cy="68" r="9" fill="#fff" stroke="var(--edge)" stroke-width="3"/>'
   +'<circle cx="46" cy="70" r="4" fill="var(--edge)"/><circle cx="74" cy="70" r="4" fill="var(--edge)"/>'
   +'<path d="M40 90l6 8 6-8 8 8 6-8 6 8 6-8" fill="#fff" stroke="var(--edge)" stroke-width="3" stroke-linejoin="round"/></svg>';
}
function ring(p,size,sw,color){var r=(size-sw)/2,c=2*Math.PI*r;return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="var(--line)" stroke-width="'+sw+'"/><circle class="ring-fg" cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+c+'" style="--c:'+c+';stroke-dashoffset:'+(c*(1-p))+'" transform="rotate(-90 '+size/2+' '+size/2+')"/></svg>';}
