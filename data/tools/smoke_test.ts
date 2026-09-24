// Chạy: npx tsx smoke_test.ts <đường dẫn canonical_face_model.obj>
// Tải obj: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj
// Biến dạng khuôn mặt trung bình của MediaPipe (kéo dài, bóp hàm, thoi, vuông...) và kiểm tra nhãn ra đúng hướng.
import { readFileSync } from 'fs';
import { extractFeatures, toZ, classifyHanh, classifyLetter, matchChi, LM } from '../lib/shapeClassifier';
const D='../data/';
const calib = JSON.parse(readFileSync(D+'calib_shape.json','utf8')); delete calib._status;
const types = JSON.parse(readFileSync(D+'face_types.json','utf8'));
const letters = JSON.parse(readFileSync(D+'face_letters.json','utf8'));
const chi = JSON.parse(readFileSync(D+'archetypes_12chi.json','utf8')).archetypes;
const V = readFileSync(process.argv[2] ?? 'canonical_face_model.obj','utf8').split('\n').filter(l=>l.startsWith('v ')).map(l=>l.split(' ').slice(1,4).map(Number));
const base: LM[] = V.map(([x,y,z])=>({x: 500+x*40, y: 500-y*40, z}));
// thêm 10 iris landmark giả cho đủ 478
while (base.length<478) base.push({x:500,y:500});
function warp(f:(p:LM)=>LM){ return base.map(f); }
const cy = 500, cx=500;
const cases: Record<string,LM[]> = {
  canonical: base,
  long_face: warp(p=>({x:p.x, y:cy+(p.y-cy)*1.18})),
  short_round: warp(p=>({x:p.x, y:cy+(p.y-cy)*0.85})),
  wide_jaw_narrow_top: warp(p=>{ const t=(p.y-cy)/360; return {x:cx+(p.x-cx)*(1+0.18*t), y:p.y}; }),
  wide_top_narrow_jaw: warp(p=>{ const t=(p.y-cy)/360; return {x:cx+(p.x-cx)*(1-0.18*t), y:p.y}; }),
  diamond: warp(p=>{ const t=Math.abs(p.y-(cy+30))/360; return {x:cx+(p.x-cx)*(1-0.25*t), y:p.y}; }),
  square: warp(p=>{ const t=Math.abs(p.y-(cy+30))/360; return {x:cx+(p.x-cx)*(1+0.2*t), y:cy+(p.y-cy)*0.95}; }),
  yawed: warp(p=>({x:cx+(p.x-cx)*(p.x>cx?0.7:1), y:p.y})),
};
for (const [name,lm] of Object.entries(cases)) {
  const e = extractFeatures(lm);
  if (!e.ok) { console.log(name.padEnd(22),'REJECT',e.reason, e.yaw.toFixed(3)); continue; }
  const z = toZ({...e.shape, ...e.extra}, calib);
  const h = classifyHanh(z, types); const l = classifyLetter(z, letters).slice(0,2);
  const c = matchChi(z, {}, chi);
  console.log(name.padEnd(22), h.label.padEnd(14), h.membership.map(m=>m.key+':'+m.p.toFixed(2)).join(' '), '| chữ:', l.map(m=>m.key+':'+m.p.toFixed(2)).join(' '), '| chi:', c.best?.key ?? '-');
}
