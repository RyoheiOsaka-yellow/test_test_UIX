/// <reference types="vite/client" />

/** vite.config.ts が注入するビルド時の真偽値。API キー自体はクライアントへ渡さない。 */
declare const __JEV_KEY_PRESENT__: boolean

/** 単一 HTML ビルドが埋め込む資産（scripts/build-single-html.mjs 参照） */
interface Window {
  __JEV_EMBEDDED__?: {
    videoDataUrl?: string
    videoCredit?: string
    detections?: import('@/types/inspection').RawDetection[]
  }
}
