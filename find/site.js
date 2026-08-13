/* Pawwltu website logic */
(function () {
  var C = window.KYPWEB || {};
  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  var SAFE = "id,name,species,breed,public_code,biometric_id,photo_path,area,lat,lng,is_street,has_noseprint,is_lost,lost_since,owner_phone";
  var EMOJI = { dog: "\ud83d\udc36", cat: "\ud83d\udc31" };
  function esc(s){return String(s==null?"":s).replace(/[&<>\"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function photoUrl(p){ if(!p) return ""; if(/^https?:/.test(p)) return p; return C.SUPABASE_URL + "/storage/v1/object/public/" + (C.BUCKET||"pet-media") + "/" + p; }
  function code(pt){ return pt.public_code || pt.biometric_id || "Pending"; }

  var panes = { search:"pane-search", photo:"pane-photo", lost:"pane-lost" };
  document.querySelectorAll(".tab").forEach(function(t){
    t.onclick=function(){
      document.querySelectorAll(".tab").forEach(function(x){x.classList.remove("active");});
      t.classList.add("active");
      Object.keys(panes).forEach(function(k){ document.getElementById(panes[k]).style.display = (k===t.dataset.t)?"":"none"; });
      if(t.dataset.t==="lost") loadLost();
    };
  });

  function petCard(pt, extra){
    var ph = photoUrl(pt.photo_path);
    var phStyle = ph ? ('style="background-image:url(\''+esc(ph)+'\')"') : "";
    var phInner = ph ? "" : (EMOJI[pt.species]||"\ud83d\udc36");
    var nose = pt.has_noseprint ? '<span class="badge-nose y">\ud83d\udd12 Verified</span>' : '<span class="badge-nose n">\ud83d\udcf7 Photo</span>';
    var ribbon = pt.is_lost ? '<div class="ribbon">LOST</div>' : "";
    var chip = pt.is_lost ? '<span class="pill red">\ud83d\udea8 Lost</span>' : (pt.has_noseprint?'<span class="pill green">\ud83d\udd12 Noseprint</span>':'<span class="pill">\ud83d\udcf7 Photo only</span>');
    return '<div class="pet" data-id="'+esc(pt.id)+'">'
      + '<div class="ph" '+phStyle+'>'+phInner+ribbon+nose+'</div>'
      + '<div class="bd"><div class="nm">'+esc(pt.name||"Unnamed")+'</div>'
      + '<div class="mt">'+esc(pt.breed||(pt.is_street?"Street dog":"\u2014"))+(pt.area?" \u00b7 "+esc(pt.area):"")+'</div>'
      + '<div class="code">'+esc(code(pt))+'</div>'
      + '<div style="margin-top:8px;display:flex;gap:6px;align-items:center">'+chip+(extra||"")+'</div>'
      + '</div></div>';
  }
  function wire(container, pets){
    container.querySelectorAll(".pet").forEach(function(el){
      el.onclick=function(){ var pt=pets.filter(function(p){return String(p.id)===el.dataset.id;})[0]; if(pt) openCard(pt); };
    });
  }

  var qEl=document.getElementById("q"), out=document.getElementById("searchOut"), hint=document.getElementById("searchHint");
  function doSearch(){
    var q=(qEl.value||"").trim();
    if(!q){ hint.style.display=""; hint.textContent="Type an ID, number, or name above and hit Search."; out.innerHTML=""; return; }
    hint.style.display=""; hint.innerHTML='<span class="spinner"></span>'; out.innerHTML="";
    var like="%"+q+"%";
    sb.from("pets").select(SAFE)
      .or("public_code.ilike."+like+",biometric_id.ilike."+like+",name.ilike."+like)
      .limit(40)
      .then(function(r){
        var rows=r.data||[];
        if(!rows.length){ hint.textContent="No dogs found for \u201c"+q+"\u201d."; return; }
        hint.style.display="none";
        out.innerHTML=rows.map(function(p){return petCard(p);}).join("");
        wire(out, rows);
      });
  }
  document.getElementById("go").onclick=doSearch;
  qEl.addEventListener("keydown",function(e){ if(e.key==="Enter") doSearch(); });
  var usp=new URLSearchParams(location.search);
  if(usp.get("q")){ qEl.value=usp.get("q"); doSearch(); }

  var drop=document.getElementById("drop"), file=document.getElementById("file"), pout=document.getElementById("photoOut"), dropTxt=document.getElementById("dropTxt");
  drop.addEventListener("click",function(){ file.click(); });
  drop.addEventListener("dragover",function(e){ e.preventDefault(); drop.classList.add("drag"); });
  drop.addEventListener("dragleave",function(){ drop.classList.remove("drag"); });
  drop.addEventListener("drop",function(e){ e.preventDefault(); drop.classList.remove("drag"); if(e.dataTransfer.files[0]) identify(e.dataTransfer.files[0]); });
  file.addEventListener("change",function(){ if(file.files[0]) identify(file.files[0]); });

  function identify(f){
    dropTxt.innerHTML='<span class="spinner"></span> Identifying\u2026';
    pout.innerHTML="";
    var fd=new FormData(); fd.append("file", f); fd.append("image", f);
    var ctrl=new AbortController(); var to=setTimeout(function(){ctrl.abort();},20000);
    fetch((C.REID_BASE||"").replace(/\/$/,"")+"/identify",{method:"POST",body:fd,signal:ctrl.signal})
      .then(function(r){ return r.json(); })
      .then(function(data){
        clearTimeout(to);
        dropTxt.innerHTML="\ud83d\udcf8 Tap to choose a photo (or drag & drop)";
        var matches=normalizeMatches(data);
        if(!matches.length){ pout.innerHTML='<div class="empty">No confident match found. Try a clearer face photo.</div>'; return; }
        resolveMatches(matches);
      })
      .catch(function(err){
        clearTimeout(to);
        dropTxt.innerHTML="\ud83d\udcf8 Tap to choose a photo (or drag & drop)";
        pout.innerHTML='<div class="empty">Couldn\u2019t reach the identification server. Please try again later.</div>';
        console.error(err);
      });
  }
  function normalizeMatches(data){
    var arr = data && (data.matches || data.results || data.candidates || (Array.isArray(data)?data:null)) || [];
    return arr.map(function(m){
      var key = m.biometric_id || m.public_code || m.pet_id || m.id || m.petId || null;
      var byPath = (!key && m.photo_path) ? m.photo_path : null;
      var sc = m.score!=null?m.score : (m.similarity!=null?m.similarity : (m.confidence!=null?m.confidence : (m.distance!=null?(1-m.distance):null)));
      return { key:key, photo_path:byPath, score:sc };
    }).filter(function(m){ return m.key || m.photo_path; }).slice(0,12);
  }
  function resolveMatches(matches){
    var ids=matches.map(function(m){return m.key;}).filter(Boolean);
    var paths=matches.map(function(m){return m.photo_path;}).filter(Boolean);
    var q = sb.from("pets").select(SAFE);
    if(ids.length && !paths.length){
      q = q.or("public_code.in.("+ids.join(",")+"),biometric_id.in.("+ids.join(",")+")");
    }
    q.limit(20).then(function(r){
      var rows=r.data||[];
      rows.forEach(function(p){
        var m=matches.filter(function(x){return x.key===p.public_code||x.key===p.biometric_id||x.photo_path===p.photo_path;})[0];
        p.__score = m?m.score:null;
      });
      rows.sort(function(a,b){return (b.__score||0)-(a.__score||0);});
      if(!rows.length){ pout.innerHTML='<div class="empty">Matched, but couldn\u2019t load the profile.</div>'; return; }
      pout.innerHTML=rows.map(function(p){
        var sc=p.__score!=null?'<span class="score">'+Math.round(p.__score*100)+'% match</span>':"";
        return petCard(p, sc);
      }).join("");
      wire(pout, rows);
    });
  }

  var lostOut=document.getElementById("lostOut"), lostHint=document.getElementById("lostHint"), lq=document.getElementById("lq");
  var LOST=[]; var myLoc=null;
  function loadLost(){
    lostHint.style.display=""; lostHint.innerHTML='<span class="spinner"></span>';
    sb.from("pets").select(SAFE).eq("is_lost",true).order("lost_since",{ascending:false}).limit(200)
      .then(function(r){ LOST=r.data||[]; renderLost(); subscribeLost(); });
  }
  function dist(a,b,c,d){ if([a,b,c,d].some(function(x){return x==null;})) return null; var R=6371,dLat=(c-a)*Math.PI/180,dLon=(d-b)*Math.PI/180,la1=a*Math.PI/180,la2=c*Math.PI/180; var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)*Math.sin(dLon/2); return 2*R*Math.asin(Math.sqrt(h)); }
  function renderLost(){
    var f=(lq.value||"").trim().toLowerCase();
    var rows=LOST.slice();
    if(f) rows=rows.filter(function(p){return (p.area||"").toLowerCase().indexOf(f)>=0;});
    if(myLoc) rows.forEach(function(p){ p.__d=dist(myLoc.lat,myLoc.lng,p.lat,p.lng); });
    if(myLoc) rows.sort(function(a,b){return (a.__d==null?1e9:a.__d)-(b.__d==null?1e9:b.__d);});
    if(!rows.length){ lostHint.style.display=""; lostHint.textContent="No lost dogs reported"+(f?" in that area":"")+"."; lostOut.innerHTML=""; return; }
    lostHint.style.display="none";
    lostOut.innerHTML=rows.map(function(p){
      var extra="";
      if(p.__d!=null) extra='<span class="pill">\ud83d\udccd '+p.__d.toFixed(1)+' km</span>';
      if(p.owner_phone) extra+=' <a class="pill green" href="tel:'+esc(p.owner_phone)+'" onclick="event.stopPropagation()">\ud83d\udcde Call</a>';
      return petCard(p, extra);
    }).join("");
    wire(lostOut, rows);
  }
  lq.addEventListener("input", renderLost);
  document.getElementById("near").onclick=function(){
    if(!navigator.geolocation){ alert("Location not available"); return; }
    navigator.geolocation.getCurrentPosition(function(pos){ myLoc={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderLost(); }, function(){ alert("Couldn\u2019t get your location"); });
  };
  var lostSub=false;
  function subscribeLost(){
    if(lostSub) return; lostSub=true;
    try{
      sb.channel("lost-pets").on("postgres_changes",{event:"*",schema:"public",table:"pets"},function(){ loadLostQuiet(); }).subscribe();
    }catch(e){}
  }
  function loadLostQuiet(){ sb.from("pets").select(SAFE).eq("is_lost",true).order("lost_since",{ascending:false}).limit(200).then(function(r){ LOST=r.data||[]; renderLost(); }); }

  var ov=document.getElementById("ov"), idcard=document.getElementById("idcard"), curPt=null;
  function openCard(pt){
    curPt=pt;
    var ph=photoUrl(pt.photo_path);
    var phStyle=ph?('style="background-image:url(\''+esc(ph)+'\')"'):"";
    var phInner=ph?"":(EMOJI[pt.species]||"\ud83d\udc36");
    var nose=pt.has_noseprint?'<div class="badge-nose y" style="position:absolute;top:10px;right:10px">\ud83d\udd12 NOSEPRINT VERIFIED</div>':'<div class="badge-nose n" style="position:absolute;top:10px;right:10px">\ud83d\udcf7 PHOTO ONLY</div>';
    var ribbon=pt.is_lost?'<div class="ribbon" style="top:16px;left:-34px;padding:5px 40px;font-size:12px">LOST</div>':"";
    idcard.innerHTML=
      ribbon
      + '<div class="hd"><b>\ud83d\udc3e KYP \u00b7 PET ID</b><span style="font-size:11px;opacity:.9">by Pawwltu</span></div>'
      + '<div class="ph" '+phStyle+'>'+phInner+'<div class="grad"></div>'+nose
      + '<div class="nm"><b>'+esc(pt.name||"Unnamed")+'</b><div style="font-size:12px;opacity:.95">'+esc(pt.breed||"\u2014")+'</div></div></div>'
      + '<div class="ft"><div><div style="font-size:10px;letter-spacing:1.4px;opacity:.82">DIGITAL ID</div><div class="id">'+esc(code(pt))+'</div></div>'
      + '<div style="text-align:right;font-size:11px;opacity:.92;line-height:1.5">'+(pt.is_street?"Street dog":"Home pet")+'<br>'+(pt.has_noseprint?"\ud83d\udd12 100% verifiable":"\ud83d\udcf7 photo match")+'</div></div>'
      + '<div class="bar"></div><div class="gloss"></div>';
    ov.classList.add("show");
    if(history.pushState){ history.pushState({card:1},""); }
  }
  function closeCard(){ ov.classList.remove("show"); curPt=null; }
  document.getElementById("ovClose").onclick=function(){ if(history.state&&history.state.card) history.back(); else closeCard(); };
  ov.addEventListener("click",function(e){ if(e.target===ov){ if(history.state&&history.state.card) history.back(); else closeCard(); } });
  window.addEventListener("popstate",function(){ if(ov.classList.contains("show")) closeCard(); });
  document.getElementById("ovShare").onclick=function(){
    if(!curPt) return;
    var url=(C.CARD_BASE||"")+encodeURIComponent(code(curPt));
    var text=(curPt.name||"This dog")+" \u00b7 KYP ID "+code(curPt)+(curPt.is_lost?" \u2014 REPORTED LOST":"")+"\n"+url;
    if(navigator.share){ navigator.share({title:"KYP Pet ID",text:text,url:url}); }
    else if(navigator.clipboard){ navigator.clipboard.writeText(text); document.getElementById("ovShare").textContent="\u2705 Copied"; setTimeout(function(){document.getElementById("ovShare").innerHTML="\ud83d\udce4 Share";},1400); }
  };
})();
