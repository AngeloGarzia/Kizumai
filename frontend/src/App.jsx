import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProjectProvider } from './context/ProjectContext.jsx';
import PaidRoute from './components/PaidRoute.jsx';
import ProjectPreview from './pages/ProjectPreview.jsx';
import ProjectSearch from './pages/ProjectSearch.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import ProjectStage from './pages/ProjectStage.jsx';
import Resources from './pages/Resources.jsx';
import Planner from './pages/Planner.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import Home from './pages/Home.jsx';
import Parcours from './pages/Parcours.jsx';
import CreateFuture from './pages/CreateFuture.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Admin from './pages/Admin.jsx';
import Competences from './pages/Competences.jsx';
import Geographie from './pages/Geographie.jsx';
import FilDuTemps from './pages/FilDuTemps.jsx';

function EtudeMarcheRedirect() {
  const { id } = useParams();
  return <Navigate to={`/projet/${id}/etape/etude_marche`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProjectProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/parcours" element={<Parcours />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/creer-son-avenir" element={<CreateFuture />} />
            <Route path="/projet/recherche" element={<ProjectSearch />} />
            <Route path="/projet/apercu" element={<ProjectPreview />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<PaidRoute />}>
              <Route path="/planner" element={<Planner />} />
              <Route path="/competences" element={<Competences />} />
              <Route path="/geographie" element={<Geographie />} />
              <Route path="/fil-du-temps" element={<FilDuTemps />} />
              <Route path="/projet/:id" element={<ProjectDetail />} />
              <Route path="/projet/:id/etude-de-marche" element={<EtudeMarcheRedirect />} />
              <Route path="/projet/:id/etape/:stage" element={<ProjectStage />} />
              <Route path="/ressources" element={<Resources />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/setup" element={<Navigate to="/admin" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProjectProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
