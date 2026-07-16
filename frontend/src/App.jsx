import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import PaidRoute from './components/PaidRoute.jsx';
import ProjectPreview from './pages/ProjectPreview.jsx';
import ProjectSearch from './pages/ProjectSearch.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Planner from './pages/Planner.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import Home from './pages/Home.jsx';
import CreateFuture from './pages/CreateFuture.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/creer-son-avenir" element={<CreateFuture />} />
          <Route path="/projet/recherche" element={<ProjectSearch />} />
          <Route path="/projet/apercu" element={<ProjectPreview />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<PaidRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/projet/:id" element={<ProjectDetail />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
