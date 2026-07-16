import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import {
  clearProjectDraft,
  getProjectDraft,
  projectService,
} from '../services/projectService.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPaidSignup = searchParams.get('plan') === 'paid';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await register(name, email, password, isPaidSignup ? 'paid' : 'free');

      const draft = getProjectDraft();
      if (isPaidSignup && draft) {
        await projectService.createProject(draft);
        clearProjectDraft();
        navigate('/dashboard');
      } else if (draft) {
        navigate('/projet/apercu');
      } else {
        navigate(isPaidSignup ? '/dashboard' : '/');
      }
    } catch (err) {
      setError(err.message || 'Échec de l\'inscription');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={isPaidSignup ? 'Compte payant' : 'Inscription'}
      subtitle={
        isPaidSignup
          ? 'Débloquez l\'accès au parcours complet Kizumai'
          : 'Créez votre compte Kizumai'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <Input
          id="name"
          label="Nom"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />

        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Input
          id="password"
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
          hint="Minimum 8 caractères"
        />

        {isPaidSignup && (
          <p className="text-xs text-prune-600 bg-prune-50 border border-prune-200 rounded-xl px-4 py-3">
            Votre aperçu projet sera enregistré après inscription. Paiement simulé en développement.
          </p>
        )}

        {error && <p className="alert-error">{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting
            ? 'Inscription...'
            : isPaidSignup
              ? 'Créer mon compte payant'
              : 'S\'inscrire'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-prune-600">
        Déjà un compte ?{' '}
        <Link to="/login" className="link-accent">
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  );
}
