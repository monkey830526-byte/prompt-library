#!/usr/bin/env node
/*
 * 提詞庫 — 口播投稿腳本
 * 用法：node add-voiceover.js <口播.json>
 *   輸入可為「單篇物件」或「多篇陣列」
 *   會自動補齊欄位、加入 data.json 最前面、並 git commit + push
 *
 * 輸入 JSON 欄位（只有 title 與 voiceover 必填，其餘選填）：
 * {
 *   "title": "標題",
 *   "source": "https://...",              // 來源連結（會驗證 http/https）
 *   "voiceover": "【0:00】...",            // 口播稿全文（必填）
 *   "editing": "剪輯對照表純文字...",        // 選填
 *   "notes": "備註 / 心理學配方 / 查核摘要", // 選填
 *   "factCheck": "pending|verified|na",    // 預設 pending
 *   "tags": ["標籤1","標籤2"],              // 選填
 *   "platforms": { "tiktok":"", "youtube":"", "ig":"", "threads":"", "fb":"" }
 * }
 */
const fs=require('fs');
const path=require('path');
const {execSync}=require('child_process');

const REPO=path.resolve(__dirname,'..');
const DATA=path.join(REPO,'data.json');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const FC=['pending','verified','na'];

const inputPath=process.argv[2];
if(!inputPath){console.error('用法: node add-voiceover.js <口播.json>');process.exit(1);}

let raw;
try{raw=JSON.parse(fs.readFileSync(inputPath,'utf8'));}
catch(e){console.error('✗ 讀取/解析輸入失敗:',e.message);process.exit(1);}
const items=Array.isArray(raw)?raw:[raw];

// 先拉最新，避免覆蓋雲端
try{execSync('git -C "'+REPO+'" pull --rebase origin main',{stdio:'pipe'});}catch(e){console.error('⚠️ pull 失敗，繼續用本機版本:',e.message);}

const db=JSON.parse(fs.readFileSync(DATA,'utf8'));
let added=0;
items.slice().reverse().forEach(it=>{ // reverse 讓多篇保持原順序 unshift
  if(!it.title||!it.voiceover){console.error('  跳過（缺 title 或 voiceover）:',it.title||'(無標題)');return;}
  const now=Date.now();const p=it.platforms||{};
  db.prompts.unshift({
    pinned:false,copyCount:0,id:uid(),created:now,
    videoUrl:'',audioUrl:'',catId:'voiceover',subId:'',
    title:String(it.title),thumbnail:it.thumbnail?String(it.thumbnail):'',
    promptZh:String(it.voiceover),promptEn:'',
    tags:Array.isArray(it.tags)?it.tags:[],
    notes:it.notes?String(it.notes):'',favorite:false,updated:now,
    source:/^https?:\/\//i.test(it.source||'')?it.source:'',
    factCheck:FC.includes(it.factCheck)?it.factCheck:'pending',
    hook:it.hook?String(it.hook):'',
    voiceover:String(it.voiceover),
    editing:it.editing?String(it.editing):'',
    done:false,
    platforms:{tiktok:p.tiktok||'',youtube:p.youtube||'',ig:p.ig||'',threads:p.threads||'',fb:p.fb||''}
  });
  added++;
  console.log('  ✓ 加入:',String(it.title).slice(0,32));
});
if(!added){console.error('✗ 沒有可加入的項目');process.exit(1);}

fs.writeFileSync(DATA,JSON.stringify(db,null,2),'utf8');
console.log(`寫入 ${added} 篇，目前總筆數 ${db.prompts.length}`);

try{
  execSync('git -C "'+REPO+'" add data.json',{stdio:'pipe'});
  execSync('git -C "'+REPO+'" commit -m "Add '+added+' voiceover via ingest"',{stdio:'pipe'});
  execSync('git -C "'+REPO+'" push',{stdio:'pipe'});
  console.log('✓ 已推送到 GitHub，網頁約 1 分鐘後更新');
}catch(e){console.error('⚠️ git 推送失敗（資料已寫入本機 data.json，可稍後手動 push）:',e.message);}
