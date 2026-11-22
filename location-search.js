/* RenterHere low-cost US location autocomplete.
   Uses the public Photon/OSM demo service conservatively: one request/second per visitor,
   only after 3 characters, with in-session caching. Best-effort service; manual search remains available. */
(function(){
  "use strict";
  var forms = document.querySelectorAll("form.search, #f");
  if(!forms.length) return;
  var cache = Object.create(null), timer = null, controller = null, active = -1;
  function make(tag, cls, txt){ var n=document.createElement(tag); if(cls)n.className=cls; if(txt!==undefined)n.textContent=txt; return n; }
  function stateName(p){ return p.statecode || p.state || ""; }
  function buildLabel(p){
    var bits=[];
    if(p.housenumber && p.street) bits.push(p.housenumber+" "+p.street);
    else if(p.street) bits.push(p.street);
    if(p.city) bits.push(p.city);
    else if(p.name && !p.street) bits.push(p.name);
    var st=stateName(p); if(st) bits.push(st);
    if(p.postcode && bits.indexOf(p.postcode)<0) bits.push(p.postcode);
    return bits.join(", ") || p.name || p.label || "";
  }
  function queryValue(p){
    if(p.housenumber || p.street) return buildLabel(p);
    if(p.postcode) return p.postcode;
    var city=p.city || p.name || "";
    var st=stateName(p);
    return city && st ? city+", "+st : buildLabel(p);
  }
  function close(box){ box.hidden=true; box.replaceChildren(); box._items=[]; active=-1; }
  function navigate(form, input, place){
    var params=new URLSearchParams();
    params.set("q", queryValue(place));
    params.set("near", place.lat.toFixed(6)+","+place.lng.toFixed(6));
    params.set("geo","1");
    if(stateName(place.props)) params.set("state",stateName(place.props));
    var beds=form.querySelector('[name="bedrooms"],#beds');
    var type=form.querySelector('[name="type"],#ptype');
    if(beds && beds.value) params.set("bedrooms",beds.value);
    if(type && type.value) params.set("type",type.value);
    var sort=form.querySelector("#sort"); if(sort && sort.value!=="near") params.set("sort",sort.value);
    location.href="listings.html?"+params.toString();
  }
  function setup(form){
    var input=form.querySelector('input[name="city"],#city');
    if(!input) return;
    input.setAttribute("autocomplete","off");
    input.setAttribute("aria-autocomplete","list");
    var wrap=make("div","rn-location-wrap"); input.parentNode.insertBefore(wrap,input); wrap.appendChild(input);
    var box=make("div","rn-location-suggestions"); box.hidden=true; box.setAttribute("role","listbox"); wrap.appendChild(box);
    var lastRequest=0, selected=null;
    function choose(item){ selected=item; input.value=item.label; close(box); input.dataset.rnSelected="1"; input.dispatchEvent(new Event("change",{bubbles:true})); if(form.matches(".search")) navigate(form,input,item); }
    function render(items){
      close(box); box._items=items;
      items.forEach(function(item,i){
        var b=make("button","rn-location-option");
        b.type="button"; b.setAttribute("role","option");
        b.appendChild(make("span","rn-location-main",item.label));
        b.appendChild(make("small","rn-location-sub",item.sub));
        b.addEventListener("mousedown",function(e){e.preventDefault();choose(item);});
        box.appendChild(b);
      });
      if(items.length) box.hidden=false;
    }
    async function search(q){
      if(controller) controller.abort();
      controller=new AbortController();
      var now=Date.now(), wait=Math.max(0,1000-(now-lastRequest));
      if(wait) await new Promise(function(resolve){setTimeout(resolve,wait);});
      if(input.value.trim()!==q || q.length<3) return;
      lastRequest=Date.now();
      try{
        var url="https://photon.komoot.io/api/?q="+encodeURIComponent(q)+"&lat=37.0902&lon=-95.7129&limit=7&lang=en";
        var res=await fetch(url,{signal:controller.signal,headers:{"Accept":"application/json"}});
        if(!res.ok) throw new Error("Location suggestions unavailable");
        var data=await res.json(), seen=Object.create(null), items=[];
        (data.features||[]).forEach(function(f){
          var p=f.properties||{}, c=f.geometry&&f.geometry.coordinates;
          if(!c || !isFinite(c[0]) || !isFinite(c[1]) || c[1]<17 || c[1]>72 || c[0]<-180 || c[0]>-60) return;
          if((p.countrycode||"").toLowerCase()!=="us") return;
          var label=buildLabel(p); if(!label) return;
          var key=label.toLowerCase(); if(seen[key]) return; seen[key]=true;
          var sub=[p.type,p.county,p.country].filter(Boolean).join(" · ");
          items.push({label:label,sub:sub,lat:Number(c[1]),lng:Number(c[0]),props:p});
        });
        render(items);
        if(!items.length){ box.appendChild(make("div","rn-location-empty","No matching US locations. You can still search manually.")); box.hidden=false; }
      }catch(e){ if(e.name!=="AbortError"){ close(box); } }
    }
    input.addEventListener("input",function(){
      selected=null; input.dataset.rnSelected="";
      var q=input.value.trim(); if(q.length<3){ if(controller)controller.abort(); close(box); return; }
      if(timer)clearTimeout(timer); timer=setTimeout(function(){search(q);},350);
    });
    input.addEventListener("keydown",function(e){
      var items=box._items||[];
      if(e.key==="ArrowDown" && !box.hidden){e.preventDefault();active=Math.min(active+1,items.length-1);Array.from(box.children).forEach(function(n,i){n.classList.toggle("active",i===active);});}
      else if(e.key==="ArrowUp" && !box.hidden){e.preventDefault();active=Math.max(active-1,0);Array.from(box.children).forEach(function(n,i){n.classList.toggle("active",i===active);});}
      else if(e.key==="Enter" && !box.hidden && items.length){e.preventDefault();choose(items[Math.max(0,active)]);}
      else if(e.key==="Escape") close(box);
    });
    document.addEventListener("click",function(e){if(!wrap.contains(e.target))close(box);});
    if(form.id==="f"){
      form.addEventListener("submit",function(e){
        var item=selected;
        if(item){e.preventDefault();navigate(form,input,item);}
      },true);
    }
  }
  Array.prototype.forEach.call(forms,setup);
})();