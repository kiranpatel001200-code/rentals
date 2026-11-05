/* Show / Hide button inside every password field on the page. */
(function(){
  var css = document.createElement("style");
  css.textContent =
    ".pw-wrap{position:relative;display:block}" +
    ".pw-wrap input{padding-right:70px}" +
    ".pw-wrap button.pw-btn{position:absolute;top:50%;right:6px;transform:translateY(-50%);width:auto;margin:0;padding:6px 10px;background:transparent;color:#0b7a6e;border:0;border-radius:8px;font:600 .85rem system-ui,sans-serif;cursor:pointer}" +
    ".pw-wrap button.pw-btn:hover{background:#e9f6f3}";
  document.head.appendChild(css);

  function wrap(input){
    if(input.parentNode.classList && input.parentNode.classList.contains("pw-wrap")) return;
    var box = document.createElement("span"); box.className = "pw-wrap";
    input.parentNode.insertBefore(box, input); box.appendChild(input);
    var b = document.createElement("button"); b.type = "button"; b.className = "pw-btn";
    b.textContent = "Show"; b.setAttribute("aria-label", "Show password"); b.setAttribute("aria-pressed", "false");
    b.onclick = function(){
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      b.textContent = show ? "Hide" : "Show";
      b.setAttribute("aria-label", show ? "Hide password" : "Show password");
      b.setAttribute("aria-pressed", show ? "true" : "false");
      input.focus();
    };
    box.appendChild(b);
  }
  function run(){ Array.prototype.forEach.call(document.querySelectorAll("input[type=password]"), wrap); }
  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", run); } else { run(); }
})();
