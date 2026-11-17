// Lê os arquivos de frases desta pasta, valida e imprime o SQL de carga.
// Uso: node conteudo/frases/gerar_sql.js > supabase/migrations/<data>_frases_aplicadas_dados.sql
//      node conteudo/frases/gerar_sql.js --checar   (só valida)
const fs = require("fs");
const path = require("path");

const pasta = __dirname;
const arquivos = fs.readdirSync(pasta).filter((f) => /^\d\d_.*\.txt$/.test(f)).sort();
const linhas = [];
const erros = [];
const vistos = {};

arquivos.forEach(function (arq) {
  fs.readFileSync(path.join(pasta, arq), "utf8").split("\n").forEach(function (l, i) {
    if (!l.trim() || l.startsWith("#")) return;
    const c = l.split("|").map((x) => x.trim());
    const onde = arq + ":" + (i + 1);
    if (c.length !== 9) return erros.push(onde + " tem " + c.length + " campos (esperado 9)");
    const id = Number(c[0]);
    if (!Number.isInteger(id) || id <= 0) return erros.push(onde + " id inválido: " + c[0]);
    if (vistos[id]) return erros.push(onde + " id " + id + " repetido (já em " + vistos[id] + ")");
    vistos[id] = onde;
    c.slice(1).forEach(function (t, j) {
      if (!t) erros.push(onde + " campo " + (j + 2) + " vazio");
      if (!/[.!?]$/.test(t)) erros.push(onde + " campo " + (j + 2) + " sem pontuação final: " + t);
      if (t.length > 120) erros.push(onde + " campo " + (j + 2) + " longo demais (" + t.length + ")");
    });
    linhas.push({ id: id, s: c.slice(1, 5), c: c.slice(5, 9), arq: arq });
  });
});

if (erros.length) { console.error(erros.join("\n")); process.exit(1); }

if (process.argv.includes("--checar")) {
  console.error("ok: " + linhas.length + " palavras, " + linhas.length * 2 + " frases em " + arquivos.length + " arquivos");
  if (process.argv.includes("--ids")) console.log(JSON.stringify(linhas.map((l) => l.id)));
  process.exit(0);
}

const q = (t) => "'" + t.replace(/'/g, "''") + "'";
const out = [];
out.push("-- Gerado por conteudo/frases/gerar_sql.js. Não edite à mão: edite os .txt e gere de novo.");
out.push("begin;");
out.push("delete from public.frases_aplicadas;");
out.push("insert into public.frases_aplicadas (palavra_id, nivel, pt, en, de, it) values");
const vals = [];
linhas.forEach(function (l) {
  vals.push("  (" + l.id + ", 1, " + l.s.map(q).join(", ") + ")");
  vals.push("  (" + l.id + ", 2, " + l.c.map(q).join(", ") + ")");
});
out.push(vals.join(",\n") + ";");
out.push("commit;");
console.log(out.join("\n"));
