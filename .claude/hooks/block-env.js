#!/usr/bin/env node
// PreToolUse guard: bloquea que el agente lea o edite archivos .env reales.
// Los .env de este repo tienen secretos vivos (OpenAI, Clerk secret,
// Supabase service role, DATABASE_URL). .gitignore protege git, no a Claude.
//
// Protocolo de hooks: exit 2 = bloquear la tool call; el stderr vuelve a Claude.
// exit 0 = permitir. Cualquier error de parseo => permitir (fail-open) para no
// romper el flujo normal de herramientas.

const fs = require("fs");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function basename(p) {
  return String(p).replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";
}

// Coincide con .env, .env.local, .env.production, etc.
// NO coincide con .env.example / .env.local.example (plantillas sin secretos).
function isProtectedEnv(p) {
  if (!p) return false;
  const name = basename(p);
  return /^\.env(\..+)?$/.test(name) && !/\.example$/.test(name);
}

let data;
try {
  data = JSON.parse(readStdin());
} catch {
  process.exit(0);
}

const ti = (data && data.tool_input) || {};
const candidates = [ti.file_path, ti.path, ti.notebook_path].filter(Boolean);

if (candidates.some(isProtectedEnv)) {
  process.stderr.write(
    "Bloqueado: los archivos .env contienen secretos (OpenAI, Clerk, " +
      "Supabase service role, DATABASE_URL) y no deben leerse ni editarse. " +
      "Usá los .env.example como referencia de las variables disponibles.\n"
  );
  process.exit(2);
}

process.exit(0);
