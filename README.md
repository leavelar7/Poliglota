# Pequeno Poliglota 🌍

Aplicativo web para ensinar três idiomas estrangeiros (inglês, alemão e italiano) a uma criança de 5 anos que **ainda não sabe ler**, por meio de flashcards ilustrados, áudio nativo e prática de fala.

**Demo:** https://poliglota-app-delta.vercel.app

---

## O problema

Apps de idioma convencionais dependem de leitura e de menus com muitos botões — inúteis para uma criança em fase pré-alfabetização, que se distrai fácil. O Pequeno Poliglota foi desenhado com restrições rígidas:

- **Zero dependência de leitura:** toda escolha é por imagem, ícone ou voz.
- **Mínimo de botões:** a criança consegue operar quase sozinha.
- **Vocabulário utilizável:** palavras e, futuramente, frases curtas — não só termos soltos.
- **Estímulo visual sóbrio:** ilustrações em estilo aquarela, sem excesso de cor.

## Funcionalidades

- Sessão de estudo que intercala **vocabulário** e **alfabeto**, alternando entre os três idiomas.
- **Áudio de pronúncia nativa** em cada idioma (pré-gerado).
- **Reconhecimento de fala:** a criança repete a palavra e o app avança sozinho se acerta (tolerante a erros de pronúncia).
- **~300 conceitos ilustrados** (1 imagem serve os 3 idiomas), organizados em temas.
- Layout **responsivo** (funciona no celular).
- Registro de **progresso** de cada tentativa no banco.

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Front-end | HTML, CSS e JavaScript puro (sem framework) |
| Banco de dados | Supabase (PostgreSQL) |
| Hospedagem / deploy | Vercel |
| Áudio | Google TTS (gTTS) — gerado por script Node |
| Voz (reconhecimento) | Web Speech API |
| Ilustrações | SVG desenhado à mão (filtro aquarela com feTurbulence) |

## Arquitetura

```
[ Navegador (front estático) ]
        │  supabase-js (API REST)
        ▼
[ Supabase / PostgreSQL ]
  ├── palavras   (pt, en, de, it, fig, tema)
  ├── alfabeto   (idioma, ordem, letra, exemplo, fig)
  └── tentativas (registro de progresso)

Imagens .svg e áudios .mp3 são servidos estaticamente pela Vercel.
```

O front carrega o vocabulário do Supabase, monta uma sessão embaralhada, mostra a imagem + palavra + tradução, toca o áudio e escuta a criança. O comparador de fala normaliza o texto e usa **distância de Levenshtein** (programação dinâmica) para aceitar pronúncias aproximadas.

## Decisões de engenharia

- **Áudio pré-gerado, não voz do dispositivo:** garante qualidade e consistência entre aparelhos (evita o problema de o celular ler tudo com sotaque inglês por falta de vozes instaladas).
- **Áudio identificado pelo `id` da palavra, não pela imagem:** como uma mesma imagem é reutilizada por vários conceitos (ex.: o aceno serve várias despedidas), a chave por imagem causava colisão de áudio. A chave por id elimina isso.
- **SVG à mão:** leve, escalável e com estilo visual coerente em todo o app.
- **Fallback para iPhone:** a Web Speech API não é confiável no iOS, então lá o reconhecimento é desativado e o app funciona no modo "ouvir e tocar para avançar".
- **Auditoria automatizada:** um script confere, a cada lote, se toda imagem e todo áudio existem — evita caçar erro no meio de centenas de arquivos.

## Como rodar

O front é estático — basta servir a pasta por HTTPS (o microfone exige origem segura).

```bash
# gerar os áudios (precisa de Node e do pacote gtts)
npm install gtts
node gerar_audios.js

# publicar
vercel --prod
```

As credenciais do Supabase usadas no front são a **URL** e a **chave anônima (anon)** — públicas por design. A proteção de acesso (RLS) e o login serão adicionados na próxima fase.

## Roadmap

- [ ] Motor de **repetição espaçada** (algoritmo SM-2 / curva do esquecimento)
- [ ] **Login** com senha e proteção de dados por usuário (RLS)
- [ ] **Painel de progresso** por criança
- [ ] Formação de **frases curtas** a partir do vocabulário
- [ ] **Testes automatizados** e integração contínua (CI/CD)

## Autor

Leslie Avelar — projeto pessoal de aprendizado de engenharia de software.
