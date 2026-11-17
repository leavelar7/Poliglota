# Frases aplicadas

Uma frase **simples** e uma frase **completa** para cada palavra do app, em português,
inglês, alemão e italiano. A criança encontra a frase simples na Revisão depois de
aprender a palavra, e a completa depois de aprender a simples.

Um arquivo por fase. Cada linha (fora as que começam com `#`) tem 9 campos separados por `|`:

```
id da palavra | simples pt | simples en | simples de | simples it | completa pt | completa en | completa de | completa it
```

Para gravar no banco: `node conteudo/frases/gerar_sql.js > supabase/migrations/<data>_frases_aplicadas_dados.sql`.
Os áudios são gerados pelo workflow `.github/workflows/audios.yml`.

Palavras repetidas com o mesmo sentido (por exemplo "pão" em duas posições da fase Comida,
"colher" em Casa e em Cozinha) têm frases só na primeira ocorrência; a revisão é por palavra,
então as frases valem para as duas.

## Para editar uma frase

1. Edite a linha no arquivo da fase.
2. `node conteudo/frases/gerar_sql.js --checar` para validar.
3. Gere o SQL de novo (comando acima) e aplique no Supabase.
4. Faça o push: o workflow de áudios refaz o mp3 das frases que mudaram (ele guarda o texto
   de cada áudio em `audio/frases.json`).
