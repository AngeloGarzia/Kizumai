import { useEffect, useState } from 'react';
import {
  isIos,
  isPushSupported,
  isStandalone,
  notificationService,
} from '../services/notificationService.js';

export default function NotificationSettings() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const iosNeedsInstall = isIos() && !isStandalone();

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isPushSupported()) {
        if (active) setSupported(false);
        return;
      }
      try {
        const config = await notificationService.getServerConfig();
        const sub = await notificationService.getSubscription();
        if (!active) return;
        setServerEnabled(Boolean(config.enabled));
        setSubscribed(Boolean(sub));
      } catch {
        if (active) setServerEnabled(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await notificationService.subscribe();
      setSubscribed(true);
      setMessage('Notifications activées sur cet appareil.');
    } catch (err) {
      setError(err.message || 'Impossible d\'activer les notifications');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await notificationService.unsubscribe();
      setSubscribed(false);
      setMessage('Notifications désactivées sur cet appareil.');
    } catch (err) {
      setError(err.message || 'Impossible de désactiver les notifications');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 sm:mt-8 p-4 sm:p-5 rounded-xl bg-prune-50 border border-prune-100">
      <p className="text-xs font-semibold text-prune-500 uppercase tracking-wide">Notifications</p>

      {!supported && (
        <p className="text-sm text-prune-700 mt-2">
          Cet appareil ne supporte pas les notifications push.
          {iosNeedsInstall
            ? ' Sur iPhone/iPad, ajoutez d\'abord Kizumai à votre écran d\'accueil.'
            : ' Vous recevrez les informations importantes par email.'}
        </p>
      )}

      {supported && iosNeedsInstall && (
        <p className="text-sm text-prune-700 mt-2">
          Sur iOS, appuyez sur <span className="font-semibold">Partager</span> puis
          {' '}<span className="font-semibold">«&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;»</span> pour installer
          Kizumai, puis rouvrez l&apos;app pour activer les notifications. En attendant, vous serez averti par email.
        </p>
      )}

      {supported && !serverEnabled && !iosNeedsInstall && (
        <p className="text-sm text-prune-700 mt-2">
          Les notifications push ne sont pas configurées sur le serveur. Vous serez averti par email.
        </p>
      )}

      {supported && serverEnabled && !iosNeedsInstall && (
        <>
          <p className="text-sm text-prune-700 mt-2">
            {subscribed
              ? 'Les notifications push sont activées sur cet appareil.'
              : 'Activez les notifications pour être averti sur cet appareil. Sinon, vous recevrez un email.'}
          </p>
          <div className="mt-3">
            {subscribed ? (
              <button
                type="button"
                onClick={disable}
                disabled={busy}
                className="btn-secondary w-auto text-sm"
              >
                {busy ? '...' : 'Désactiver'}
              </button>
            ) : (
              <button
                type="button"
                onClick={enable}
                disabled={busy}
                className="btn-primary w-auto text-sm"
              >
                {busy ? 'Activation...' : 'Activer les notifications'}
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className="alert-error mt-3">{error}</p>}
      {message && <p className="alert-success mt-3">{message}</p>}
    </div>
  );
}
