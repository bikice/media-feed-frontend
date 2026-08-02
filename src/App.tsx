import { AuthProvider } from '@/context/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { FeedView } from '@/components/FeedView';
import { DebugKeyOverlay } from '@/components/DebugKeyOverlay';
import { isDebugEnabled } from '@/lib/debug';

// Read once at module init -- the debug flag comes from the URL the page
// was loaded with and isn't expected to change without a reload.
const debugEnabled = isDebugEnabled();

function App() {
    return (
        <AuthProvider>
            <AuthGuard>
                <FeedView />
            </AuthGuard>
            {debugEnabled && <DebugKeyOverlay />}
        </AuthProvider>
    );
}

export default App;