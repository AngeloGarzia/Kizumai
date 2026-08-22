import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import DocumentScanModal from '../components/DocumentScanModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import { projectService } from '../services/projectService.js';
import { DOCUMENT_ACCEPT } from '../utils/safeDisplay.js';

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function typeLabel(type) {
  const map = {
    pdf: 'PDF',
    image: 'Image',
    spreadsheet: 'Tableur',
    presentation: 'Présentation',
    document: 'Document',
    other: 'Fichier',
  };
  return map[type] || 'Fichier';
}

function TypeGlyph({ type, className = 'w-5 h-5' }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.75',
    'aria-hidden': true,
  };
  if (type === 'pdf') {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
        <path strokeLinecap="round" d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    );
  }
  if (type === 'image') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l5-4 4 3 4-5 5 6" />
      </svg>
    );
  }
  if (type === 'spreadsheet') {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path strokeLinecap="round" d="M3 10h18M3 14h18M9 4v16M15 4v16" />
      </svg>
    );
  }
  if (type === 'presentation') {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path strokeLinecap="round" d="M12 16v4M8 20h8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path strokeLinecap="round" d="M14 3v5h5" />
    </svg>
  );
}

function typeAccent(type) {
  const map = {
    pdf: 'bg-topaz-100 text-topaz-700',
    image: 'bg-wasabi-100 text-wasabi-800',
    spreadsheet: 'bg-prune-100 text-prune-700',
    presentation: 'bg-topaz-50 text-topaz-800',
    document: 'bg-prune-50 text-prune-700',
    other: 'bg-prune-50 text-prune-600',
  };
  return map[type] || map.other;
}

function DocumentRow({ doc, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(doc)}
      className={[
        'group w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200',
        selected
          ? 'bg-white shadow-sm ring-2 ring-topaz-400/70'
          : 'hover:bg-white/80 hover:shadow-sm',
      ].join(' ')}
    >
      <span
        className={[
          'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200',
          typeAccent(doc.type),
          selected ? 'scale-105' : 'group-hover:scale-105',
        ].join(' ')}
      >
        <TypeGlyph type={doc.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-prune-900 truncate">
          {doc.title || doc.fileName}
        </span>
        <span className="block text-sm text-prune-500 mt-0.5 truncate">
          {typeLabel(doc.type)}
          {doc.processingStatus === 'processing' ? ' · Extraction…' : ''}
          {doc.sizeBytes != null ? ` · ${formatSize(doc.sizeBytes)}` : ''}
          {doc.createdAt ? ` · ${formatDate(doc.createdAt)}` : ''}
        </span>
      </span>
      {doc.contacts?.length > 0 && (
        <span className="shrink-0 text-xs font-medium text-topaz-700 tabular-nums">
          {doc.contacts.length}
        </span>
      )}
    </button>
  );
}

