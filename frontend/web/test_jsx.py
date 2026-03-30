import re

with open('src/app/(field)/field/incident/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace <div className={styles.body}> with the new bottom panel
jsx_old = """      {/* Detail */}
      <div className={styles.body}>"""
jsx_new = """      {/* Bottom Sheet Details */}
      <div className={styles.bottomPanel} style={{ transform: `translateY(${popupOpen ? 0 : 'calc(100% - 64px)'})` }}>
        <div className={styles.dragHandle} onClick={() => setPopupOpen(!popupOpen)} />
        <div className={styles.bodyScroll}>"""

text = text.replace(jsx_old, jsx_new)

# Since we split body, the closing div for .body should now be closed. And we need a state for popupOpen.
hook_state = "const [mounted, setMounted] = useState(false);"
hook_state_new = "const [mounted, setMounted] = useState(false);\n  const [popupOpen, setPopupOpen] = useState(true);"
text = text.replace(hook_state, hook_state_new)

# The actions code block has Navigate removed and Undo added
# We also have to fix the button layout.
actions_old = """      {/* Action bar */}
      {!isResolved && (
        <div className={styles.actions}>
          {incident.status === 'dispatched' && (
            <Button
              appearance="primary"
              style={{ background: '#000', border: 'none', minHeight: '56px', fontSize: '16px', fontWeight: '700' }}
              disabled={acting}
              onClick={() => handleStatusUpdate('in_progress')}
            >
              {acting ? <Spinner size="small" /> : 'Mark on scene'}
            </Button>
          )}

          {incident.status === 'in_progress' && (
            <Button
              appearance="primary"
              style={{ background: '#000', border: 'none', minHeight: '56px', fontSize: '16px', fontWeight: '700' }}
              disabled={acting}
              onClick={() => handleStatusUpdate('resolved')}
            >
              {acting ? <Spinner size="small" /> : 'Mark resolved'}
            </Button>
          )}

          {(incident.status === 'dispatched' || incident.status === 'in_progress') && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                appearance="secondary"
                style={{ flex: 1, minHeight: '56px', fontSize: '15px' }}
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${incident.latitude},${incident.longitude}`, '_blank')}
              >
                Navigate
              </Button>

              {incident.destination_hospital_name && incident.status === 'in_progress' && (
                <Button
                  appearance="secondary"
                  style={{ flex: 1, minHeight: '48px', fontSize: '15px', borderColor: 'var(--color-medical)', color: 'var(--color-medical)' }}
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(incident.destination_hospital_name)}`, '_blank')}
                >
                  Drive to Hospital
                </Button>
              )}
            </div>
          )}"""

actions_new = """      {/* Action bar */}
      {!isResolved && (
        <div className={styles.actions}>
          {incident.status === 'dispatched' && (
            <Button
              appearance="primary"
              style={{ background: '#000', border: 'none', minHeight: '56px', fontSize: '16px', fontWeight: '700' }}
              disabled={acting}
              onClick={() => {
                if (confirm('Did you arrive at the incident scene?')) {
                  handleStatusUpdate('in_progress');
                }
              }}
            >
              {acting ? <Spinner size="small" /> : 'Slide to Arrive ➔'}
            </Button>
          )}

          {incident.status === 'in_progress' && (
            <>
              <Button
                appearance="primary"
                style={{ background: '#2e7d32', border: 'none', minHeight: '56px', fontSize: '16px', fontWeight: '700' }}
                disabled={acting}
                onClick={() => handleStatusUpdate('resolved')}
              >
                {acting ? <Spinner size="small" /> : 'Mark Resolved'}
              </Button>
              <Button
                appearance="transparent"
                style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '-4px' }}
                disabled={acting}
                onClick={() => {
                  if (confirm('Revert status back to dispatched?')) {
                    handleStatusUpdate('dispatched' as any); // Type cast as dispatched might not be nominally typed correctly, but api works
                  }
                }}
              >
                Not on scene yet? Undo
              </Button>
            </>
          )}

          {incident.destination_hospital_name && incident.status === 'in_progress' && (
            <Button
              appearance="secondary"
              style={{ width: '100%', minHeight: '48px', fontSize: '15px', borderColor: 'var(--color-medical)', color: 'var(--color-medical)' }}
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(incident.destination_hospital_name)}`, '_blank')}
            >
              Drive to Hospital
            </Button>
          )}"""

text = text.replace(actions_old, actions_new)


# Now close the body div and actions
# Originally we had `</div>` after actions block. But now `actions` and `bodyScroll` are siblings inside `bottomPanel`
end_replace_old = """      {isResolved && (
        <div className={styles.actions}>
          <Button style={{ minHeight: '48px' }} onClick={() => router.push('/field')}>
            Back to shift
          </Button>
        </div>
      )}
    </div>"""

end_replace_new = """      {isResolved && (
        <div className={styles.actions}>
          <Button style={{ minHeight: '48px' }} onClick={() => router.push('/field')}>
            Back to shift
          </Button>
        </div>
      )}
        </div> {/* end bodyScroll */}
      </div> {/* end bottomPanel */}
    </div> {/* end page */}"""
text = text.replace(end_replace_old, end_replace_new)

with open('src/app/(field)/field/incident/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("JSX Step 2 Layout done")
