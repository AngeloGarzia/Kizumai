import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import Button from '../components/Button.jsx';
import { getProjectDraft } from '../services/projectService.js';

export default function ConfirmEmail() {
  const { confirmEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('loading'); // loading | ok | error

  const token = searchParams.get('token');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        if (!cancelled) {
          setStatus('error');
          setError('Lien de confirmation invalide.');
        }
        return;
      }

      try {
        await confirmEmail(token);
        if (cancelled) return;
        setStatus('ok');
        const draft = getProjectDraft();
        navigate(draft ? '/projet/apercu' : '/', { replace: true });
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err.message || 'Impossible de confirmer ce compte');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [confirmEmail, navigate, token]);

  return (
    <AuthLayout
      title="Confirmation"
      subtitle={
        status === 'loading'
          ? 'Activation de votre compte…'
          : status === 'ok'
            ? 'Compte activé'
            : 'Confirmation impossible'
      }
    >
      {status === 'loading' && (
        <p className="text-sm text-prune-600">Vérification du lien en cours…</p>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          {error && <p className="alert-error">{error}</p>}
          <p className="text-sm text-prune-600">
            Demandez un nouvel email depuis la page d’inscription, ou connectez-vous si votre
            compte est déjà activé.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" onClick={() => navigate('/register')}>
              Retour à l’inscription
            </Button>
            <Link to="/login" className="link-accent text-center text-sm self-center">
              Se connecter
            </Link>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
