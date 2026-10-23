import { useRef } from "react";
import { Palette, Check, X } from "lucide-react";
export type Theme = "light" | "dark" | "hybrid";
const options: { id: Theme; name: string; tag: string; description: string }[] = [
  { id: "light", name: "Lab Light", tag: "READ & EDIT", description: "밝은 패널과 선명한 글자. 수치 입력과 긴 분석에 적합합니다." },
  { id: "dark", name: "Precision Dark", tag: "LOW LIGHT", description: "어두운 작업 공간과 밝은 신호색. 낮은 조도에서 사용하기 좋습니다." },
  { id: "hybrid", name: "Focus Hybrid", tag: "CANVAS FOCUS", description: "밝은 편집 패널과 어두운 Canvas. 광학 구조와 Beam을 강조합니다." },
];
export default function Appearance({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="appearance-trigger" onClick={() => dialog.current?.showModal()} aria-label="Appearance"><Palette size={16}/><span>Appearance</span></button>
    <dialog className="appearance-dialog" ref={dialog} aria-labelledby="appearance-title" onClick={e => {if(e.target === e.currentTarget) dialog.current?.close();}}>
      <div className="appearance-heading"><div><span className="eyebrow">WORKSPACE APPEARANCE</span><h2 id="appearance-title">더 잘 보이는 작업 공간</h2><p>같은 Design을 세 가지 화면으로 비교하세요.</p></div><button aria-label="Close Appearance" onClick={() => dialog.current?.close()}><X size={20}/></button></div>
      <div className="appearance-options">{options.map(o => <button key={o.id} className={`appearance-option ${theme === o.id ? "chosen" : ""}`} aria-pressed={theme === o.id} aria-label={o.name} onClick={() => onChange(o.id)}>
        <div className={`theme-preview preview-${o.id}`} aria-hidden="true"><div className="preview-header"/><div className="preview-side"><i/><i/><i/></div><div className="preview-stage"><span>η 100.0%</span><svg viewBox="0 0 180 65"><path d="M0 33 H180" stroke="currentColor" strokeDasharray="3 3" opacity=".35"/><path d="M20 28 Q65 0 105 28 L160 29 L160 37 L105 38 Q65 65 20 38Z" fill="currentColor" opacity=".15"/><path d="M20 28 Q65 0 105 28 L160 29 M20 38 Q65 65 105 38 L160 37 M20 20 V46 M105 10 V55 M160 22 V44" stroke="currentColor" fill="none" strokeWidth="2"/></svg></div><div className="preview-inspector"><i/><i/><i/></div></div>
        <span className="option-meta">{o.tag}{theme === o.id && <Check size={16}/>}</span><strong>{o.name}</strong><p>{o.description}</p>
      </button>)}</div>
      <div className="appearance-footer"><span>화면 설정은 현재 세션에 적용됩니다.</span><button className="appearance-done" onClick={() => dialog.current?.close()}>Apply & Close</button></div>
    </dialog>
  </>;
}
