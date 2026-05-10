import { Navigate, Route, Routes } from 'react-router-dom';

import { LandingPage } from './pages/LandingPage';
import { RoomPage } from './pages/RoomPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room/:token" element={<RoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
