/* ===== 設定（Visualization / 建物 LOD / カメラ）: ここを変更して調整 ===== */
const CONFIG = window.TWIN_CONFIG = {
  peopleFlow: { pointSize:1.35, opacity:0.65, trailLength:24, heatmapRadius:110, heatmapIntensity:1.0, gridSize:100, heightScale:1.0 },
  buildings:  { opacity:1.0, lodDistance:2800 },
  camera:     { minZoom:30, maxZoom:30000, defaultPitch:0.88 },
  api:        { base:'', autoConnect:false, maxPoints:20000 },
  pointCloud: { mode:'SOFT', color:'density', budget:500000, budgetMin:200000, budgetMax:1000000, debug:false },   // 人流 Point Cloud（people-flow/pointcloud.js）
  las:        { originXY:null },   // LAS がメートル座標のとき、シーン中心（姫路城）に当たる [E, N]。null＝重心を城に合わせる   // Human Flow API（infra/api）。base 空＝同一オリジン（API 配信時）または http://localhost:8000
};
