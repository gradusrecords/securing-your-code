/* ZAYA — top strip: Tashkent clock + UZS rates (USD / EUR / GBP).
   Shared by index.html and catalog.html. Rates: Central Bank of Uzbekistan (cbu.uz), fallback open.er-api.com,
   last good values cached in localStorage ("zaya-fx"). Language follows "zaya-lang". */
(function(){
  if(self!==top)return;                       // inside the catalog drawer the site already has the strip
  var H=30, TZ="Asia/Tashkent", CUR=["USD","EUR","GBP"], KEY="zaya-fx", EVERY=6*3600e3;
  var L={
    ru:{city:"Ташкент",rate:"курс UZS",src:"ЦБ Узбекистана"},
    uz:{city:"Toshkent",rate:"UZS kursi",src:"O‘zbekiston MB"},
    en:{city:"Tashkent",rate:"UZS rate",src:"Central Bank of Uzbekistan"}
  };
  var css=
  ":root{--fxh:"+H+"px}"+
  ".fxbar{position:fixed;inset:0 0 auto;z-index:61;height:calc(var(--fxh) + env(safe-area-inset-top,0px));padding:env(safe-area-inset-top,0px) 20px 0;display:flex;align-items:center;justify-content:space-between;gap:16px;"+
    "background:rgba(5,5,5,.66);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(219,181,119,.16);"+
    "font:400 10.5px/1 Jost,system-ui,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#8E887D;opacity:0;transition:opacity 1.2s ease;pointer-events:none;user-select:none}"+
  ".fxbar.on{opacity:1}"+
  ".fxbar .c{display:flex;align-items:baseline;gap:12px;white-space:nowrap}"+
  ".fxbar .t{font:italic 300 17px/1 'Cormorant Garamond',Georgia,serif;letter-spacing:.06em;color:#DBB577;font-variant-numeric:tabular-nums}"+
  ".fxbar .t i{font-style:normal;opacity:.55;margin-inline:1px;animation:fxb 1s steps(2,jump-none) infinite}"+
  "@keyframes fxb{50%{opacity:.12}}"+
  ".fxbar .r{display:flex;align-items:baseline;gap:22px;white-space:nowrap}"+
  ".fxbar .rates{display:flex;align-items:baseline;gap:22px}"+
  ".fxbar .p{display:flex;align-items:baseline;gap:8px}"+
  ".fxbar .p b{font:italic 300 15px/1 'Cormorant Garamond',Georgia,serif;letter-spacing:.04em;color:#EFE7D6;font-variant-numeric:tabular-nums}"+
  ".fxbar .p s{text-decoration:none;font-size:7px;letter-spacing:0;transform:translateY(-1px)}"+
  ".fxbar .p s.u{color:#DBB577}.fxbar .p s.d{color:#8E887D}"+
  ".fxbar .sep{width:1px;height:12px;background:rgba(219,181,119,.32);align-self:center}"+
  ".fxbar .lbl{color:#9C8157}"+
  "@media (max-width:760px){.fxbar{padding-inline:14px;gap:10px;font-size:9px;letter-spacing:.16em}.fxbar .r,.fxbar .rates{gap:12px}.fxbar .t{font-size:15px}.fxbar .p b{font-size:13px}.fxbar .lbl,.fxbar .sep{display:none}}"+
  "@media (max-width:400px){.fxbar .city{display:none}.fxbar .r,.fxbar .rates{gap:9px}}"+
  /* push the existing fixed UI below the strip */
  ".nav{top:var(--fxh,0px)!important;padding-top:0!important}"+
  ".ui.top{top:calc(var(--fxh) + env(safe-area-inset-top,0px) + 18px)!important}";
  var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

  var bar=document.createElement("div");bar.className="fxbar";bar.setAttribute("aria-hidden","true");
  bar.innerHTML='<div class="c"><span class="city lbl"></span><span class="t"></span></div>'+
                '<div class="r"><span class="lbl rl"></span><span class="sep"></span><span class="rates"></span></div>';
  function mount(){document.body.appendChild(bar);requestAnimationFrame(function(){bar.className+=" on"})}
  if(document.body)mount();else addEventListener("DOMContentLoaded",mount);

  var el={city:bar.querySelector(".city"),t:bar.querySelector(".t"),rl:bar.querySelector(".rl"),rates:bar.querySelector(".rates")};
  function lang(){var l="ru";try{l=localStorage.getItem("zaya-lang")||document.documentElement.lang||"ru"}catch(e){l=document.documentElement.lang||"ru"}return L[l]?l:"ru"}

  /* ---- clock ---- */
  var fmt;try{fmt=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}catch(e){fmt=null}
  function pad(n){return(n<10?"0":"")+n}
  function now(){
    var h,m,s,p;
    if(fmt){p=fmt.formatToParts(new Date());h=p[0].value;m=p[2].value;s=p[4].value}
    else{var d=new Date(Date.now()+new Date().getTimezoneOffset()*6e4+5*36e5);h=pad(d.getHours());m=pad(d.getMinutes());s=pad(d.getSeconds())}
    return h+"<i>:</i>"+m+"<i>:</i>"+s;
  }

  /* ---- rates ---- */
  var fx=null,lastLang="";
  try{fx=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(fx))}catch(e){}}
  function num(v){return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g," ")}
  function renderRates(){
    var h="";
    CUR.forEach(function(c){
      var r=fx&&fx.r&&fx.r[c];
      var a=r?(r.d>0?'<s class="u">▲</s>':r.d<0?'<s class="d">▼</s>':""):"";
      h+='<span class="p"><span>'+c+'</span><b>'+(r?num(r.v):"—")+'</b>'+a+'</span>';
    });
    el.rates.innerHTML=h;
  }
  function renderText(){
    var l=lang(),T=L[l];
    el.city.textContent=T.city;el.rl.textContent=T.rate;bar.title=T.rate+" · "+T.src;
    if(lastLang!==l){lastLang=l;document.documentElement.setAttribute("data-fx-lang",l)}
  }
  function fromCBU(){
    return fetch("https://cbu.uz/ru/arkhiv-kursov-valyut/json/",{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(a){
      var o={};a.forEach(function(x){if(CUR.indexOf(x.Ccy)>=0)o[x.Ccy]={v:parseFloat(x.Rate),d:parseFloat(x.Diff)||0}});
      if(CUR.some(function(c){return!o[c]||!isFinite(o[c].v)}))throw 0;return o});
  }
  function fromER(){
    return fetch("https://open.er-api.com/v6/latest/USD").then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){
      var q=j.rates,uzs=q.UZS,o={},prev=fx&&fx.r;
      CUR.forEach(function(c){var v=c==="USD"?uzs:uzs/q[c];o[c]={v:v,d:prev&&prev[c]?v-prev[c].v:0}});
      if(CUR.some(function(c){return!isFinite(o[c].v)}))throw 0;return o});
  }
  function load(){
    fromCBU().catch(fromER).then(function(o){fx={t:Date.now(),r:o};save();renderRates()}).catch(function(){});
  }
  renderRates();renderText();
  if(!fx||Date.now()-fx.t>EVERY)load();
  setInterval(load,EVERY);

  /* ---- tick ---- */
  function tick(){el.t.innerHTML=now();renderText()}
  tick();setInterval(tick,1000);
})();
