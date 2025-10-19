// Minimal server that supports: subscribe, register-email, send-magic-link (email), export/import per-user (optional)
    const express = require('express');
    const bodyParser = require('body-parser');
    const webpush = require('web-push');
    const nodemailer = require('nodemailer');
    const cors = require('cors');
    const { Low, JSONFile } = require('lowdb');
    require('dotenv').config();

    const app = express();
    app.use(cors());
    app.use(bodyParser.json());
    app.use(express.static('public'));

    const dbFile = './db.json';
    const adapter = new JSONFile(dbFile);
    const db = new Low(adapter);

    async function initDB(){ await db.read(); db.data = db.data || { subscriptions: [], emails: [], users: {} }; await db.write(); }
    initDB();

    if(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE){ webpush.setVapidDetails('mailto:' + (process.env.EMAIL_FROM || 'no-reply@example.com'), process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE); }

    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT||587), secure:false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }});

    app.post('/api/subscribe', async (req,res)=>{
      const sub = req.body.subscription; if(!sub) return res.status(400).json({error:'no subscription'});
      await db.read(); db.data.subscriptions.push(sub); await db.write(); res.json({success:true});
    });

    app.post('/api/register-email', async (req,res)=>{ const {email} = req.body; if(!email) return res.status(400).json({error:'email required'}); await db.read(); db.data.emails.push({email, created: Date.now()}); await db.write(); res.json({success:true}); });

    app.post('/api/send-push', async (req,res)=>{ const payload = req.body.payload || {title:'Reminder', body:'Open your tracker'}; await db.read(); const subs = db.data.subscriptions || []; const results = [];
      await Promise.all(subs.map(async (s)=>{ try{ await webpush.sendNotification(s, JSON.stringify(payload)); results.push({ok:true}); } catch(e){ results.push({ok:false, error:e.message}); } })); res.json({results});
    });

    app.post('/api/send-magic-link', async (req,res)=>{ const {email} = req.body; if(!email) return res.status(400).json({error:'Email required'});
      const token = Math.random().toString(36).slice(2,12);
      await db.read(); db.data.users = db.data.users || {}; db.data.users[email] = { token, tokenExpires: Date.now() + 1000*60*60 }; await db.write();
      const link = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify?email=${encodeURIComponent(email)}&token=${token}`;
      try{
        await transporter.sendMail({ from: process.env.EMAIL_FROM, to: email, subject: 'Your sign-in link', html: `<p>Click to sign in: <a href="${link}">${link}</a></p>`});
        res.json({ok:true});
      }catch(e){ res.status(500).json({error:'mail-failed', details:e.message}); }
    });

    app.post('/api/send-daily-emails', async (req,res)=>{ await db.read(); const list = db.data.emails || []; const results = [];
      for(const r of list){ try{ await transporter.sendMail({ from: process.env.EMAIL_FROM, to: r.email, subject: 'Daily reminder', html: `<p>Open your tracker: <a href="${process.env.APP_URL || 'http://localhost:3000'}">Open tracker</a></p>`}); results.push({email:r.email, ok:true}); }catch(e){ results.push({email:r.email, ok:false, error:e.message}); } }
      res.json({results});
    });

    const PORT = process.env.PORT || 3000; app.listen(PORT, ()=> console.log('Server running on', PORT));
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const webpush = require('web-push');
const { sendMagicLinkEmail } = require('./routes/auth'); // helper below
const prisma = new PrismaClient();
const app = express();
app.use(cors()); app.use(express.json());

// configure webpush
if(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE){
  webpush.setVapidDetails(`mailto:${process.env.EMAIL_FROM}`, process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
}

// simple auth middleware
function authRequired(req,res,next){
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({error:'no auth'});
  const token = h.split(' ')[1];
  try{
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  }catch(e){ return res.status(401).json({error:'invalid token'}); }
}

// Endpoints

// 1) Magic link: request
app.post('/api/auth/magic-link', async (req,res)=>{
  const { email } = req.body;
  if(!email) return res.status(400).json({error:'email required'});
  // create or upsert user, generate token
  const token = Math.random().toString(36).slice(2,14);
  const tokenExp = new Date(Date.now()+1000*60*30); // 30 mins
  let user = await prisma.user.upsert({
    where: { email },
    update: { token, tokenExp },
    create: { email, token, tokenExp }
  });
  // send email
  await sendMagicLinkEmail(email, token);
  res.json({ok:true});
});

// 2) verify magic link (user clicks link -> front will call this route)
app.post('/api/auth/verify', async (req,res)=>{
  const { email, token } = req.body;
  if(!email || !token) return res.status(400).json({error:'missing'});
  const user = await prisma.user.findUnique({ where: { email }});
  if(!user || user.token !== token || user.tokenExp < new Date()) return res.status(400).json({error:'invalid token'});
  // create JWT
  const jwtToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
  // clear token
  await prisma.user.update({ where:{id:user.id}, data:{ token: null, tokenExp: null }});
  res.json({ token: jwtToken, user: { id: user.id, email: user.email }});
});

// 3) Sync endpoints
app.post('/api/entries/sync', authRequired, async (req,res)=>{
  const userId = req.user.id;
  const entries = req.body.entries || {};
  // upsert entries per-date for the user
  for(const date of Object.keys(entries)){
    const e = entries[date];
    // find existing
    const existing = await prisma.entry.findFirst({ where: { date, userId }});
    if(existing){
      await prisma.entry.update({ where: { id: existing.id }, data: { type: e.type, note: e.note || null, modifiedAt: new Date() }});
    } else {
      await prisma.entry.create({ data: { date, type: e.type, note: e.note || null, userId }});
    }
  }
  res.json({ ok:true });
});

app.get('/api/entries/sync', authRequired, async (req,res)=>{
  const userId = req.user.id;
  const rows = await prisma.entry.findMany({ where: { userId }});
  const obj = {};
  rows.forEach(r => { obj[r.date] = { type: r.type, note: r.note, modifiedAt: r.modifiedAt }; });
  res.json({ entries: obj });
});

// 4) register email for daily reminders
app.post('/api/register-email', authRequired, async (req,res)=>{
  const { email } = req.body;
  // store in a simple table or 3rd party list; simplified: store in DB users table as preferences (omitted)
  res.json({ success: true });
});

// 5) webpush subscribe (store subscription payload)
app.post('/api/subscribe', authRequired, async (req,res)=>{
  const sub = req.body.subscription;
  // store subscription in DB (omitted minimal)
  res.json({ success:true });
});

// Extra admin route to send push (for testing)
app.post('/api/admin/send-push', async (req,res)=>{
  const payload = req.body.payload || { title:'Reminder', body:'Open your tracker' };
  // iterate stored subs (omitted) - here just respond ok
  res.json({ ok:true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server listening', PORT));
