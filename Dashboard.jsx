import React, {useEffect, useState} from 'react';
import { syncDownload, syncUpload } from '../lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { loadLocal, saveLocal, mergeWithServer } from '../lib/storage';

export default function Dashboard() {
  const [entries, setEntries] = useState({});
  const [weeklyData, setWeeklyData] = useState([]);

  useEffect(()=> {
    const local = loadLocal();
    setEntries(local);
    // try to sync
    (async ()=> {
      try {
        const res = await syncDownload();
        const server = res.data.entries || {};
        const merged = mergeWithServer(local, server);
        setEntries(merged);
        saveLocal(merged);
        // push merged back to server
        await syncUpload(merged);
        computeWeekly(merged);
      } catch(e) {
        computeWeekly(local);
      }
    })();
  },[]);

  function computeWeekly(data){
    // produce simple weekly counts
    const counts = [];
    // last 8 weeks
    const now = new Date();
    for(let w=7; w>=0; w--){
      const start = new Date(now); start.setDate(now.getDate() - (w*7));
      let clean=0;
      for(let i=0;i<7;i++){
        const d = new Date(start); d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0,10);
        if (data[key] && data[key].type === 'clean') clean++;
      }
      counts.push({ week: `W-${7-w}`, clean});
    }
    setWeeklyData(counts);
  }

  async function exportPDF(){
    const doc = new jsPDF('p','pt','a4');
    const node = document.getElementById('report');
    const canvas = await html2canvas(node, { scale: 2 });
    const img = canvas.toDataURL('image/png');
    const w = doc.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    doc.addImage(img, 'PNG', 0, 0, w, h);
    doc.save('clean-tracker-report.pdf');
  }

  return (
    <div className="dashboard card">
      <h2>Dashboard</h2>
      <div id="report">
        <div>Summary: clean days {Object.values(entries).filter(e=>e.type==='clean').length}</div>
        <div style={{height:250}}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData}>
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="clean" stroke="#60a5fa" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{marginTop:10}}>
        <button className="btn primary" onClick={exportPDF}>Export Dashboard as PDF</button>
      </div>
    </div>
  );
}
