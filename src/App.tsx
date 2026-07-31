import { AuthProvider } from '@/context/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { FeedView } from '@/components/FeedView';

function App() {
  return (
    <AuthProvider>
      <AuthGuard>
        <FeedView />
      </AuthGuard>
    </AuthProvider>
  );
}

export default App;