function PreviewPane({ projectId, doc, textPreview, loadingPreview }) {
  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-16 min-h-[22rem]">
        <span className="w-14 h-14 rounded-2xl bg-prune-100 text-prune-500 flex items-center justify-center mb-4">
          <TypeGlyph type="document" className="w-7 h-7" />
        </span>
        <p className="font-semibold text-prune-800">Aucun fichier sélectionné</p>
        <p className="text-sm text-prune-500 mt-1 max-w-xs">
          Choisis un document dans la liste pour voir l&apos;aperçu et gérer ses liens.
        </p>
      </div>
    );
  }

  const url = projectService.documentDownloadUrl(projectId, doc.id);
  const safeImage = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(doc.mimeType);
  const isPdf = doc.mimeType === 'application/pdf';
  const isProcessing = doc.processingStatus === 'processing';
  const isText =
    doc.mimeType === 'text/plain' ||
    doc.mimeType === 'text/markdown' ||
    doc.mimeType === 'text/csv' ||
    Boolean(doc.excerpt) ||
    isProcessing;

  return (
    <div className="animate-[fadeIn_280ms_ease-out] space-y-5">
      <div className="flex items-start gap-3">
        <span
          className={[
            'shrink-0 w-11 h-11 rounded-xl flex items-center justify-center',
            typeAccent(doc.type),
          ].join(' ')}
        >
          <TypeGlyph type={doc.type} className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-prune-900 text-xl leading-snug">
            {doc.title || doc.fileName}
          </h3>
          {doc.description && (
            <p className="text-sm text-prune-600 mt-1">{doc.description}</p>
          )}
          <p className="text-sm text-prune-500 mt-1.5">
            {doc.category?.title || 'Sans catégorie'}
            <span className="mx-1.5 text-prune-300">·</span>
            {typeLabel(doc.type)}
            <span className="mx-1.5 text-prune-300">·</span>
            {formatSize(doc.sizeBytes)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden bg-prune-950/[0.03] border border-prune-100/80 min-h-[16rem]">
        {safeImage && (
          <img
            src={url}
            alt={doc.title || doc.fileName}
            className="max-h-[28rem] w-full object-contain bg-white"
          />
        )}
        {isPdf && (
          <iframe
            title="Aperçu PDF"
            src={url}
            sandbox=""
            referrerPolicy="no-referrer"
            className="w-full h-[28rem] bg-white"
          />
        )}
        {!safeImage && !isPdf && isText && (
          <pre className="p-5 text-sm text-prune-800 whitespace-pre-wrap max-h-[28rem] overflow-auto font-sans leading-relaxed">
            {isProcessing && !textPreview && !doc.excerpt
              ? 'Extraction du texte en cours…'
              : loadingPreview
                ? 'Chargement…'
                : textPreview || doc.excerpt || 'Aperçu indisponible.'}
          </pre>
        )}
        {!safeImage && !isPdf && !isText && (
          <div className="p-8 text-center">
            <p className="text-sm text-prune-600">Aperçu non disponible pour ce format.</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="link-accent inline-block mt-3">
              Télécharger
            </a>
          </div>
        )}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary inline-flex items-center justify-center text-sm w-full sm:w-auto"
      >
        Télécharger le fichier
      </a>
    </div>
  );
}

function UploadZone({ fileRef, busy, onUpload, categoryId, onCategoryChange, categories }) {
  const [dragging, setDragging] = useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file || !fileRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileRef.current.files = dt.files;
    onUpload({ target: fileRef.current });
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={[
        'relative rounded-2xl border-2 border-dashed px-5 py-6 sm:py-7 transition-all duration-200',
        dragging
          ? 'border-topaz-400 bg-topaz-50/80 scale-[1.01]'
          : 'border-prune-200/80 bg-white/50 hover:border-prune-300 hover:bg-white/80',
      ].join(' ')}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-prune-900 text-lg">Ajouter un fichier</p>
          <p className="text-sm text-prune-500 mt-1">
            Glisse-dépose ou choisis un fichier — PDF, Word, Excel, images, Markdown…
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center shrink-0">
          <select
            id="upload-cat"
            className="input-field sm:min-w-[11rem]"
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label="Catégorie à l'upload"
          >
            <option value="">Sans catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? `↳ ${c.title}` : c.title}
              </option>
            ))}
          </select>
          <label
            className={[
              'btn-primary cursor-pointer text-center sm:w-auto inline-flex items-center justify-center',
              busy ? 'opacity-50 pointer-events-none' : '',
            ].join(' ')}
          >
            {busy ? 'Envoi…' : 'Parcourir'}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={onUpload}
              disabled={busy}
              accept={DOCUMENT_ACCEPT}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function CategoryNav({ resources, selectedCategory, onSelect, flatCategories }) {
  const items = [
    { id: 'all', label: 'Tous', count: resources?.total || 0 },
    ...(resources?.categories || []).map((cat) => {
      const count =
        (cat.documents?.length || 0) +
        (cat.children || []).reduce((n, ch) => n + (ch.documents?.length || 0), 0);
      return { id: String(cat.id), label: cat.title, count };
    }),
    ...(resources?.uncategorized?.length
      ? [{ id: 'none', label: 'Non classés', count: resources.uncategorized.length }]
      : []),
  ];

  return (
    <>
      {/* Mobile : select */}
      <div className="lg:hidden">
        <label className="label-field" htmlFor="cat-filter">
          Catégorie
        </label>
        <select
          id="cat-filter"
          className="input-field"
          value={selectedCategory}
          onChange={(e) => onSelect(e.target.value)}
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.count})
            </option>
          ))}
        </select>
      </div>

      {/* Desktop : rail */}
      <nav className="hidden lg:block" aria-label="Catégories">
        <p className="text-xs font-semibold tracking-wider uppercase text-prune-500 mb-3">
          Catégories
        </p>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = String(selectedCategory) === String(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={[
                    'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors duration-150',
                    active
                      ? 'bg-prune-900 text-wasabi-400 font-semibold'
                      : 'text-prune-700 hover:bg-white/70',
                  ].join(' ')}
                >
                  <span className="truncate">{item.label}</span>
                  <span className={active ? 'text-wasabi-400/80' : 'text-prune-400'}>
                    {item.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {flatCategories.length === 0 && (
          <p className="text-xs text-prune-400 mt-3 px-1">Aucune catégorie définie.</p>
        )}
      </nav>
    </>
  );
}

