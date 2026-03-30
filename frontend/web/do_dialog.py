
import re

with open('src/app/(field)/field/incident/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update imports
if 'Dialog' not in code:
    code = code.replace(
        '''import { Text, Spinner, Button, makeStyles } from '@fluentui/react-components';''', 
        '''import { Text, Spinner, Button, makeStyles, Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent } from '@fluentui/react-components';'''
    )

# 2. Update styles (add max width for centered UI on iPads)
code = re.sub(
    r'navTopBox: \{.*?(?=navMainText:)', 
    '''navTopBox: {
      position: 'absolute', top: '12px', left: '12px', right: '12px',
      background: '#0d4722', color: '#fff', borderRadius: '12px', padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100,
      maxWidth: '500px', margin: '0 auto'
    },
    ''',
    code, flags=re.DOTALL
)

code = re.sub(
    r'bottomPanel: \{.*?(?=dragHandle:)',
    '''bottomPanel: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'var(--color-surface)', borderTopLeftRadius: '24px',
      borderTopRightRadius: '24px', zIndex: 200,
      boxShadow: '0 -8px 24px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column',
      height: 'auto', maxHeight: '60vh', transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      maxWidth: '500px', margin: '0 auto'
    },
    ''',
    code, flags=re.DOTALL
)

# 3. Add modal state
if 'confirmAction' not in code:
    code = code.replace(
        '''const [popupOpen, setPopupOpen] = useState(false);''',
        '''const [popupOpen, setPopupOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{title: string, content: string, action: () => void} | null>(null);'''
    )

# 4. Replace confirms
code = code.replace(
    '''if (confirm('Did you arrive at the incident scene?')) {
                  handleStatusUpdate('in_progress');
                }''',
    '''setConfirmAction({
                  title: 'Arrive at Scene',
                  content: 'Did you arrive at the incident scene?',
                  action: () => handleStatusUpdate('in_progress')
                });'''
)

code = code.replace(
    '''if (confirm('Revert status back to dispatched?')) {
                    handleStatusUpdate('dispatched' as any); // Type cast as dispatched might not be nominally typed correctly, but api works
                  }''',
    '''setConfirmAction({
                  title: 'Undo Arrival',
                  content: 'Revert status back to dispatched?',
                  action: () => handleStatusUpdate('dispatched' as any)
                });'''
)

# 5. Insert Modal JSX at bottom of return (before </div>)
# Need to find the end of the return statement
modal_jsx = '''
      {confirmAction && (
        <Dialog open={true} onOpenChange={(e, data) => !data.open && setConfirmAction(null)}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>{confirmAction.title}</DialogTitle>
              <DialogContent>{confirmAction.content}</DialogContent>
              <DialogActions>
                <Button appearance='secondary' onClick={(e) => { e.stopPropagation(); setConfirmAction(null); }}>Cancel</Button>
                <Button appearance='primary' onClick={(e) => { e.stopPropagation(); confirmAction.action(); setConfirmAction(null); }}>Confirm</Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}
'''
code = re.sub(r'    </div>\n  \);\n\}', modal_jsx, code)

with open('src/app/(field)/field/incident/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)


