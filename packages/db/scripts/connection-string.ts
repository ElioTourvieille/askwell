import type { Readable, Writable } from "node:stream";

type Input = Readable & { isTTY?: boolean; setRawMode?: (mode: boolean) => unknown };

/**
 * Lit la chaîne de connexion du propriétaire : sur l'entrée standard si elle est redirigée,
 * sinon saisie masquée dans le terminal. Elle ne vient JAMAIS d'une variable d'environnement
 * ni d'un fichier (project.md §11), et n'est jamais affichée ni écrite.
 */
export async function readConnectionString(input: Input, output: Writable): Promise<string> {
  const raw = input.isTTY ? await promptHidden(input, output) : await readAll(input);
  const value = raw.split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^postgres(ql)?:\/\//.test(value)) {
    throw new Error("Chaîne de connexion invalide : elle doit commencer par postgresql://");
  }
  return value;
}

async function readAll(input: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function promptHidden(input: Input, output: Writable): Promise<string> {
  return new Promise((resolve, reject) => {
    output.write("Chaîne de connexion du propriétaire (saisie masquée) : ");
    let value = "";
    input.setRawMode?.(true);
    input.resume();
    input.setEncoding("utf8");

    const finish = (action: () => void) => {
      input.removeListener("data", onData);
      input.setRawMode?.(false);
      input.pause();
      output.write("\n");
      action();
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return finish(() => resolve(value));
        if (char === "\u0003") return finish(() => reject(new Error("Annulé.")));
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on("data", onData);
  });
}
