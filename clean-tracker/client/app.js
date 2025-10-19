/* app.js — client logic shared across pages */
    (function(){
      const STORAGE = 'clean_tracker_v2';
      const GOAL = 82;
      const $ = id => document.getElementById(id);

      function todayISO(d=new Date()){ return d.toISOString().slice(0,10); }

      function load(){ try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')}catch(e){return {}} }
      function save(state){ localStorage.setItem(STORAGE, JSON.stringify(state)); }

      function getEntries(){ const s = load(); return s.entries||{} }
      function setEntry(date, type, note){ const s = load(); s.entries = s.entries || {}; s.entries[date] = {type, note: note||''}; save(s); }
      function removeEntry(date){ const s = load(); if(s.entries && s.entries[date]){ delete s.entries[date]; save(s); } }

      function updateClock(){ const now=new Date(); const yearStart=new Date(now.getFullYear(),0,1); const yearEnd=new Date(now.getFullYear(),11,31,23,59,59,999); const total = yearEnd-yearStart; const passed = now - yearStart; const remaining = Math.max(0, yearEnd - now);
        if($('days')) $('days').textContent = Math.floor(remaining/(1000*60*60*24));
        if($('hours')) $('hours').textContent = String(Math.floor((remaining%(1000*60*60*24))/(1000*60*60))).padStart(2,'0');
        if($('minutes')) $('minutes').textContent = String(Math.floor((remaining%(1000*60*60))/(1000*60))).padStart(2,'0');
        if($('seconds')) $('seconds').textContent = String(Math.floor((remaining%(1000*60))/1000)).padStart(2,'0');
        const pct = Math.min(100, Math.round((passed/total)*100)); if($('yearbar')) $('yearbar').style.width = pct + '%';
      }
      setInterval(updateClock,1000); updateClock();

      if($('markClean')){
        $('markClean').addEventListener('click', ()=>{ setEntry(todayISO(),'clean',''); renderHome(); });
      }
      if($('markNotClean')){
        $('markNotClean').addEventListener('click', ()=>{ const reason = prompt('Quick reason (optional):'); setEntry(todayISO(),'not', reason||''); renderHome(); });
      }

      if($('exportBtn')){
        $('exportBtn').addEventListener('click', ()=>{ const data = localStorage.getItem(STORAGE) || '{}'; const blob = new Blob([data],{type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'clean-tracker-export.json'; a.click(); URL.revokeObjectURL(url); });
      }
      if($('importBtn')){
        $('importBtn').addEventListener('click', ()=> $('fileInput').click());
        $('fileInput').addEventListener('change', (e)=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload = ()=>{ try{ const parsed = JSON.parse(r.result); if(parsed.entries){ localStorage.setItem(STORAGE, JSON.stringify(parsed)); alert('Import successful'); renderHome(); } else alert('Invalid file'); } catch(e){ alert('Failed to parse file'); } }; r.readAsText(f); });
      }

      if($('clearAll')) $('clearAll').addEventListener('click', ()=>{ if(confirm('Clear all data?')){ localStorage.removeItem(STORAGE); renderHome(); } });

      function renderHome(){
        const entries = getEntries();
        const dates = Object.keys(entries).sort();
        const cleanCount = dates.filter(d=>entries[d].type==='clean').length;
        const notCount = dates.filter(d=>entries[d].type==='not').length;
        if($('cleanCount')) $('cleanCount').textContent = cleanCount;
        if($('notCleanCount')) $('notCleanCount').textContent = notCount;
        if($('remaining82')) $('remaining82').textContent = Math.max(0, GOAL - cleanCount);

        if($('timeline')){
          const tl = $('timeline'); tl.innerHTML=''; for(let i=GOAL-1;i>=0;i--){ const d = new Date(); d.setDate(d.getDate()-i); const s = todayISO(d); const el = document.createElement('div'); const obj = entries[s]; el.className = 'dot ' + (obj ? (obj.type==='clean'?'clean':'not') : 'empty'); el.title = s + (obj?(' • '+obj.type+(obj.note?': '+obj.note:'')):' • no entry'); tl.appendChild(el); }
        }

        if($('historyList')){
          const list = $('historyList'); list.innerHTML=''; const sorted = dates.slice().sort((a,b)=>b.localeCompare(a)); if(sorted.length===0) list.innerHTML = '<div class="muted">No entries yet.</div>';
          sorted.forEach(d=>{ const item = entries[d]; const div = document.createElement('div'); div.className = 'entry'; div.innerHTML = `<div><strong>${d}</strong> — ${item.type} <div class="muted">${item.note||''}</div></div>`; list.appendChild(div); });
        }
      }

      if($('entryForm')){
        const form = $('entryForm'); const dateInput = $('entryDate'); dateInput.value = todayISO(); form.addEventListener('submit', (e)=>{ e.preventDefault(); setEntry(dateInput.value, $('entryType').value, $('entryNote').value.trim()); location.href = 'index.html'; });
        $('cancelBtn').addEventListener('click', ()=> location.href='index.html');
      }

      if($('enablePush')){
        $('enablePush').addEventListener('click', async ()=>{
          if(!('serviceWorker' in navigator)) return alert('Service workers not supported');
          try{
            const reg = await navigator.serviceWorker.register('/sw.js');
            const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: window.VAPID_PUBLIC_KEY });
            await fetch('/api/subscribe',{method:'POST',headers:{'content-type':'application/json'},body: JSON.stringify({subscription: sub})});
            alert('Push enabled');
          }catch(e){ console.error(e); alert('Push enable failed: '+e.message); }
        });
      }

      if($('emailForm')){
        $('emailForm').addEventListener('submit', async (e)=>{ e.preventDefault(); const email = $('reminderEmail').value.trim(); if(!email) return alert('Enter email'); try{ const res = await fetch('/api/register-email',{method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({email})}); const j = await res.json(); if(j.success) alert('Registered for daily reminders'); else alert('Failed'); }catch(e){ alert('Server error'); }});
      }

      if($('authForm')){
        $('authForm').addEventListener('submit', async (e)=>{ e.preventDefault(); const email = $('authEmail').value.trim(); if(!email) return alert('Enter email'); try{ const res = await fetch('/api/send-magic-link',{method:'POST',headers:{'content-type':'application/json'},body: JSON.stringify({email})}); const j = await res.json(); if(j.ok) alert('Magic link sent to email'); else alert('Failed to send'); }catch(e){ alert('Server error'); } });
      }

      if($('historyList') || $('timeline')) renderHome();

      window.VAPID_PUBLIC_KEY = window.VAPID_PUBLIC_KEY || null;

    })();