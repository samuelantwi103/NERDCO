const fs = require('fs');
let code = fs.readFileSync('src/app/(field)/field/incident/page.tsx', 'utf8');

// fix bottom panel
code = code.replace(/maxHeight: '60vh', transition/g, 'height: \'auto\', maxHeight: \'60vh\', transition');

// fix legend
code = code.replace(/pointerEvents: 'none'\\n\\s*},/g, 'pointerEvents: \'none\', opacity: 0.8 },');

// fix nav bottom box
code = code.replace(/<div className=\{styles\.navBottomBox\}>[\\s\\S]*?<\/div>[\\s\\S]*?<\/div>\\s*<\/>\\s*\)\}/, 
</>
            )}
            
            <div 
              style={{ position: 'absolute', bottom: '150px', right: '16px', background: '#fff', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 100, color: '#005953' }}
              onClick={handleRecenter}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </div>
);

// fix bottom sheet header
code = code.replace(/\{\/\* Bottom Sheet Details \*\/\}\\s*<div className=\{styles\.bottomPanel\} style=\{\{ transform: \	ranslateY\(\\\$\{popupOpen \? 0 : 'calc\(100% - 64px\)'\}\)\ \}\}>\\s*<div className=\{styles\.dragHandle\} onClick=\{\(\) => setPopupOpen\(!popupOpen\)\} \/>/,
{/* Bottom Sheet Details */}
      <div className={styles.bottomPanel} style={{ transform: \	ranslateY(\)\ }}>
        <div className={styles.dragHandle} onClick={() => setPopupOpen(!popupOpen)} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 16px', borderBottom: popupOpen ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }} onClick={() => setPopupOpen(!popupOpen)}>
          {navInfo ? (
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#b36b00', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {navInfo.duration} <span style={{ color: '#2e7d32' }}>🍃</span>
              </div>
              <div style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>
                {navInfo.distance} • {(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{incident.status.replace('_', ' ').toUpperCase()}</div>
              <div style={{ fontSize: '14px', color: '#666' }}>Navigating...</div>
            </div>
          )}
          
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ffebeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d32f2f', zIndex: 10 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
);

fs.writeFileSync('src/app/(field)/field/incident/page.tsx', code, 'utf8');