export default function Resources() {
  const navigate = useNavigate();
  const { isAuthenticated, isPaid, loading: authLoading } = useAuth();
  const { currentProject, currentProjectId } = useProject();
  const fileRef = useRef(null);

  const [project, setProject] = useState(null);
  const [resources, setResources] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [textPreview, setTextPreview] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [uploadCategoryId, setUploadCategoryId] = useState('');
  const [linkContactId, setLinkContactId] = useState('');
  const [scanModal, setScanModal] = useState(null);

  const selected = useMemo(
    () => (resources?.documents || []).find((d) => d.id === selectedId) || null,
    [resources, selectedId]
  );

  const flatCategories = useMemo(() => {
    const list = [];
    for (const cat of resources?.categories || []) {
      list.push(cat);
      for (const child of cat.children || []) list.push(child);
    }
    return list;
  }, [resources]);

  const visibleDocs = useMemo(() => {
    const docs = resources?.documents || [];
    if (selectedCategory === 'all') return docs;
    if (selectedCategory === 'none') return resources?.uncategorized || [];
    const cat = flatCategories.find((c) => String(c.id) === String(selectedCategory));
    if (!cat) return docs;
    const childIds = new Set((cat.children || []).map((c) => c.id));
    return docs.filter(
      (d) => d.categoryId === cat.id || childIds.has(d.categoryId)
    );
  }, [resources, selectedCategory, flatCategories]);

  const load = async (projectId) => {
    const data = await projectService.getResources(projectId);
    setResources(data);
    if (!selectedId && data.documents?.[0]) {
      setSelectedId(data.documents[0].id);
    }
  };

  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/ressources' } });
      return undefined;
    }
    if (!isPaid) {
      navigate('/projet/apercu');
      return undefined;
    }

    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        if (!currentProjectId) {
          if (active) {
            setProject(null);
            setResources({ categories: [], documents: [], uncategorized: [], total: 0 });
          }
          return;
        }
        if (active) setProject(currentProject);
        await load(currentProjectId);
      } catch (err) {
        if (active) setError(err.message || 'Impossible de charger les ressources');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, isPaid, navigate, currentProjectId, currentProject]);

  useEffect(() => {
    if (!project?.id || !selected) return undefined;
    const mime = selected.mimeType || '';
    const needsPreview =
      selected.processingStatus === 'processing' ||
      mime.startsWith('text/') ||
      mime === 'text/csv' ||
      Boolean(selected.excerpt);
    if (!needsPreview) {
      setTextPreview('');
      return undefined;
    }
    let active = true;
    let timer;

    const fetchPreview = () => {
      setLoadingPreview(true);
      projectService
        .getDocumentTextPreview(project.id, selected.id)
        .then((data) => {
          if (!active) return;
          if (data.status === 'processing') {
            setTextPreview('');
            timer = setTimeout(fetchPreview, 2500);
            return;
          }
          setTextPreview(data.text || '');
        })
        .catch(() => {
          if (active) setTextPreview(selected.excerpt || '');
        })
        .finally(() => {
          if (active) setLoadingPreview(false);
        });
    };

    fetchPreview();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [
    project?.id,
    selected?.id,
    selected?.mimeType,
    selected?.excerpt,
    selected?.processingStatus,
  ]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;
    setBusy(true);
    setError('');
    try {
      const formCategory = uploadCategoryId || undefined;
      const doc = await projectService.uploadDocument(project.id, file);
      if (formCategory) {
        await projectService.updateDocument(project.id, doc.id, {
          categoryId: Number(formCategory),
        });
      }
      await load(project.id);
      setSelectedId(doc.id);
      if (doc.scanId) {
        setScanModal({ scanId: doc.scanId, documentId: doc.id });
      }
    } catch (err) {
      setError(err.message || 'Téléversement impossible');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const changeCategory = async (categoryId) => {
    if (!project || !selected) return;
    setBusy(true);
    try {
      const updated = await projectService.updateDocument(project.id, selected.id, {
        categoryId: categoryId === '' ? null : Number(categoryId),
      });
      await load(project.id);
      setSelectedId(updated.id);
    } catch (err) {
      setError(err.message || 'Mise à jour impossible');
    } finally {
      setBusy(false);
    }
  };

  const linkContact = async () => {
    if (!project || !selected || !linkContactId) return;
    setBusy(true);
    try {
      await projectService.linkDocumentContact(project.id, selected.id, {
        contactId: Number(linkContactId),
        role: 'lié au document',
      });
      await load(project.id);
      setLinkContactId('');
    } catch (err) {
      setError(err.message || 'Liaison impossible');
    } finally {
      setBusy(false);
    }
  };

  const unlinkContact = async (contactId) => {
    if (!project || !selected) return;
    setBusy(true);
    try {
      await projectService.unlinkDocumentContact(project.id, selected.id, contactId);
      await load(project.id);
    } catch (err) {
      setError(err.message || 'Suppression du lien impossible');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen page-bg flex items-center justify-center">
        <p className="text-prune-500 animate-pulse">Chargement des documents…</p>
      </div>
    );
  }

  const projectLabel = project?.title || project?.quoi || 'Mon projet';

  return (
    <div className="min-h-screen min-h-dvh page-bg flex flex-col lg:flex-row">
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
        <BottomNav />
      </div>

      <div className="flex-1 flex flex-col min-w-0 pb-28 sm:pb-32 lg:pb-10">
        <header className="sticky top-0 z-10 header-glass">
          <div className="page-container py-4 sm:py-5 flex items-center justify-between gap-3">
            <BrandLogo size="sm" />
            <Link to="/parcours" className="btn-secondary text-sm">
              Parcours
            </Link>
          </div>
        </header>

        <main className="page-container flex-1 max-w-[50.4rem] lg:max-w-[86.4rem] space-y-8">
          <section className="pt-2 sm:pt-4">
            <p className="text-xs font-semibold tracking-[0.2em] text-topaz-600 uppercase">
              Ressources
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-prune-900 tracking-tight">
              Documents du projet
            </h1>
            {project ? (
              <p className="mt-3 text-prune-600 max-w-xl">
                <span className="font-semibold text-topaz-700">{projectLabel}</span>
                <span className="text-prune-300 mx-2">·</span>
                {resources?.total || 0} fichier{(resources?.total || 0) > 1 ? 's' : ''}
              </p>
            ) : (
              <p className="mt-3 text-prune-500">
                Aucun projet — crée un projet depuis le parcours.
              </p>
            )}
          </section>

          {error && <p className="alert-error">{error}</p>}

          {!project ? (
            <div className="rounded-2xl bg-white/70 border border-prune-100 px-6 py-10 text-center">
              <p className="text-prune-700 text-lg">Pas encore de projet à documenter.</p>
              <Link to="/creer-son-avenir" className="btn-primary mt-5 inline-flex w-auto px-8">
                Lancer ma recherche
              </Link>
            </div>
          ) : (
            <>
              <UploadZone
                fileRef={fileRef}
                busy={busy}
                onUpload={handleUpload}
                categoryId={uploadCategoryId}
                onCategoryChange={setUploadCategoryId}
                categories={flatCategories}
              />

              <div className="grid grid-cols-1 lg:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1.15fr)] gap-6 lg:gap-8 items-start">
                <CategoryNav
                  resources={resources}
                  selectedCategory={selectedCategory}
                  onSelect={setSelectedCategory}
                  flatCategories={flatCategories}
                />

                <section>
                  <div className="flex items-baseline justify-between gap-2 mb-3">
                    <h2 className="text-lg font-bold text-prune-900">Fichiers</h2>
                    <span className="text-sm text-prune-400 tabular-nums">
                      {visibleDocs.length}
                    </span>
                  </div>

                  {visibleDocs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-prune-200 px-5 py-12 text-center">
                      <p className="text-prune-600 font-medium">Aucun document ici</p>
                      <p className="text-sm text-prune-500 mt-1">
                        Ajoute un fichier ci-dessus pour commencer.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-1 rounded-2xl bg-prune-900/[0.03] p-1.5">
                      {visibleDocs.map((doc) => (
                        <li key={doc.id}>
                          <DocumentRow
                            doc={doc}
                            selected={doc.id === selectedId}
                            onSelect={(d) => setSelectedId(d.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="lg:sticky lg:top-24 rounded-2xl bg-white/80 border border-prune-100/90 shadow-sm shadow-prune-900/5 p-5 sm:p-6 space-y-6">
                  <PreviewPane
                    projectId={project.id}
                    doc={selected}
                    textPreview={textPreview}
                    loadingPreview={loadingPreview}
                  />

                  {selected && (
                    <div className="pt-5 border-t border-prune-100 space-y-5">
                      <div>
                        <label className="label-field" htmlFor="doc-cat">
                          Catégorie
                        </label>
                        <select
                          id="doc-cat"
                          className="input-field"
                          value={selected.categoryId || ''}
                          disabled={busy}
                          onChange={(e) => changeCategory(e.target.value)}
                        >
                          <option value="">Sans catégorie</option>
                          {flatCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.parentId ? `↳ ${c.title}` : c.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <h3 className="font-semibold text-prune-900 mb-2">Contacts liés</h3>
                        {(selected.contacts || []).length === 0 ? (
                          <p className="text-sm text-prune-500 mb-3">
                            Aucun contact lié à ce document.
                          </p>
                        ) : (
                          <ul className="space-y-2 mb-3">
                            {selected.contacts.map((c) => (
                              <li
                                key={c.id}
                                className="flex items-center justify-between gap-2 rounded-xl bg-prune-50/80 px-3 py-2.5"
                              >
                                <div className="min-w-0">
                                  <p className="font-medium text-prune-900 truncate">
                                    {c.displayName ||
                                      [c.firstName, c.lastName].filter(Boolean).join(' ') ||
                                      `Contact #${c.id}`}
                                  </p>
                                  <p className="text-xs text-prune-500">
                                    {[c.link?.role, c.email, c.phone].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => unlinkContact(c.id)}
                                  className="text-xs font-semibold text-prune-500 hover:text-red-600 shrink-0 transition-colors"
                                >
                                  Retirer
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            className="input-field"
                            value={linkContactId}
                            onChange={(e) => setLinkContactId(e.target.value)}
                          >
                            <option value="">Lier un contact…</option>
                            {(resources?.projectContacts || [])
                              .filter(
                                (c) =>
                                  !(selected.contacts || []).some((linked) => linked.id === c.id)
                              )
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.displayName ||
                                    [c.firstName, c.lastName].filter(Boolean).join(' ') ||
                                    `Contact #${c.id}`}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            disabled={busy || !linkContactId}
                            onClick={linkContact}
                            className="btn-secondary shrink-0"
                          >
                            Lier
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>

      {scanModal && project && (
        <DocumentScanModal
          projectId={project.id}
          scanId={scanModal.scanId}
          documentId={scanModal.documentId}
          onClose={() => setScanModal(null)}
          onApplied={() => load(project.id)}
        />
      )}
    </div>
  );
}
