-- "grande" (fase Conceitos) apontava para img/grande.svg, que não existe. Usa o desenho de Opostos.
update public.palavras set fig = 'op_grande' where fig = 'grande';
update public.temas set icone = 'op_grande' where icone = 'grande';
