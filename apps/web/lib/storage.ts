import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { KnowledgeFileType } from "@askwell/shared";

/**
 * Neon Object Storage (S3-compatible) : compartiment privé `knowledge`. Jamais d'URL publique.
 *
 * Ce fichier est, avec `lib/db/service.ts`, le SEUL à lire des secrets : les variables `NEON_STORAGE_*`
 * (project.md §9, « Secrets »). Les fonctions de propriété (`getOwnedProject`) vivent dans les routes (A2) :
 * ici, on reçoit des clés d'objet déjà décidées par le serveur.
 */
export const STORAGE_BUCKET = "knowledge";

/** Durée de vie d'une URL présignée de téléversement : 5 minutes (project.md §6.4, §9). */
export const UPLOAD_URL_TTL_SECONDS = 300;

/**
 * Content-Type signé dans l'URL présignée, fixe par type de fichier. Le navigateur envoie exactement ce même
 * en-tête dans le PUT (table dupliquée volontairement dans `lib/knowledge-ui/knowledge-api.ts`, page
 * Connaissances) : tout écart donne un 403 du stockage.
 */
export const UPLOAD_CONTENT_TYPES: Record<KnowledgeFileType, string> = {
  pdf: "application/pdf",
  md: "text/markdown",
  txt: "text/plain",
};

let client: S3Client | undefined;

function requiredEnv(name: string): string {
  const value = process.env[name];
  // Message sans valeur : jamais un identifiant ou une clé dans une erreur ou un journal.
  if (!value) throw new Error(`${name} est absente : le stockage ne peut pas être utilisé (voir project.md §11).`);
  return value;
}

/** Client S3 créé à la demande (jamais à l'import : `next build` n'exige pas les clés). */
function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: requiredEnv("NEON_STORAGE_REGION"),
    endpoint: requiredEnv("NEON_STORAGE_ENDPOINT"),
    credentials: {
      accessKeyId: requiredEnv("NEON_STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("NEON_STORAGE_SECRET_ACCESS_KEY"),
    },
    // Exigé par Neon : le nom du compartiment est un segment de chemin, pas un sous-domaine.
    forcePathStyle: true,
    // Sans cela, le SDK intègre dans l'URL un checksum calculé sur un corps vide, et refuse tout vrai fichier.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  return client;
}

/** Clé d'objet d'une source : `projects/<projet>/<identifiant>`. Décidée par le serveur, jamais par le client. */
export function buildObjectKey(projectId: string, objectId: string): string {
  return `projects/${projectId}/${objectId}`;
}

/** URL présignée de téléversement (PUT) : 5 minutes, Content-Type signé d'après la table fixe. */
export async function createUploadUrl(key: string, type: KnowledgeFileType): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: STORAGE_BUCKET,
    Key: key,
    ContentType: UPLOAD_CONTENT_TYPES[type],
  });
  return getSignedUrl(getClient(), command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    // Par défaut le SDK ne signe pas content-type : on le force, pour qu'un autre type soit refusé (403).
    signableHeaders: new Set(["content-type"]),
  });
}

export class ObjectTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`L'objet dépasse ${maxBytes} octets.`);
    this.name = "ObjectTooLargeError";
  }
}

/**
 * Lit un objet UNE seule fois et renvoie ses octets. Si le stockage annonce déjà plus de `maxBytes`, le corps
 * n'est pas lu. La taille réelle est de toute façon revérifiée par l'appelant sur les octets renvoyés.
 */
export async function readObject(key: string, maxBytes: number): Promise<Uint8Array> {
  const response = await getClient().send(new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
  if (response.ContentLength !== undefined && response.ContentLength > maxBytes) {
    // Libère la connexion sans lire le corps.
    (response.Body as { destroy?: () => void } | undefined)?.destroy?.();
    throw new ObjectTooLargeError(maxBytes);
  }
  if (!response.Body) throw new Error("Objet vide ou illisible.");
  return response.Body.transformToByteArray();
}

/** Supprime un objet (sans erreur s'il n'existe plus : S3 répond 204). */
export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
}
