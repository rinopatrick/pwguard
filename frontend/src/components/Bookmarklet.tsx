import { useState } from 'react';
import { motion } from 'framer-motion';

const BOOKMARKLET_CODE = `javascript:void(function(){var s=document.createElement('style');s.textContent='.pw-viz-popup{position:fixed;top:20px;right:20px;z-index:999999;background:#1e293b;color:#e2e8f0;padding:16px 20px;border-radius:12px;font-family:system-ui;font-size:14px;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);max-width:300px;transition:all .3s}.pw-viz-bar{height:8px;background:#334155;border-radius:4px;overflow:hidden;margin:8px 0}.pw-viz-fill{height:100%;border-radius:4px;transition:width .3s}.pw-viz-close{position:absolute;top:8px;right:12px;cursor:pointer;color:#64748b;font-size:18px}';document.head.appendChild(s);var inputs=document.querySelectorAll('input[type=password]');if(!inputs.length){alert('No password fields found on this page.');return}function analyze(pw){if(!pw)return{pct:0,label:'Empty',clr:'#ef4444'};var cs=0;if(/[a-z]/.test(pw))cs+=26;if(/[A-Z]/.test(pw))cs+=26;if(/[0-9]/.test(pw))cs+=10;if(/[^a-zA-Z0-9]/.test(pw))cs+=33;var e=pw.length*(cs>1?Math.log2(cs):0);var pct=Math.min(Math.round(e/128*100),100);var lbl=pct<20?'Very Weak':pct<40?'Weak':pct<60?'Fair':pct<80?'Strong':'Very Strong';var clr=pct<25?'#ef4444':pct<50?'#f97316':pct<75?'#eab308':'#10b981';return{pct:pct,label:lbl,clr:clr}}function showPopup(pw){var old=document.querySelector('.pw-viz-popup');if(old)old.remove();var a=analyze(pw);var d=document.createElement('div');d.className='pw-viz-popup';d.innerHTML='<span class="pw-viz-close" onclick="this.parentElement.remove()">×</span><div style="font-weight:700;margin-bottom:4px">Password Strength</div><div style="font-size:28px;font-weight:800;color:'+a.clr+'">'+a.pct+'%</div><div style="color:'+a.clr+';font-weight:600;margin-bottom:4px">'+a.label+'</div><div class="pw-viz-bar"><div class="pw-viz-fill" style="width:'+a.pct+'%;background:'+a.clr+'"></div></div><div style="font-size:11px;color:#64748b">'+pw.length+' chars</div>';document.body.appendChild(d)}inputs.forEach(function(inp){if(inp.dataset.pwViz)return;inp.dataset.pwViz='1';inp.addEventListener('input',function(){showPopup(this.value)})});showPopup(inputs[0].value)}());`;

export default function Bookmarklet() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(BOOKMARKLET_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="glass p-5 border-l-4 border-emerald-500">
        <p className="text-sm text-slate-300 font-medium">Password Strength Bookmarklet</p>
        <p className="text-xs text-slate-500 mt-1">
          Add a password strength indicator to any website. Drag the button below to your bookmarks bar,
          then click it on any page with password fields to see real-time strength analysis.
        </p>
      </div>

      {/* Draggable bookmarklet */}
      <div className="glass p-6 text-center space-y-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Drag this to your bookmarks bar</p>
        <a
          href={BOOKMARKLET_CODE}
          className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-shadow cursor-grab active:cursor-grabbing"
          onClick={(e) => e.preventDefault()}
        >
          🔐 Check Password Strength
        </a>
        <p className="text-xs text-slate-600">
          ↑ Drag this button to your bookmarks bar
        </p>
      </div>

      {/* How to use */}
      <div className="glass p-5 space-y-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider">How to use</p>
        <div className="space-y-3">
          {[
            { step: '1', text: 'Drag the button above to your browser\'s bookmarks bar' },
            { step: '2', text: 'Navigate to any website with a password field (login, signup, etc.)' },
            { step: '3', text: 'Click the bookmarklet in your bookmarks bar' },
            { step: '4', text: 'Type in any password field — strength will appear in a popup' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                {step}
              </span>
              <p className="text-sm text-slate-300">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Copy code */}
      <div className="glass p-5 space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Or copy the code</p>
        <button
          onClick={handleCopy}
          className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all text-sm font-medium flex items-center justify-center gap-2"
        >
          {copied ? '✓ Copied to clipboard!' : '📋 Copy Bookmarklet Code'}
        </button>
        <p className="text-xs text-slate-600">
          Create a new bookmark, paste this code as the URL.
        </p>
      </div>

      {/* Features */}
      <div className="glass p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">What it detects</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            'Entropy calculation',
            'Charset detection',
            'Real-time analysis',
            'Works on any site',
            'No data sent anywhere',
            'Auto-detects password fields',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-emerald-400">✓</span>
              {feature}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
