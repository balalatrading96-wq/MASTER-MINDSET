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