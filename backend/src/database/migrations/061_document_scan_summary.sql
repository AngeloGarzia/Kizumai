-- Résumé document proposé au user ; mémoire enrichie seulement après acceptation.

ALTER TABLE document_scan_items
  DROP CONSTRAINT IF EXISTS chk_scan_items_type;

ALTER TABLE document_scan_items
  ADD CONSTRAINT chk_scan_items_type CHECK (
    item_type IN ('contact', 'date', 'address', 'summary')
  );

UPDATE ai_prompts
SET
  name = 'Scan document — résumé + contacts / dates / adresses',
  role = 'system',
  content = $prompt$Tu analyses le texte extrait d'un document projet entrepreneurial.
N'invente rien : ne propose que ce qui apparaît clairement dans le texte.
Si une information est absente ou ambiguë, omets-la.

Document : {{document_title}}
Type MIME : {{mime_type}}

Texte :
{{text}}

Réponds UNIQUEMENT avec un objet JSON valide de la forme :
{
  "summary": {
    "text": "résumé clair du document en 5 à 10 phrases, utile pour la mémoire projet (faits, enjeux, chiffres, décisions). Pas de listes hors texte.",
    "confidence": 0.0
  },
  "contacts": [
    {
      "displayName": "Nom Prénom ou raison sociale",
      "email": "email ou null",
      "phone": "téléphone ou null",
      "organization": "organisation ou null",
      "jobTitle": "fonction ou null",
      "roleHint": "rôle probable (interviewé, fournisseur, conseil…)",
      "confidence": 0.0,
      "snippet": "courte citation source"
    }
  ],
  "dates": [
    {
      "title": "libellé de l'échéance ou événement",
      "startAt": "ISO-8601 date ou datetime",
      "endAt": "ISO-8601 ou null",
      "allDay": true,
      "kind": "deadline|appointment|task|reminder",
      "confidence": 0.0,
      "snippet": "courte citation source"
    }
  ],
  "addresses": [
    {
      "label": "libellé du lieu",
      "addressLine1": "rue",
      "postalCode": "code postal",
      "city": "ville",
      "country": "FR",
      "confidence": 0.0,
      "snippet": "courte citation source"
    }
  ]
}

Le champ summary.text est obligatoire dès que le texte source est non vide.
Les tableaux contacts/dates/addresses peuvent être vides [].
Dates en ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ssZ). confidence entre 0 et 1.$prompt$,
  updated_at = NOW()
WHERE prompt_key = 'document_scan';
