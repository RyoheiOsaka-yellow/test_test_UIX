/* ===== 設定（Visualization / 建物 LOD / カメラ）: ここを変更して調整 ===== */
const CONFIG = window.TWIN_CONFIG = {
  peopleFlow: { pointSize:1.35, opacity:0.65, trailLength:24, heatmapRadius:110, heatmapIntensity:1.0, gridSize:100, heightScale:1.0 },
  buildings:  { opacity:1.0, lodDistance:2800 },
  camera:     { minZoom:30, maxZoom:30000, defaultPitch:0.88 },
  api:        { base:'', autoConnect:false, maxPoints:20000 },   // Human Flow API（infra/api）。base 空＝同一オリジン（API 配信時）または http://localhost:8000
};
