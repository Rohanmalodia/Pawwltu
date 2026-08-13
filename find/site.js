(function () {
  var C = window.KYPWEB || {};
  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  var SAFE_MIN = "id,name,species,breed,public_code,biometric_id,photo_path,area,lat,lng,is_street,has_noseprint,is_lost,lost_since,owner_phone,metadata";
  var SAFE = SAFE_MIN + ",lost_note,created_at";
  var EMOJI = { dog: "\ud83d\udc36", cat: "\ud83d\udc31" };
  function esc(s){return String(s==null?"":s).replace(/[&<>\"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function photoUrl(p){ if(!p) return ""; if(/^https?:/.test(p)) return p; return C.SUPABASE_URL + "/storage/v1/object/public/" + (C.BUCKET||"pet-media") + "/" + p; }
  function code(pt){ return pt.public_code || pt.biometric_id || "Pending"; }
  function cap(s){ return s?(String(s).charAt(0).toUpperCase()+String(s).slice(1)):s; }
  function fmtDate(s){ try{ return new Date(s).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});}catch(e){return "";} }
  function cardLink(pt){ try{ return new URL("d/?c="+encodeURIComponent(code(pt)), location.href).href; }catch(e){ return (C.CARD_BASE||"")+encodeURIComponent(code(pt)); } }
  // The app currently syncs lost status inside the metadata JSON blob; honor it
  // as a fallback so lost dogs show even before the app's column fix ships.
  function normLost(p){
    if(!p) return p;
    var m=(p.metadata&&typeof p.metadata==="object")?p.metadata:null;
    if(m){
      if(!p.is_lost && (m.isLost===true||m.is_lost===true)) p.is_lost=true;
      if(p.lost_since==null && (m.lostSince||m.lost_since)) p.lost_since=m.lostSince||m.lost_since;
      if(p.lost_note==null && (m.lostNote||m.lost_note)) p.lost_note=m.lostNote||m.lost_note;
      if((p.owner_phone==null||p.owner_phone==='') && m.phone) p.owner_phone=m.phone;
    }
    return p;
  }
​
  var panes = { search:"pane-search", photo:"pane-photo", lost:"pane-lost" };
  document.querySelectorAll(".tab").forEach(function(t){
    t.onclick=function(){
      document.querySelectorAll(".tab").forEach(function(x){x.classList.remove("active");});
      t.classList.add("active");
      Object.keys(panes).forEach(function(k){ document.getElementById(panes[k]).style.display = (k===t.dataset.t)?"":"none"; });
      if(t.dataset.t==="lost") loadLost();
    };
  });
​
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
​
  var qEl=document.getElementById("q"), out=document.getElementById("searchOut"), hint=document.getElementById("searchHint");
  function doSearch(){
    var q=(qEl.value||"").trim();
    if(!q){ hint.style.display=""; hint.textContent="Type an ID, number, or name above and hit Search."; out.innerHTML=""; return; }
    hint.style.display=""; hint.innerHTML='<span class="spinner"></span>'; out.innerHTML="";
    var like="%"+q+"%";
    function attempt(cols){ return sb.from("pets").select(cols).or("public_code.ilike."+like+",biometric_id.ilike."+like+",name.ilike."+like).limit(40); }
    attempt(SAFE).then(function(r){ if(r.error){ console.warn("[search] column fallback:", r.error.message||r.error); return attempt(SAFE_MIN); } return r; })
      .then(function(r){
        if(r.error){ console.error("[search] failed:", r.error); hint.textContent="Search error \u2014 please try again."; return; }
        var rows=(r.data||[]).map(normLost);
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
​
  var drop=document.getElementById("drop"), file=document.getElementById("file"), pout=document.getElementById("photoOut"), dropTxt=document.getElementById("dropTxt");
  drop.addEventListener("click",function(){ file.click(); });
  drop.addEventListener("dragover",function(e){ e.preventDefault(); drop.classList.add("drag"); });
  drop.addEventListener("dragleave",function(){ drop.classList.remove("drag"); });
  drop.addEventListener("drop",function(e){ e.preventDefault(); drop.classList.remove("drag"); if(e.dataTransfer.files[0]) identify(e.dataTransfer.files[0]); });
  file.addEventListener("change",function(){ if(file.files[0]) identify(file.files[0]); });
​
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
    window.__lastIdentify = data;
    console.log("[identify] raw response:", data);
    var arr = data && (data.matches || data.results || data.candidates || data.pets || (Array.isArray(data)?data:null)) || [];
    return arr.map(function(m){
      if(typeof m === "string") return { key:m, photo_path:null, score:null };
      var key = m.biometric_id || m.public_code || m.pet_id || m.petId || m.id || null;
      var path = m.photo_path || m.path || m.file || null;
      var sc = m.score!=null?m.score : (m.similarity!=null?m.similarity : (m.confidence!=null?m.confidence : (m.distance!=null?(1-m.distance) : (m.dist!=null?(1-m.dist):null))));
      return { key:key!=null?String(key):null, photo_path:path!=null?String(path):null, score:sc };
    }).filter(function(m){ return m.key || m.photo_path; }).slice(0,12);
  }
​
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function inList(col, vals){
    if(!vals.length) return null;
    var q = vals.map(function(v){ return '"'+String(v)+'"'; }).join(",");
    return col+".in.("+q+")";
  }
  function resolveMatches(matches){
    var uuids=[], codes=[], paths=[];
    matches.forEach(function(m){
      if(m.key){ if(UUID_RE.test(m.key)) uuids.push(m.key); else codes.push(m.key); }
      if(m.photo_path) paths.push(m.photo_path);
    });
    var parts=[];
    var pc=inList("public_code",codes); if(pc) parts.push(pc);
    var bi=inList("biometric_id",codes); if(bi) parts.push(bi);
    var idp=inList("id",uuids); if(idp) parts.push(idp);
    var pp=inList("photo_path",paths); if(pp) parts.push(pp);
    function attempt(cols){ var qy=sb.from("pets").select(cols); if(parts.length){ qy=qy.or(parts.join(",")); } return qy.limit(20); }
    attempt(SAFE).then(function(r){ if(r.error){ console.warn("[identify] column fallback:", r.error.message||r.error); return attempt(SAFE_MIN); } return r; })
      .then(function(r){
        if(r.error){ console.error("[identify] resolve error:", r.error); }
        var rows=(r.data||[]).map(normLost);
        rows.forEach(function(p){
          var m=matches.filter(function(x){ return x.key===p.public_code||x.key===p.biometric_id||x.key===String(p.id)||x.photo_path===p.photo_path; })[0];
          p.__score = m?m.score:null;
        });
        rows.sort(function(a,b){return (b.__score||0)-(a.__score||0);});
        if(!rows.length){
          var seen = codes.concat(uuids).slice(0,3).join(", ");
          pout.innerHTML='<div class="empty">We found a visual match'+(seen?' (<b>'+esc(seen)+'</b>)':'')+', but that dog isn\u2019t in the public database yet.</div>';
          return;
        }
        pout.innerHTML=rows.map(function(p){
          var pct = p.__score!=null ? (p.__score>1?Math.round(p.__score):Math.round(p.__score*100)) : null;
          var sc = pct!=null ? '<span class="score">'+pct+'% match</span>' : "";
          return petCard(p, sc);
        }).join("");
        wire(pout, rows);
      });
  }
​
  var lostOut=document.getElementById("lostOut"), lostHint=document.getElementById("lostHint"), lq=document.getElementById("lq");
  var LOST=[]; var myLoc=null;
  var LOST_FILTER="is_lost.eq.true,metadata->>isLost.eq.true";
  function lostAttempt(cols){ return sb.from("pets").select(cols).or(LOST_FILTER).limit(200); }
  function loadLost(){
    lostHint.style.display=""; lostHint.innerHTML='<span class="spinner"></span>';
    lostAttempt(SAFE).then(function(r){ if(r.error){ console.warn("[lost] column fallback:", r.error.message||r.error); return lostAttempt(SAFE_MIN); } return r; })
      .then(function(r){
        if(r.error){ console.error("[lost] failed:", r.error); lostHint.textContent="Couldn\u2019t load lost dogs."; return; }
        LOST=(r.data||[]).map(normLost).filter(function(p){return p.is_lost;});
        LOST.sort(function(a,b){ return new Date(b.lost_since||0)-new Date(a.lost_since||0); });
        renderLost(); subscribeLost();
      });
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
  function loadLostQuiet(){ lostAttempt(SAFE).then(function(r){ if(r.error){ return lostAttempt(SAFE_MIN); } return r; }).then(function(r){ LOST=(r.data||[]).map(normLost).filter(function(p){return p.is_lost;}); LOST.sort(function(a,b){ return new Date(b.lost_since||0)-new Date(a.lost_since||0); }); renderLost(); }); }
​
  var ov=document.getElementById("ov"), idcard=document.getElementById("idcard"), curPt=null, detailsBox=null;
  function ensureDetailsBox(){
    if(detailsBox) return detailsBox;
    detailsBox=document.createElement("div");
    detailsBox.id="petDetails";
    detailsBox.style.cssText="width:min(360px,86vw);background:#fff;border-radius:16px;max-height:44vh;overflow:auto;box-shadow:0 14px 34px rgba(0,0,0,.28)";
    var btns=ov.querySelector(".ovbtns");
    ov.insertBefore(detailsBox, btns);
    return detailsBox;
  }
  function drow(label,val){ if(val==null||val==="") return ""; return '<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 14px;border-bottom:1px solid #f0f1f8"><span style="color:#6B7192;font-size:13px">'+esc(label)+'</span><span style="font-weight:700;font-size:13px;text-align:right">'+esc(val)+'</span></div>'; }
  function yn(v){ return v==null?null:(v?"Yes":"No"); }
  function drowHtml(label,valHtml){ return '<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 14px;border-bottom:1px solid #f0f1f8"><span style="color:#6B7192;font-size:13px">'+esc(label)+'</span><span style="font-weight:700;font-size:13px;text-align:right">'+valHtml+'</span></div>'; }
  function sec(t){ return '<div style="padding:11px 14px 4px;font-weight:800;font-size:13px;border-top:6px solid #f4f5fb;margin-top:2px">'+esc(t)+'</div>'; }
  function renderMeta(pt){
    var box=document.getElementById("detailsMeta"); if(!box) return;
    var m=(pt.metadata&&typeof pt.metadata==="object")?pt.metadata:null; if(!m){ box.innerHTML=""; return; }
    var h="";
    var v=m.vitals||null, vit="";
    if(v){ vit+=drow("Microchip", v.microchip); vit+=drow("Weight", v.weight); vit+=drow("Vet", v.vetName||v.clinic); vit+=drow("Vet phone", v.vetPhone); }
    if(vit) h+=sec("Vitals")+vit;
    if(m.vax&&m.vax.length){ var vr=""; m.vax.slice(0,10).forEach(function(x){ vr+=drow(x.name||"Vaccine",(x.date?fmtDate(x.date):"")+(x.due?(" \u00b7 due "+fmtDate(x.due)):"")); }); if(vr) h+=sec("Vaccinations")+vr; }
    if(m.medical&&m.medical.length){ var mr=""; m.medical.slice(0,6).forEach(function(x){ mr+=drow(x.kind||"Note", x.text); }); if(mr) h+=sec("Medical notes")+mr; }
    if(m.docs&&m.docs.length){ var dr=""; m.docs.slice(0,12).forEach(function(x){ var nm=x.name||"Document"; var url=x.url||(x.path?photoUrl(x.path):null); dr+=drowHtml(nm, url?('<a href="'+esc(url)+'" target="_blank" style="color:#5B5BF0">Open</a>'):'<span style="color:#9aa2bd">on owner device</span>'); }); h+=sec("Documents ("+m.docs.length+")")+dr; }
    box.innerHTML=h;
  }
  function renderDetails(pt){
    var box=ensureDetailsBox();
    var h="";
    h+=drow("Status", pt.has_noseprint?"Noseprint verified":"Photo only");
    h+=drow("Type", pt.is_street?"Street dog":"Home pet");
    h+=drow("Species", cap(pt.species));
    h+=drow("Breed", pt.breed);
    h+=drow("Area", pt.area);
    h+=drow("Registered", pt.created_at?fmtDate(pt.created_at):null);
    if(pt.owner_phone && !pt.is_lost){ h+='<div style="padding:9px 14px"><a style="text-decoration:none;font-size:13px;padding:7px 13px;border-radius:999px;background:#12B886;color:#fff;font-weight:700" href="tel:'+esc(pt.owner_phone)+'">Call owner</a></div>'; }
    if(pt.is_lost){
      h+=drow("Reported lost", pt.lost_since?fmtDate(pt.lost_since):"Recently");
      h+=drow("Note", pt.lost_note);
      if(pt.owner_phone) h+='<div style="padding:11px 14px"><a class="pill red" style="text-decoration:none;font-size:13px;padding:8px 14px" href="tel:'+esc(pt.owner_phone)+'">\ud83d\udcde Call owner</a></div>';
    }
    box.innerHTML='<div style="padding:11px 14px 4px;font-weight:800;font-size:13px">Details</div>'+h+'<div id="petPhotos"></div><div id="detailsExtra"></div><div id="detailsMeta"></div>';
    loadPhotos(pt);
    loadExtra(pt);
    renderMeta(pt);
  }
  function loadPhotos(pt){
    var box=document.getElementById("petPhotos"); if(!box) return;
    var seen={}, list=[];
    function add(path,angle){ if(path && !seen[path]){ seen[path]=1; list.push({path:path,angle:angle||""}); } }
    add(pt.photo_path,"");
    var pEmb=sb.from("pet_embeddings").select("photo_path,angle").eq("pet_id",pt.id).then(function(r){ if(r.error){ console.warn("[photos] embeddings read failed:",r.error.message||r.error); return; } (r.data||[]).forEach(function(x){ add(x.photo_path,x.angle); }); });
    var pStor=sb.storage.from(C.BUCKET||"pet-media").list("pets/"+pt.id+"/photos",{limit:100}).then(function(r){ if(r.error){ console.warn("[photos] storage list failed:",r.error.message||r.error); return; } (r.data||[]).forEach(function(o){ if(o&&o.name&&o.name.indexOf(".emptyFolderPlaceholder")<0){ add("pets/"+pt.id+"/photos/"+o.name,""); } }); }).catch(function(e){ console.warn("[photos] storage ex",e); });
    Promise.all([pEmb,pStor]).then(function(){
      console.log("[photos] total photos for",pt.id,"=",list.length);
      if(list.length<2){ box.innerHTML=""; return; }
      box.innerHTML='<div style="padding:11px 14px 4px;font-weight:800;font-size:13px">All photos ('+list.length+')</div>'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:4px 12px 12px">'
        + list.map(function(p){ var u=photoUrl(p.path); return '<div class="gthumb" data-u="'+esc(u)+'" style="position:relative;cursor:pointer"><img src="'+esc(u)+'" alt="" loading="lazy" style="width:100%;height:76px;object-fit:cover;border-radius:8px;display:block"/>'+(p.angle?'<span style="position:absolute;left:5px;bottom:5px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px">'+esc(p.angle)+'</span>':'')+'</div>'; }).join("")
        + '</div>';
      box.querySelectorAll(".gthumb").forEach(function(el){ el.onclick=function(){ var ph=idcard.querySelector(".ph"); if(ph){ ph.style.backgroundImage="url('"+el.dataset.u+"')"; ph.style.fontSize="0"; } }; });
    });
  }
  function loadExtra(pt){
    var table = pt.is_street ? "street_profiles" : "owned_profiles";
    sb.from(table).select("*").eq("pet_id", pt.id).limit(1).then(function(r){
      if(r.error || !r.data || !r.data[0]) return;
      var d=r.data[0], box=document.getElementById("detailsExtra"); if(!box) return;
      var h="";
      if(pt.is_street){
        h+=drow("NGO", d.ngo_name);
        h+=drow("Caretaker", d.caretaker_phone);
        h+=drow("Colony", d.colony_area);
        h+=drow("Sterilized", yn(d.sterilized));
        h+=drow("Ear notch", yn(d.ear_notch));
        h+=drow("Rabies vaccinated", yn(d.rabies_vaccinated));
        h+=drow("Rabies date", d.rabies_date?fmtDate(d.rabies_date):null);
        h+=drow("Dewormed", yn(d.dewormed));
      } else {
        h+=drow("Sex", d.sex);
        h+=drow("Date of birth", d.dob?fmtDate(d.dob):null);
        if(d.breed) h+=drow("Breed", d.breed);
      }
      if(h) box.innerHTML='<div style="border-top:6px solid #f4f5fb"></div>'+h;
    });
  }
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
    renderDetails(pt);
    ov.classList.add("show");
    if(history.pushState){ history.pushState({card:1},""); }
  }
  function closeCard(){ ov.classList.remove("show"); curPt=null; if(detailsBox) detailsBox.innerHTML=""; }
  document.getElementById("ovClose").onclick=function(){ if(history.state&&history.state.card) history.back(); else closeCard(); };
  ov.addEventListener("click",function(e){ if(e.target===ov){ if(history.state&&history.state.card) history.back(); else closeCard(); } });
  window.addEventListener("popstate",function(){ if(ov.classList.contains("show")) closeCard(); });
  document.getElementById("ovShare").onclick=function(){
    if(!curPt) return;
    var url=cardLink(curPt);
    var text=(curPt.name||"This dog")+" \u00b7 KYP ID "+code(curPt)+(curPt.is_lost?" \u2014 REPORTED LOST":"")+"\n"+url;
    if(navigator.share){ navigator.share({title:"KYP Pet ID",text:text,url:url}); }
    else if(navigator.clipboard){ navigator.clipboard.writeText(text); document.getElementById("ovShare").textContent="\u2705 Copied"; setTimeout(function(){document.getElementById("ovShare").innerHTML="\ud83d\udce4 Share";},1400); }
  };
})();
