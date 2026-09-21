/* Halftone offline worker.
   The page has always registered this file; it was never shipped, so every
   registration failed silently and the app had no offline story at all - in a
   building where the whole point is that your phone has no signal.

   Two rules, chosen so a stale cache can never strand you on an old build:

   - index.html and the manifest go to the NETWORK FIRST. An update always
     lands on the next load that has signal; the cache is only the answer when
     the network has none. A cache-first shell is how a PWA gets stuck showing
     a version you replaced weeks ago.
   - The demonstrations and icons go CACHE FIRST. They are content-addressed by
     name and never change - re-fetching 3.5 MB of GIFs over gym wifi to get
     bytes we already hold is the thing worth avoiding.

   Anything unexpected falls through to the network untouched. A worker that
   throws must not be able to take the app down with it. */

/* Bump V whenever a CACHE-FIRST asset changes - the icons, or any demo file
   replaced under a name it already had. Activate deletes every cache that is
   not the current V, so the new bytes are fetched once and kept. Without the
   bump an installed phone keeps serving the old icons forever: cache-first is
   exactly what it says, and index.html being network-first does not help the
   files it references. */
var V='halftone-v2',
    EAGER=['./index.html','./manifest.webmanifest','./favicon-32.png','./apple-touch-icon.png'];

self.addEventListener('install',function(e){
 /* Only the shell is precached. Pulling all 33 clips down on first visit would
    cost megabytes before anyone asked for one; they are cached as they are
    actually used, which for most people is their own six lifts. */
 e.waitUntil(caches.open(V).then(function(c){
  return Promise.all(EAGER.map(function(u){
   return c.add(new Request(u,{cache:'reload'}))['catch'](function(){});}));
 })['catch'](function(){}));
});

self.addEventListener('activate',function(e){
 e.waitUntil(caches.keys().then(function(ks){
  return Promise.all(ks.map(function(k){return k===V?null:caches['delete'](k);}));
 }).then(function(){return self.clients.claim();})['catch'](function(){}));
});

function isShell(url){
 var p=url.pathname.replace(/^.*\//,'');
 return p===''||p==='index.html'||p==='manifest.webmanifest';
}
function isAsset(url){return /\.(gif|png|webmanifest|ico)$/i.test(url.pathname);}

self.addEventListener('fetch',function(e){
 var req=e.request;
 if(req.method!=='GET')return;
 var url;
 try{url=new URL(req.url);}catch(err){return;}
 if(url.origin!==self.location.origin)return;   /* fonts and anything else: not ours */

 if(isShell(url)){
  e.respondWith(
   fetch(req).then(function(res){
    if(res&&res.ok){var copy=res.clone();
     caches.open(V).then(function(c){c.put(req,copy);})['catch'](function(){});}
    return res;
   })['catch'](function(){
    return caches.match(req).then(function(hit){
     return hit||caches.match('./index.html');
    });
   }));
  return;
 }

 if(isAsset(url)){
  e.respondWith(
   caches.match(req).then(function(hit){
    if(hit)return hit;
    return fetch(req).then(function(res){
     /* an error response is never cached: a 404 stored now is a permanently
        missing demonstration later, which is exactly the failure this whole
        change set started with */
     if(res&&res.ok){var copy=res.clone();
      caches.open(V).then(function(c){c.put(req,copy);})['catch'](function(){});}
     return res;
    });
   })['catch'](function(){return caches.match(req);}));
 }
});

/* The page can ask the worker to step aside for an update rather than waiting
   for every tab to close. */
self.addEventListener('message',function(e){
 try{if(e.data&&e.data.type==='skip-waiting')self.skipWaiting();}catch(err){}
});
