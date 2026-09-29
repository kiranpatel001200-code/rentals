const SAMPLE=[
{id:"1",title:"Sunny 2 bedroom near downtown",city:"Austin",state:"TX",zip:"78704",rent:1850,beds:2,baths:1,type:"Apartment",furnished:true,available:"2026-10-15",desc:"Corner unit with a private balcony, in-unit laundry and a five minute walk to the South Congress shops.",amen:["Laundry","Parking","Balcony"]},
{id:"2",title:"Quiet studio with city views",city:"Los Angeles",state:"CA",zip:"90012",rent:1650,beds:0,baths:1,type:"Studio",furnished:false,available:"2026-11-01",desc:"Top floor studio in a 1930s building. Hardwood floors, big windows and a short walk to the Metro.",amen:["Air conditioning","Elevator"]},
{id:"3",title:"3 bedroom family house with yard",city:"Miami",state:"FL",zip:"33133",rent:3400,beds:3,baths:2,type:"House",furnished:false,available:"2026-10-20",desc:"Fenced backyard, two car garage and a renovated kitchen on a tree lined street.",amen:["Garage","Yard","Pets allowed"]},
{id:"4",title:"Furnished 1 bedroom in Brooklyn",city:"Brooklyn",state:"NY",zip:"11211",rent:2900,beds:1,baths:1,type:"Apartment",furnished:true,available:"2026-10-10",desc:"Fully furnished, utilities included, steps from the L train and Bedford Avenue cafes.",amen:["Furnished","Utilities included"]},
{id:"5",title:"Bright 2 bedroom townhome",city:"Denver",state:"CO",zip:"80205",rent:2450,beds:2,baths:2,type:"Townhome",furnished:false,available:"2026-12-01",desc:"Two story townhome with a rooftop deck, attached garage and mountain views.",amen:["Garage","Rooftop deck","Dishwasher"]}];
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"$"+Number(n).toLocaleString("en-US");
function all(){let u=[];try{u=JSON.parse(localStorage.getItem("rn_listings")||"[]")}catch(e){}return SAMPLE.concat(u)}
const bd=n=>n==0?"Studio":n+" bd";
function card(l){return `<a class="card" href="listing.html?id=${esc(l.id)}"><div class="ph">${esc(l.type)}</div><div class="cb"><div class="price">${money(l.rent)}/mo</div><h3>${esc(l.title)}</h3><p>${bd(l.beds)}, ${esc(l.baths)} ba in ${esc(l.city)}, ${esc(l.state)}</p></div></a>`}
$("#nav").innerHTML=`<header><div class="wrap"><a class="logo" href="index.html">RentNest</a><nav><a href="listings.html">Browse rentals</a><a href="about.html">About</a><a href="contact.html">Contact</a><a class="btn" href="create-listing.html">List your property</a></nav></div></header>`;
$("#footer").innerHTML=`<footer><div class="wrap"><a href="listings.html">Browse rentals</a><a href="create-listing.html">List your property</a><a href="about.html">About</a><a href="contact.html">Contact</a><p>&copy; ${new Date().getFullYear()} RentNest. Rentals across the United States.</p></div></footer>`;
const page=document.body.dataset.page;
if(page==="home"){$("#featured").innerHTML=all().slice(0,3).map(card).join("")}
if(page==="listings"){
 const q=new URLSearchParams(location.search);
 ["city","beds","max"].forEach(k=>{if(q.get(k))$("#"+k).value=q.get(k)});
 const draw=()=>{const c=$("#city").value.trim().toLowerCase(),b=$("#beds").value,m=$("#max").value;
  const r=all().filter(l=>(!c||(l.city+" "+l.state).toLowerCase().includes(c))&&(b===""||(b==="3"?l.beds>=3:l.beds==b))&&(!m||l.rent<=m));
  $("#count").textContent=r.length+(r.length==1?" rental":" rentals");
  $("#results").innerHTML=r.length?r.map(card).join(""):"<p>No rentals match these filters. Clear the city or raise the maximum rent.</p>"};
 document.querySelectorAll(".filters input,.filters select").forEach(e=>e.addEventListener("input",draw));draw()}
if(page==="detail"){
 const l=all().find(x=>x.id===new URLSearchParams(location.search).get("id"));
 if(!l){$("#detail").innerHTML="<p>This listing was not found. <a href='listings.html'>Browse all rentals</a>.</p>"}
 else{document.title=l.title+" | RentNest";
  $("#detail").innerHTML=`<div><div class="ph">${esc(l.type)}</div><h1>${esc(l.title)}</h1><p class="note">${esc(l.city)}, ${esc(l.state)} ${esc(l.zip||"")}</p><div class="facts"><span>${bd(l.beds)}</span><span>${esc(l.baths)} bath</span><span>${esc(l.type)}</span><span>${l.furnished?"Furnished":"Unfurnished"}</span><span>Available ${esc(l.available)}</span></div><h2>About this rental</h2><p>${esc(l.desc)}</p><h2>Amenities</h2><div class="facts">${(l.amen||[]).map(a=>`<span>${esc(a)}</span>`).join("")||"<span>None listed</span>"}</div></div>
  <aside><div class="form"><div class="price">${money(l.rent)}/mo</div><form data-demo="Message sent. The landlord will reply by email."><label for="n">Your name</label><input id="n" required><label for="e">Email</label><input id="e" type="email" required><label for="m">Message</label><textarea id="m" rows="4" required>Hi, is this rental still available?</textarea><p><button>Message landlord</button></p></form></div></aside>`}}
if(page==="create"){$("#create").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.target),g=k=>f.get(k).trim();
 const l={id:"u"+Date.now(),title:g("title"),city:g("city"),state:g("state").toUpperCase(),zip:g("zip"),rent:+f.get("rent"),beds:+f.get("beds"),baths:+f.get("baths"),type:f.get("type"),furnished:f.get("furnished")==="yes",available:f.get("available"),desc:g("desc"),amen:g("amen").split(",").map(s=>s.trim()).filter(Boolean)};
 let u=[];try{u=JSON.parse(localStorage.getItem("rn_listings")||"[]")}catch(x){}u.push(l);localStorage.setItem("rn_listings",JSON.stringify(u));location.href="listing.html?id="+l.id})}
document.querySelectorAll("form[data-demo]").forEach(f=>f.addEventListener("submit",e=>{e.preventDefault();f.outerHTML=`<p class="ok">${esc(f.dataset.demo)}</p>`}));
